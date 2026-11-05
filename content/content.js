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
    caseSensitive: false
  };

  let compiledRegexes = [];
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
    'yt-lockup-view-model',
    'ytm-shorts-lockup-view-model-v2'
  ];

  const CARD_QUERY = CARD_SELECTORS.join(', ');

  // Selectors to extract title inside a card
  const TITLE_SELECTORS = [
    '#video-title',
    '#video-title-link',
    'a#video-title',
    'span#video-title',
    '.yt-lockup-metadata-view-model__title',
    'h3 a'
  ];

  // Selectors to extract channel name inside a card
  const CHANNEL_SELECTORS = [
    'ytd-channel-name',
    '#channel-name',
    '#channel-info',
    '.yt-lockup-metadata-view-model__owner',
    'a[href*="/@"]',
    '#byline'
  ];

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
        caseSensitive: false
      });

      settings = {
        enabled: data.enabled !== false,
        words: Array.isArray(data.words) ? data.words.filter(w => typeof w === 'string' && w.trim().length > 0) : [],
        regexEnabled: Boolean(data.regexEnabled),
        caseSensitive: Boolean(data.caseSensitive)
      };

      compileRules();
      applyFilter();
    } catch (err) {
      console.error('[YouTube Ban Words] Failed to load settings:', err);
    }
  }

  /**
   * Pre-compile regexes or normalize search words
   */
  function compileRules() {
    compiledRegexes = [];

    if (!settings.enabled || settings.words.length === 0) {
      return;
    }

    if (settings.regexEnabled) {
      for (const pattern of settings.words) {
        try {
          const flags = settings.caseSensitive ? '' : 'i';
          compiledRegexes.push(new RegExp(pattern, flags));
        } catch (e) {
          console.warn('[YouTube Ban Words] Invalid regex:', pattern, e);
        }
      }
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

    const testText = settings.caseSensitive ? text : text.toLowerCase();

    for (const word of settings.words) {
      const target = settings.caseSensitive ? word : word.toLowerCase();
      if (target && testText.includes(target)) {
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

    // Find title
    for (const sel of TITLE_SELECTORS) {
      const el = card.querySelector(sel);
      if (el) {
        title = el.textContent || el.getAttribute('title') || el.getAttribute('aria-label') || '';
        if (title.trim()) break;
      }
    }

    // Fallback: look for aria-label on links if title is empty
    if (!title.trim()) {
      const mainLink = card.querySelector('a#thumbnail, a.ytd-thumbnail');
      if (mainLink) {
        title = mainLink.getAttribute('aria-label') || '';
      }
    }

    // Find channel
    for (const sel of CHANNEL_SELECTORS) {
      const el = card.querySelector(sel);
      if (el) {
        channel = el.textContent || '';
        if (channel.trim()) break;
      }
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
