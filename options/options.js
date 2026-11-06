/**
 * YouTube Ban Words - Options Script
 */

(function () {
  'use strict';

  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
  const storage = browserAPI.storage.sync || browserAPI.storage.local;

  // State
  let settings = {
    enabled: true,
    words: [],
    regexEnabled: false,
    caseSensitive: false,
    wholeWord: false
  };

  // DOM Elements
  const optEnabled = document.getElementById('optEnabled');
  const optRegex = document.getElementById('optRegex');
  const optWholeWord = document.getElementById('optWholeWord');
  const optCase = document.getElementById('optCase');
  const regexTesterCard = document.getElementById('regexTesterCard');
  const regexTestPattern = document.getElementById('regexTestPattern');
  const regexTestSubject = document.getElementById('regexTestSubject');
  const regexTestResult = document.getElementById('regexTestResult');
  const addWordsForm = document.getElementById('addWordsForm');
  const wordsInput = document.getElementById('wordsInput');
  const filterInput = document.getElementById('filterInput');
  const wordsContainer = document.getElementById('wordsContainer');
  const emptyState = document.getElementById('emptyState');
  const totalWordsCount = document.getElementById('totalWordsCount');
  const clearAllBtn = document.getElementById('clearAllBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const exportTsvBtn = document.getElementById('exportTsvBtn');
  const exportJsonBtn = document.getElementById('exportJsonBtn');
  const sortSelect = document.getElementById('sortSelect');
  const fileInput = document.getElementById('fileInput');
  const importNotice = document.getElementById('importNotice');
  const saveFeedback = document.getElementById('saveFeedback');

  function showSavedToast(msg = 'Changes saved automatically') {
    saveFeedback.textContent = msg;
    saveFeedback.style.opacity = '1';
    setTimeout(() => {
      saveFeedback.style.opacity = '0.7';
    }, 2000);
  }

  function showImportNotice(msg, isError = false) {
    importNotice.textContent = msg;
    importNotice.style.color = isError ? 'var(--danger)' : 'var(--success)';
    setTimeout(() => {
      importNotice.textContent = '';
    }, 3500);
  }

  async function saveSettings() {
    await storage.set(settings);
    showSavedToast();
  }

  // Render the list of word tags
  function renderWords() {
    const filterQuery = (filterInput.value || '').trim().toLowerCase();
    wordsContainer.innerHTML = '';

    let filteredWords = settings.words.filter(word => {
      if (!filterQuery) return true;
      return word.toLowerCase().includes(filterQuery);
    });

    // Apply sorting
    const sortMode = sortSelect ? sortSelect.value : 'oldest';
    if (sortMode === 'newest') {
      filteredWords = filteredWords.slice().reverse();
    } else if (sortMode === 'az') {
      filteredWords = filteredWords.slice().sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    } else if (sortMode === 'za') {
      filteredWords = filteredWords.slice().sort((a, b) => b.localeCompare(a, undefined, { sensitivity: 'base' }));
    }

    totalWordsCount.textContent = settings.words.length;

    if (settings.words.length === 0) {
      emptyState.style.display = 'block';
      emptyState.innerHTML = '<p>No banned words yet. Add your first keyword above!</p>';
      return;
    }

    if (filteredWords.length === 0) {
      emptyState.style.display = 'block';
      emptyState.innerHTML = '<p>No words matching your search query.</p>';
      return;
    }

    emptyState.style.display = 'none';

    filteredWords.forEach(word => {
      const tag = document.createElement('div');
      tag.className = 'word-tag';

      // Check regex validity if regex mode is active
      let regexError = null;
      if (settings.regexEnabled) {
        try {
          const flags = settings.caseSensitive ? '' : 'i';
          new RegExp(word, flags);
        } catch (e) {
          regexError = e.message;
          tag.classList.add('invalid-regex');
        }
      }

      const textSpan = document.createElement('span');
      textSpan.textContent = word;

      tag.appendChild(textSpan);

      if (regexError) {
        const warnBadge = document.createElement('span');
        warnBadge.className = 'regex-warn-badge';
        warnBadge.setAttribute('title', `Invalid Regex: ${regexError}`);
        warnBadge.textContent = 'Invalid Regex';
        tag.appendChild(warnBadge);
      }

      const delBtn = document.createElement('button');
      delBtn.className = 'delete-word';
      delBtn.setAttribute('title', `Remove "${word}"`);
      delBtn.setAttribute('aria-label', `Remove "${word}"`);
      delBtn.innerHTML = `
        <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      `;

      delBtn.addEventListener('click', () => {
        removeWord(word);
      });

      tag.appendChild(delBtn);
      wordsContainer.appendChild(tag);
    });
  }

  function removeWord(wordToRemove) {
    settings.words = settings.words.filter(w => w !== wordToRemove);
    renderWords();
    saveSettings();
  }

  function addWords(wordsArray) {
    const existingLower = new Set(settings.words.map(w => w.toLowerCase()));
    let addedCount = 0;

    let invalidRegexFound = false;
    for (const item of wordsArray) {
      const clean = item.trim();
      if (clean && !existingLower.has(clean.toLowerCase())) {
        settings.words.push(clean);
        existingLower.add(clean.toLowerCase());
        addedCount++;

        if (settings.regexEnabled) {
          try {
            const flags = settings.caseSensitive ? '' : 'i';
            new RegExp(clean, flags);
          } catch (_) {
            invalidRegexFound = true;
          }
        }
      }
    }

    if (addedCount > 0) {
      renderWords();
      saveSettings();
      if (invalidRegexFound) {
        showSavedToast('Warning: One or more patterns contain invalid regex syntax');
      }
    }

    return addedCount;
  }

  // Regex Tester Tool Logic
  function testRegexPattern() {
    if (!regexTestPattern || !regexTestResult) return;
    const pattern = regexTestPattern.value.trim();
    const subject = regexTestSubject ? regexTestSubject.value : '';

    if (!pattern) {
      regexTestResult.textContent = 'Enter pattern and sample text above';
      regexTestResult.className = 'tester-result';
      return;
    }

    try {
      const flags = settings.caseSensitive ? '' : 'i';
      const rx = new RegExp(pattern, flags);

      if (!subject) {
        regexTestResult.textContent = 'Valid regular expression syntax ✓ (enter sample text to test matching)';
        regexTestResult.className = 'tester-result success';
      } else if (rx.test(subject)) {
        regexTestResult.textContent = 'Match Found: Content would be hidden ✓';
        regexTestResult.className = 'tester-result match';
      } else {
        regexTestResult.textContent = 'No Match: Content would remain visible';
        regexTestResult.className = 'tester-result no-match';
      }
    } catch (err) {
      regexTestResult.textContent = `Invalid Regex: ${err.message}`;
      regexTestResult.className = 'tester-result error';
    }
  }

  // Initialize
  async function init() {
    try {
      const data = await storage.get({
        enabled: true,
        words: [],
        regexEnabled: false,
        caseSensitive: false,
        wholeWord: false
      });

      settings.enabled = data.enabled !== false;
      settings.words = Array.isArray(data.words) ? data.words : [];
      settings.regexEnabled = Boolean(data.regexEnabled);
      settings.caseSensitive = Boolean(data.caseSensitive);
      settings.wholeWord = Boolean(data.wholeWord);

      optEnabled.checked = settings.enabled;
      optRegex.checked = settings.regexEnabled;
      optWholeWord.checked = settings.wholeWord;
      optCase.checked = settings.caseSensitive;

      if (regexTesterCard) {
        regexTesterCard.style.display = settings.regexEnabled ? 'block' : 'none';
      }

      renderWords();
    } catch (err) {
      console.error('[YouTube Ban Words] Failed to initialize options:', err);
    }
  }

  // Toggles
  optEnabled.addEventListener('change', () => {
    settings.enabled = optEnabled.checked;
    saveSettings();
  });

  optRegex.addEventListener('change', () => {
    settings.regexEnabled = optRegex.checked;
    if (regexTesterCard) {
      regexTesterCard.style.display = settings.regexEnabled ? 'block' : 'none';
    }
    renderWords();
    testRegexPattern();
    saveSettings();
  });

  if (regexTestPattern) {
    regexTestPattern.addEventListener('input', testRegexPattern);
  }
  if (regexTestSubject) {
    regexTestSubject.addEventListener('input', testRegexPattern);
  }

  optWholeWord.addEventListener('change', () => {
    settings.wholeWord = optWholeWord.checked;
    saveSettings();
  });

  optCase.addEventListener('change', () => {
    settings.caseSensitive = optCase.checked;
    saveSettings();
  });

  // Add words form (supports comma or newlines)
  addWordsForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = wordsInput.value;
    if (!raw.trim()) return;

    // Split on comma or newline
    const items = raw.split(/[\n,]+/).map(s => s.trim()).filter(Boolean);
    const added = addWords(items);

    if (added > 0) {
      wordsInput.value = '';
      showSavedToast(`Added ${added} new word${added > 1 ? 's' : ''}`);
    } else {
      showSavedToast('All entered words are already in the list');
    }
  });

  // Filter input & sort select
  filterInput.addEventListener('input', renderWords);
  if (sortSelect) {
    sortSelect.addEventListener('change', renderWords);
  }

  // Clear all words
  clearAllBtn.addEventListener('click', () => {
    if (settings.words.length === 0) return;
    if (confirm(`Are you sure you want to remove all ${settings.words.length} banned words?`)) {
      settings.words = [];
      renderWords();
      saveSettings();
      showSavedToast('All words cleared');
    }
  });

  // Export functions
  function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  exportCsvBtn.addEventListener('click', () => {
    if (settings.words.length === 0) {
      alert('Your word list is empty. Nothing to export.');
      return;
    }
    // Escape CSV values with quotes if they contain commas or quotes
    const rows = ['Keyword'];
    for (const w of settings.words) {
      const escaped = `"${w.replace(/"/g, '""')}"`;
      rows.push(escaped);
    }
    downloadFile(rows.join('\r\n'), 'youtube_banned_words.csv', 'text/csv;charset=utf-8;');
  });

  exportTsvBtn.addEventListener('click', () => {
    if (settings.words.length === 0) {
      alert('Your word list is empty. Nothing to export.');
      return;
    }
    const rows = ['Keyword'];
    for (const w of settings.words) {
      rows.push(w.replace(/\t/g, ' '));
    }
    downloadFile(rows.join('\r\n'), 'youtube_banned_words.tsv', 'text/tab-separated-values;charset=utf-8;');
  });

  exportJsonBtn.addEventListener('click', () => {
    if (settings.words.length === 0) {
      alert('Your word list is empty. Nothing to export.');
      return;
    }
    const backup = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      settings: {
        enabled: settings.enabled,
        regexEnabled: settings.regexEnabled,
        wholeWord: settings.wholeWord,
        caseSensitive: settings.caseSensitive
      },
      words: settings.words
    };
    downloadFile(JSON.stringify(backup, null, 2), 'youtube_banned_words.json', 'application/json;charset=utf-8;');
  });

  // Import file
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      let parsedWords = [];
      let importedSettings = null;

      // Check for JSON format
      if (file.name.toLowerCase().endsWith('.json') || file.type === 'application/json') {
        try {
          const json = JSON.parse(text);
          if (Array.isArray(json)) {
            parsedWords = json.filter(w => typeof w === 'string' && w.trim().length > 0);
          } else if (json && typeof json === 'object') {
            if (Array.isArray(json.words)) {
              parsedWords = json.words.filter(w => typeof w === 'string' && w.trim().length > 0);
            }
            if (json.settings && typeof json.settings === 'object') {
              importedSettings = json.settings;
            }
          }
        } catch (_) {
          showImportNotice('Invalid JSON structure in imported file.', true);
          return;
        }
      } else {
        // Parse CSV / TSV / plain text line-by-line
        const lines = text.split(/\r?\n/);

        for (let line of lines) {
          line = line.trim();
          if (!line) continue;

          // Strip surrounding quotes if present
          if (line.startsWith('"') && line.endsWith('"')) {
            line = line.slice(1, -1).replace(/""/g, '"');
          }

          // If line is header 'Keyword', skip it
          if (line.toLowerCase() === 'keyword') {
            continue;
          }

          // Split on comma or tab if multiple items on one line
          const parts = line.split(/[,\t]+/).map(p => {
            let s = p.trim();
            if (s.startsWith('"') && s.endsWith('"')) {
              s = s.slice(1, -1).replace(/""/g, '"');
            }
            return s.trim();
          }).filter(Boolean);

          parsedWords.push(...parts);
        }
      }

      if (parsedWords.length === 0 && !importedSettings) {
        showImportNotice('No valid keywords found in imported file.', true);
        return;
      }

      const mode = document.querySelector('input[name="importMode"]:checked')?.value || 'merge';

      if (mode === 'replace') {
        const unique = Array.from(new Set(parsedWords));
        settings.words = unique;

        if (importedSettings) {
          if (typeof importedSettings.enabled === 'boolean') settings.enabled = importedSettings.enabled;
          if (typeof importedSettings.regexEnabled === 'boolean') settings.regexEnabled = importedSettings.regexEnabled;
          if (typeof importedSettings.wholeWord === 'boolean') settings.wholeWord = importedSettings.wholeWord;
          if (typeof importedSettings.caseSensitive === 'boolean') settings.caseSensitive = importedSettings.caseSensitive;

          optEnabled.checked = settings.enabled;
          optRegex.checked = settings.regexEnabled;
          optWholeWord.checked = settings.wholeWord;
          optCase.checked = settings.caseSensitive;
        }

        renderWords();
        saveSettings();
        showImportNotice(`Replaced list with ${unique.length} words!`);
      } else {
        const added = addWords(parsedWords);
        showImportNotice(`Imported ${added} new words (${parsedWords.length - added} duplicates skipped)`);
      }
    } catch (err) {
      console.error('[YouTube Ban Words] Import error:', err);
      showImportNotice('Failed to read file. Please ensure it is a valid CSV/TSV/JSON/TXT file.', true);
    } finally {
      fileInput.value = '';
    }
  });

  init();
})();
