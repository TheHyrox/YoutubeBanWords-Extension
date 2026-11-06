/**
 * YouTube Ban Words - Content Script
 * Hides videos, shorts, search results, and channels matching banned words.
 */

(function () {
  'use strict';

  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;

  let settings = {
    enabled: true,
    words: [],
    regexEnabled: false,
    caseSensitive: false,
    wholeWord: false
  };

  let compiledRegexes = [];
  let compiledWholeWordRegexes = [];
  let normalizedWords = [];
  let isScanning = false;
  let scanScheduled = false;

  // Selectors for video/card containers on YouTube
  const CARD_SELECTORS = [
    'ytd-rich-item-renderer',
    'ytd-video-renderer',
    'ytd-compact-video-renderer',
    'ytd-reel-item-renderer',
    'ytd-grid-video-renderer',
    'ytd-channel-renderer',
    'ytd-playlist-renderer',
    'ytd-radio-renderer',
    'ytd-backstage-post-renderer',
    'ytd-post-renderer',
    'yt-lockup-view-model',
    'ytm-shorts-lockup-view-model',
    'ytm-shorts-lockup-view-model-v2'
  ];

  const CARD_QUERY = CARD_SELECTORS.join(', ');

  // Selectors for shelf/section containers (e.g. Shorts shelves)
  const SHELF_SELECTORS = [
    'ytd-rich-section-renderer',
    'ytd-reel-shelf-renderer'
  ];

  const SHELF_QUERY = SHELF_SELECTORS.join(', ');

  // Selectors to extract title inside a card
  const TITLE_SELECTORS = [
    '#video-title',
    '#video-title-link',
    'a#video-title',
    'span#video-title',
    '.yt-lockup-metadata-view-model__title',
    'h3 a'
  ];

  const TITLE_QUERY = TITLE_SELECTORS.join(', ');

  // Selectors to extract channel name inside a card
  const CHANNEL_SELECTORS = [
    'ytd-channel-name',
    '#channel-name',
    '#channel-info',
    '.yt-lockup-metadata-view-model__owner',
    'a[href*="/@"]',
    '#byline'
  ];

  const CHANNEL_QUERY = CHANNEL_SELECTORS.join(', ');

  /**
   * Load settings from browser storage
   */
  async function loadSettings() {
    try {
      const storage = browserAPI.storage.sync || browserAPI.storage.local;
      const data = await storage.get({
        enabled: true,
        words: [],
        regexEnabled: false,
        caseSensitive: false,
        wholeWord: false
      });

      settings = {
        enabled: data.enabled !== false,
        words: Array.isArray(data.words) ? data.words.filter(w => typeof w === 'string' && w.trim().length > 0) : [],
        regexEnabled: Boolean(data.regexEnabled),
        caseSensitive: Boolean(data.caseSensitive),
        wholeWord: Boolean(data.wholeWord)
      };

      compileRules();
      applyFilter();
    } catch (err) {
      console.error('[YouTube Ban Words] Failed to load settings:', err);
    }
  }

  /**
   * Escape special characters for safe regular expression generation
   */
  function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Pre-compile regexes or normalize search words
   */
  function compileRules() {
    compiledRegexes = [];
    compiledWholeWordRegexes = [];
    normalizedWords = [];

    if (!settings.enabled || settings.words.length === 0) {
      return;
    }

    const flags = settings.caseSensitive ? '' : 'i';

    if (settings.regexEnabled) {
      for (const pattern of settings.words) {
        try {
          compiledRegexes.push(new RegExp(pattern, flags));
        } catch (e) {
          console.warn('[YouTube Ban Words] Invalid regex:', pattern, e);
        }
      }
    } else if (settings.wholeWord) {
      for (const word of settings.words) {
        const clean = word.trim();
        if (!clean) continue;
        try {
          // Word boundary matching with unicode letter/number boundary support
          compiledWholeWordRegexes.push(new RegExp(`(?:^|[^\\p{L}\\p{N}_])${escapeRegex(clean)}(?=[^\\p{L}\\p{N}_]|$)`, `${flags}u`));
        } catch (_) {
          // Fallback to standard word boundary
          compiledWholeWordRegexes.push(new RegExp(`\\b${escapeRegex(clean)}\\b`, flags));
        }
      }
    } else {
      normalizedWords = settings.caseSensitive
        ? settings.words.filter(w => Boolean(w && w.trim()))
        : settings.words.map(w => w.trim().toLowerCase()).filter(Boolean);
    }
  }

  /**
   * Check if a given text matches any banned word
   */
  function matchesBannedWord(text) {
    if (!text || !settings.enabled || settings.words.length === 0) {
      return false;
    }

    if (settings.regexEnabled) {
      return compiledRegexes.some(rx => rx.test(text));
    }

    if (settings.wholeWord) {
      return compiledWholeWordRegexes.some(rx => rx.test(text));
    }

    const testText = settings.caseSensitive ? text : text.toLowerCase();

    for (let i = 0; i < normalizedWords.length; i++) {
      if (testText.includes(normalizedWords[i])) {
        return true;
      }
    }

    return false;
  }

  /**
   * Extract title & channel text from a YouTube card element
   */
  function getCardText(card) {
    let title = '';
    let channel = '';

    // Find title using single combined query
    const titleEl = card.querySelector(TITLE_QUERY);
    if (titleEl) {
      title = titleEl.textContent || titleEl.getAttribute('title') || titleEl.getAttribute('aria-label') || '';
    }

    // Fallback: look for aria-label on links if title is empty
    if (!title.trim()) {
      const mainLink = card.querySelector('a#thumbnail, a.ytd-thumbnail');
      if (mainLink) {
        title = mainLink.getAttribute('aria-label') || '';
      }
    }

    // Find channel using single combined query
    const channelEl = card.querySelector(CHANNEL_QUERY);
    if (channelEl) {
      channel = channelEl.textContent || '';
    }

    return {
      title: title.trim(),
      channel: channel.trim(),
      combined: `${title} ${channel}`.trim()
    };
  }

  /**
   * Scan and filter all cards on the page
   */
  function applyFilter() {
    if (isScanning) return;
    isScanning = true;

    try {
      const cards = document.querySelectorAll(CARD_QUERY);
      let bannedCount = 0;

      cards.forEach(card => {
        // If extension is disabled or word list is empty, unhide everything
        if (!settings.enabled || settings.words.length === 0) {
          if (card.hasAttribute('data-yt-banned')) {
            card.removeAttribute('data-yt-banned');
          }
          return;
        }

        const info = getCardText(card);
        // If no text found yet, card might still be rendering; skip until next mutation
        if (!info.combined) {
          return;
        }

        const shouldBan = matchesBannedWord(info.title) || matchesBannedWord(info.channel);

        if (shouldBan) {
          card.setAttribute('data-yt-banned', 'true');
          bannedCount++;
        } else if (card.hasAttribute('data-yt-banned')) {
          card.removeAttribute('data-yt-banned');
        }
      });

      // Clean up empty shelf / carousel containers
      const shelves = document.querySelectorAll(SHELF_QUERY);
      shelves.forEach(shelf => {
        if (!settings.enabled || settings.words.length === 0) {
          if (shelf.hasAttribute('data-yt-banned')) {
            shelf.removeAttribute('data-yt-banned');
          }
          return;
        }

        const items = shelf.querySelectorAll(CARD_QUERY);
        if (items.length > 0) {
          const allBanned = Array.from(items).every(item => item.getAttribute('data-yt-banned') === 'true');
          if (allBanned) {
            shelf.setAttribute('data-yt-banned', 'true');
          } else if (shelf.hasAttribute('data-yt-banned')) {
            shelf.removeAttribute('data-yt-banned');
          }
        }
      });

      // Update badge/storage count
      try {
        browserAPI.runtime.sendMessage({
          type: 'YT_BANNED_COUNT_UPDATE',
          count: bannedCount
        }).catch(() => {});
      } catch (_) {}

    } finally {
      isScanning = false;
    }
  }

  /**
   * Debounced scanning using requestAnimationFrame
   */
  function scheduleScan() {
    if (scanScheduled) return;
    scanScheduled = true;
    requestAnimationFrame(() => {
      scanScheduled = false;
      applyFilter();
    });
  }

  // Observe DOM modifications (infinite scrolling, dynamic component loading)
  const observer = new MutationObserver(mutations => {
    let shouldScan = false;
    for (const m of mutations) {
      if (m.addedNodes.length > 0) {
        shouldScan = true;
        break;
      }
    }
    if (shouldScan) {
      scheduleScan();
    }
  });

  observer.observe(document.documentElement || document.body, {
    childList: true,
    subtree: true
  });

  // Handle YouTube Single Page App navigations
  window.addEventListener('yt-navigate-finish', scheduleScan);
  window.addEventListener('spfdone', scheduleScan);

  // Listen for storage changes from Popup or Options page
  browserAPI.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' || area === 'local') {
      if (changes.enabled) settings.enabled = Boolean(changes.enabled.newValue);
      if (changes.words) settings.words = Array.isArray(changes.words.newValue) ? changes.words.newValue : [];
      if (changes.regexEnabled) settings.regexEnabled = Boolean(changes.regexEnabled.newValue);
      if (changes.caseSensitive) settings.caseSensitive = Boolean(changes.caseSensitive.newValue);
      if (changes.wholeWord) settings.wholeWord = Boolean(changes.wholeWord.newValue);

      compileRules();
      applyFilter();
    }
  });

  // Listen for queries from Popup
  browserAPI.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request && request.type === 'GET_PAGE_STATS') {
      const activeCount = document.querySelectorAll('[data-yt-banned="true"]').length;
      sendResponse({
        count: activeCount,
        enabled: settings.enabled,
        wordsCount: settings.words.length
      });
      return true;
    }
  });

  // Initial boot
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadSettings);
  } else {
    loadSettings();
  }
})();
