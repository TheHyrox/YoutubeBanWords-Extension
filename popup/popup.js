/**
 * YouTube Ban Words - Popup Script
 */

(function () {
  'use strict';

  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
  const storage = browserAPI.storage.sync || browserAPI.storage.local;

  const toggleFilter = document.getElementById('toggleFilter');
  const statusBanner = document.getElementById('statusBanner');
  const statusText = document.getElementById('statusText');
  const blockedCountEl = document.getElementById('blockedCount');
  const wordsCountEl = document.getElementById('wordsCount');
  const quickAddForm = document.getElementById('quickAddForm');
  const quickWordInput = document.getElementById('quickWordInput');
  const quickAddNotice = document.getElementById('quickAddNotice');
  const openOptionsBtn = document.getElementById('openOptionsBtn');

  let currentWords = [];

  function updateStatusUI(enabled) {
    toggleFilter.checked = enabled;
    if (enabled) {
      statusBanner.classList.remove('disabled');
      statusText.textContent = 'Filtering Active';
    } else {
      statusBanner.classList.add('disabled');
      statusText.textContent = 'Filtering Paused';
    }
  }

  function showNotice(msg, isError = false) {
    quickAddNotice.textContent = msg;
    quickAddNotice.style.color = isError ? '#ef4444' : 'var(--success)';
    setTimeout(() => {
      quickAddNotice.textContent = '';
    }, 2500);
  }

  // Load initial settings
  async function init() {
    try {
      const data = await storage.get({
        enabled: true,
        words: []
      });

      currentWords = Array.isArray(data.words) ? data.words : [];
      updateStatusUI(data.enabled !== false);
      wordsCountEl.textContent = currentWords.length;

      // Query active tab for live page statistics
      const [tab] = await browserAPI.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.id && tab.url && tab.url.includes('youtube.com')) {
        try {
          const stats = await browserAPI.tabs.sendMessage(tab.id, { type: 'GET_PAGE_STATS' });
          if (stats && typeof stats.count === 'number') {
            blockedCountEl.textContent = stats.count;
          }
        } catch (_) {
          // Content script not ready or page not loaded
          blockedCountEl.textContent = '0';
        }
      } else {
        blockedCountEl.textContent = '-';
      }
    } catch (e) {
      console.error('[YouTube Ban Words] Popup init error:', e);
    }
  }

  // Toggle filter on/off
  toggleFilter.addEventListener('change', async () => {
    const enabled = toggleFilter.checked;
    updateStatusUI(enabled);
    await storage.set({ enabled });
  });

  // Quick add keyword
  quickAddForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawVal = quickWordInput.value.trim();
    if (!rawVal) return;

    // Support comma-separated input in quick add too
    const newItems = rawVal.split(',')
      .map(w => w.trim())
      .filter(w => w.length > 0);

    if (newItems.length === 0) return;

    const existingLower = new Set(currentWords.map(w => w.toLowerCase()));
    let addedCount = 0;

    for (const item of newItems) {
      if (!existingLower.has(item.toLowerCase())) {
        currentWords.push(item);
        existingLower.add(item.toLowerCase());
        addedCount++;
      }
    }

    if (addedCount > 0) {
      await storage.set({ words: currentWords });
      wordsCountEl.textContent = currentWords.length;
      quickWordInput.value = '';
      showNotice(addedCount === 1 ? `Added "${newItems[0]}"` : `Added ${addedCount} words`);
    } else {
      showNotice('Word already in list', true);
    }
  });

  // Open full options
  openOptionsBtn.addEventListener('click', () => {
    if (browserAPI.runtime.openOptionsPage) {
      browserAPI.runtime.openOptionsPage();
    } else {
      window.open(browserAPI.runtime.getURL('options/options.html'));
    }
  });

  init();
})();
