# YouTube Ban Words - Firefox & Zen Browser Extension

A lightweight, zero-dependency Manifest V3 WebExtension built specifically for **Firefox** and **Zen Browser** to filter and completely hide YouTube videos, search results, Shorts shelves, and channels matching a customizable list of banned keywords.

---

## Features

- **Total Element Removal**: Completely removes matching video cards, Shorts, recommendations, and search results so no awkward blank gaps or placeholders remain.
- **Comprehensive Coverage**:
  - Home feed recommendations (`ytd-rich-item-renderer`, `yt-lockup-view-model`)
  - Search results (`ytd-video-renderer`, `ytd-channel-renderer`, `ytd-playlist-renderer`)
  - Shorts shelves & carousel items (`ytd-reel-item-renderer`, `ytm-shorts-lockup-view-model-v2`)
  - Suggested sidebar videos on watch pages (`ytd-compact-video-renderer`)
  - Channel names & Video titles
- **Instant Match Engine**:
  - Case-insensitive substring matching by default.
  - Optional **Advanced Regex Mode** for power users (e.g., `\b(keyword1|keyword2)\b`).
  - Optional **Case-Sensitive** mode toggle.
- **Fast Toolbar Popup**:
  - One-click toggle switch to pause or resume filtering.
  - Live count of hidden videos on the active YouTube tab.
  - Quick-add input bar to ban a word immediately without leaving the page.
- **Full Options Dashboard**:
  - Clean tag-based word list with real-time search and single-click removal.
  - **Import & Export**: Full support for `.csv`, `.tsv`, and `.txt` files with duplicate detection and replace/merge options.
- **Fast & Battery-Friendly**: Pure Vanilla JavaScript with debounced DOM mutations (`requestAnimationFrame`) and zero external dependencies.

---

## Installation & Testing

### In Zen Browser / Firefox:

1. Open **Zen Browser** or **Firefox**.
2. In the address bar, type:
   ```text
   about:debugging#/runtime/this-firefox
   ```
   *(In Zen Browser, you can also type `about:debugging` and select "This Zen" or "This Firefox" on the left menu)*.
3. Click the **"Load Temporary Add-on..."** button.
4. Browse to this project directory and select the `manifest.json` file.
5. The extension is now loaded! The shield icon will appear in your browser toolbar.

---

## How to Use

### 1. Adding Words from the Popup
- Click the **YouTube Ban Words** icon in the toolbar.
- Type any word or comma-separated list into the quick input (e.g., `keyword1, keyword2`).
- Click **Add**.

### 2. Opening the Full Options Dashboard
- Right-click the extension icon and select **Manage Extension > Options**, or click **"Full Word List & Settings"** in the popup.
- Here you can:
  - Add multiple keywords separated by commas or line breaks.
  - Toggle **Advanced Regex Mode** or **Case Sensitive** matching.
  - Search your banned keywords using the search bar.
  - Export your list to `.csv` or `.tsv`.
  - Import a list from another browser or file.

---

## Project Structure

```text
YoutubeBanWords-FirefoxExtension/
├── manifest.json          # WebExtensions MV3 configuration
├── content/
│   ├── content.js         # DOM scanning, MutationObserver, filtering logic
│   └── content.css        # CSS rule for hidden elements ([data-yt-banned="true"])
├── popup/
│   ├── popup.html         # Quick toolbar popup
│   ├── popup.css          # Styling for popup
│   └── popup.js           # Popup logic (toggle, stats, quick add)
├── options/
│   ├── options.html       # Full options dashboard
│   ├── options.css        # Dashboard styling (dark/light theme aware)
│   └── options.js         # Word management, regex toggle, CSV/TSV import/export
├── icons/
│   ├── icon.svg           # Scalable vector icon
│   ├── icon-16.png        # 16x16 icon
│   ├── icon-48.png        # 48x48 icon
│   ├── icon-96.png        # 96x96 icon
│   └── icon-128.png       # 128x128 icon
└── README.md
```

---

## Compatibility

- **Zen Browser**: Fully compatible (all versions).
- **Mozilla Firefox**: Version 109.0 or newer (Manifest V3).
