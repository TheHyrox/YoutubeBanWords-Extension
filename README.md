# YouTube Ban Words

A fast, lightweight browser extension that hides YouTube videos, search results, Shorts, and channels matching your custom list of banned keywords.

Supports **Firefox**, **Zen Browser**, **Chrome**, **Brave**, **Edge**, and other Chromium-based browsers.

---

## Features

- **Total Element Removal**: Completely removes matching video cards, Shorts, recommendations, and search results without leaving blank spaces.
- **Coverage**:
  - Home feed recommendations
  - Search results
  - Shorts shelves & carousels
  - Suggested sidebar videos on watch pages
  - Channel names & video titles
- **Matching Options**:
  - Case-insensitive substring match by default.
  - Optional **Whole Word Match** (prevents false positives e.g. "cat" matching "catch").
  - Optional **Advanced Regex Mode** with interactive pattern testing and real-time syntax validation.
  - Optional **Case-Sensitive** mode.
- **Popup & Options Dashboard**:
  - Quick ON/OFF toggle switch in toolbar.
  - Live count of hidden videos on active YouTube tab.
  - Quick-add keyword directly from popup.
  - Word list sorting (Insertion, Newest, A-Z, Z-A).
  - Full options page to manage words, search keywords, and **Import/Export (JSON/CSV/TSV)**.
- **Zero Dependencies**: Pure vanilla JavaScript, fast and battery-friendly.

---

## Installation

### In Chrome, Brave, Edge & Chromium browsers

1. Open `chrome://extensions` (or `brave://extensions` / `edge://extensions`).
2. Turn ON **"Developer mode"** (toggle in top-right corner).
3. Click **"Load unpacked"** and select this project folder.
4. *Done! The extension will stay installed permanently.*

### In Zen Browser / Firefox Developer Edition

1. In a new tab, go to `about:config`.
2. Search for `xpinstall.signatures.required` and set it to **`false`**.
3. Run `npm run pack` (see below) to create `dist/youtube-ban-words.xpi`.
4. Drag and drop `youtube-ban-words.xpi` into the browser window to install permanently.

### In Standard Firefox (Testing / Debugging)

1. Open `about:debugging#/runtime/this-firefox`.
2. Click **"Load Temporary Add-on..."** and choose `manifest.json`.

---

## Automated Browser Testing (`npm test`)

Run real browser end-to-end tests across the extension popup, options page, and live YouTube DOM filtering:

```bash
npm test
```

Tests include:
- Verifying extension loading in an unpacked Chromium session.
- Managing keywords in the Options dashboard.
- Interacting with the toolbar Popup (badge counts and quick-add).
- Filtering YouTube video titles and channel names.
- Dynamic DOM mutation observation (infinite scrolling).
- Real-time pause and restore toggling.

---

## Packaging (`npm run pack`)

To package the extension into ready-to-distribute `.zip` and `.xpi` archives, run:

```bash
npm run pack
```

> **Cross-Platform**: Uses a built-in zero-dependency Node.js script that works identically on **macOS (zsh)**, **Linux (bash)**, and **Windows (PowerShell / CMD)**.

Generated files in `dist/`:
- `dist/youtube-ban-words.zip`: For Chrome, Edge, Brave, or Chrome Web Store upload.
- `dist/youtube-ban-words.xpi`: For Firefox and Zen Browser installation.

---

## Automated Releases (GitHub Actions)

A GitHub Actions workflow is included at `.github/workflows/release.yml` to automate releases:

1. Go to the **Actions** tab on your GitHub repository.
2. Select **"Package & Draft Release"** in the sidebar.
3. Click **"Run workflow"** (you can optionally specify a version tag, or let it read from `package.json`).
4. The workflow will:
   - Run `npm run pack` to build the `.zip` and `.xpi`.
   - Auto-generate release notes based on recent commits.
   - Create a **Draft Release** with both files attached.
5. You can then review the draft in **Releases**, edit or complete the release notes, and click **"Publish release"**!

*(Alternatively, pushing a git tag like `git tag v1.0.0 && git push origin v1.0.0` triggers the same draft creation automatically).*

---

## Project Structure

```text
├── manifest.json       # WebExtensions MV3 configuration
├── content/            # Injected script & CSS for filtering YouTube
├── popup/              # Toolbar popup UI & controls
├── options/            # Full options dashboard & import/export
├── icons/              # Extension icons (SVG, PNG)
├── scripts/pack.js     # Cross-platform zip & xpi packaging script
└── package.json        # Contains `npm run pack` script
```

---

## License

MIT
