# Instructions & Guidelines for Gemini (and AI Agents)

## Project Summary (One-Line)
A lightweight, zero-dependency Manifest V3 WebExtension for Firefox, Zen Browser, Chrome, and Chromium browsers that completely filters and hides YouTube videos, shorts, search results, and channels matching user-defined banned keywords.

---

## Git Workflow, Branching & Commit Conventions

> **Agent Authorization**: As Gemini / AI assistant, you are authorized and encouraged to execute `git` commands directly to manage branches, stage files, create atomic commits, and prepare pull requests automatically.

### 1. Branch Naming Convention
Always branch off `main` for non-trivial changes or when working on new features/fixes:
- `feature/<short-kebab-name>`: New features (e.g., `feature/export-json`, `feature/regex-tester`)
- `fix/<short-kebab-name>`: Bug fixes (e.g., `fix/shorts-carousel-selector`, `fix/popup-badge-count`)
- `refactor/<short-kebab-name>`: Code restructuring without changing behavior
- `docs/<short-kebab-name>`: Documentation updates only
- `chore/<short-kebab-name>`: Build scripts, CI/CD, or maintenance

### 2. Commit Message Convention (Conventional Commits)
Write clear, atomic commit messages in the imperative mood (e.g., "add", "fix", not "added", "fixed"):
- `feat: <description>` (e.g., `feat: support importing word lists from json`)
- `fix: <description>` (e.g., `fix: update shorts container selector for new YouTube layout`)
- `docs: <description>` (e.g., `docs: update packaging guide for Chrome Web Store`)
- `refactor: <description>` (e.g., `refactor: streamline mutation observer debounce`)
- `chore: <description>` (e.g., `chore: bump version to 1.1.0 in manifest and package.json`)

### 3. Commit Rules
- Never commit build outputs (`dist/`, `*.zip`, `*.xpi`, `*.crx`), `.DS_Store`, or `node_modules/`.
- Ensure `node -c` syntax checks pass before committing any JS changes.
- If bumping versions, synchronize the version number in **both** [`package.json`](package.json) and [`manifest.json`](manifest.json).

### 4. Semantic Versioning Rules (`vMAJOR.MINOR.PATCH`)
Adhere to strict semantic versioning across releases and updates:
- **Major (`vX.0.0`)**: Incompatible API shifts, fundamental architectural redesigns, or Manifest version upgrades.
- **Minor (`vx.X.0`)**: Substantial feature additions, selector coverage expansions, or significant multi-file updates (e.g. `v1.1.0` introduced whole-word matching, JSON export/import, regex tester, and DOM scanning optimizations).
- **Patch (`vx.x.N+1`)**: Minor maintenance, documentation updates, rule updates, or bug fixes (e.g. `v1.1.1` bumped versioning rules and manifest/package synchronization).
- **Mandatory Synchronization**: Every version increment must be reflected simultaneously in **both** [`package.json`](package.json) (`"version": "..."`) and [`manifest.json`](manifest.json) (`"version": "..."`). Never bump one without the other.

---

## Architectural Principles & Rules

### 1. Neutrality (No Predefined Usage)
- **Do not hardcode presets, categories, specific games, or topics** (e.g., no GTA, no specific channels, no predefined lists).
- The extension must remain 100% agnostic and user-driven. Placeholders should be generic (e.g., `keyword, phrase`).

### 2. Zero-Dependency & Pure Vanilla JavaScript
- Do **not** introduce heavy frontend frameworks (React, Vue) or build bundlers (Vite, Webpack) unless explicitly requested by the user.
- The project is designed to be inspected, tweaked, and loaded instantly as an unpacked extension without running a build step.
- The packager in [`scripts/pack.js`](scripts/pack.js) is written in pure Node.js (`node:zlib`, `node:fs`) so that `npm run pack` works across macOS (zsh), Linux (bash), and Windows (PowerShell/CMD) without installing any npm packages.

### 3. Dual Engine Compatibility (Firefox/Gecko & Chromium)
- Maintain cross-browser compatibility at all times:
  - Gecko (Firefox, Zen Browser, Firefox Developer Edition)
  - Chromium (Google Chrome, Brave, Microsoft Edge, Opera, Vivaldi)
- In JavaScript, always use the polyfill pattern:
  ```javascript
  const browserAPI = typeof browser !== 'undefined' ? browser : chrome;
  ```
- Store data using `browserAPI.storage.sync || browserAPI.storage.local`.
- Use Promise-based storage calls (supported natively in modern Gecko and Chromium 88+).
- In [`manifest.json`](manifest.json), keep `browser_specific_settings.gecko.id` intact for Firefox/Zen; Chromium will safely ignore it.

### 4. YouTube DOM & Single Page Application (SPA) Performance
- YouTube is a heavy SPA powered by Polymer/Lit.
- Always use `requestAnimationFrame` to debounce DOM scanning. Never run un-debounced query selectors on every single DOM mutation.
- Listen to YouTube navigation events:
  ```javascript
  window.addEventListener('yt-navigate-finish', scheduleScan);
  window.addEventListener('spfdone', scheduleScan);
  ```
- Hide elements cleanly using the CSS attribute `[data-yt-banned="true"]` with `display: none !important;` so YouTube's grid flows naturally without empty placeholders.
- When inspecting YouTube cards, account for both legacy (`ytd-*`) and modern Lit components (`yt-lockup-view-model`, `ytm-shorts-lockup-view-model-v2`).

---

## Essential Commands Quick-Reference

```bash
# Verify JavaScript syntax across all scripts
node -c content/content.js popup/popup.js options/options.js scripts/pack.js

# Run automated end-to-end browser tests
npm test

# Build distributable packages (.zip for Chrome, .xpi for Firefox/Zen)
npm run pack

# Test integrity of built packages
unzip -t dist/youtube-ban-words.zip
unzip -t dist/youtube-ban-words.xpi

# Git workflow helpers
git checkout -b feature/<feature-name>
git status
git add <files>
git commit -m "feat: <description>"
```

---

## CI/CD Pipeline
- Workflow located at [`.github/workflows/release.yml`](.github/workflows/release.yml).
- Automatically triggers on `workflow_dispatch` (manual button in GitHub UI) or on pushing version tags (`v*`).
- Generates `dist/youtube-ban-words.zip` and `dist/youtube-ban-words.xpi` and creates a **draft release** with auto-generated commit notes for human review.
