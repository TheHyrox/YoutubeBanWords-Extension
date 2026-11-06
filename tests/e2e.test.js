/**
 * Automated End-to-End Test Suite for YouTube Ban Words Extension
 * Uses Playwright to launch Chromium with the unpacked extension,
 * tests the Options page, Popup UI, and live YouTube DOM filtering.
 */

const { chromium } = require('playwright-core');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const assert = require('node:assert/strict');

const ROOT_DIR = path.resolve(__dirname, '..');

// Helper for test assertions and reporting
let passedTests = 0;
let totalTests = 0;

async function runTest(name, fn) {
  totalTests++;
  process.stdout.write(`  • ${name}... `);
  try {
    await fn();
    console.log('\x1b[32mPASSED\x1b[0m');
    passedTests++;
  } catch (err) {
    console.log('\x1b[31mFAILED\x1b[0m');
    console.error('    Error:', err.message);
    throw err;
  }
}

async function main() {
  console.log('\n🚀 Starting YouTube Ban Words End-to-End Browser Tests\n');

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-ban-test-'));

  const context = await chromium.launchPersistentContext(tmpDir, {
    channel: 'chromium',
    headless: false,
    args: [
      `--disable-extensions-except=${ROOT_DIR}`,
      `--load-extension=${ROOT_DIR}`,
      '--no-first-run',
      '--no-default-browser-check'
    ]
  });

  try {
    // 1. Locate extension ID via chrome://extensions
    let extId = null;
    await runTest('Detect unpacked extension in browser', async () => {
      const page = await context.newPage();
      await page.goto('chrome://extensions');
      await page.waitForTimeout(500);

      extId = await page.evaluate(() => {
        const mgr = document.querySelector('extensions-manager');
        const list = mgr?.shadowRoot?.querySelector('extensions-item-list');
        const items = list?.shadowRoot?.querySelectorAll('extensions-item') || [];
        for (const item of items) {
          if (item.shadowRoot?.querySelector('#name')?.textContent.includes('YouTube Ban Words')) {
            return item.id;
          }
        }
        return null;
      });

      assert.ok(extId, 'Extension ID could not be located in browser');
      await page.close();
    });

    // 2. Test Options Page UI & Word Addition
    await runTest('Options Page: Add keywords and save settings', async () => {
      const optPage = await context.newPage();
      await optPage.goto(`chrome-extension://${extId}/options/options.html`);

      const title = await optPage.title();
      assert.match(title, /YouTube Ban Words/);

      // Add keywords
      await optPage.fill('#wordsInput', 'Clickbait, SpoilerAlert, UnwantedCreator');
      await optPage.click('#addBtn');
      await optPage.waitForTimeout(400);

      const count = await optPage.textContent('#totalWordsCount');
      assert.equal(count.trim(), '3');

      // Check rendered tags
      const tags = await optPage.$$eval('.word-tag span', els => els.map(e => e.textContent));
      assert.deepEqual(tags, ['Clickbait', 'SpoilerAlert', 'UnwantedCreator']);

      await optPage.close();
    });

    // 3. Test Popup UI and Quick-Add
    await runTest('Popup UI: Inspect stats and quick-add keyword', async () => {
      const popupPage = await context.newPage();
      await popupPage.goto(`chrome-extension://${extId}/popup/popup.html`);

      const wordsCount = await popupPage.textContent('#wordsCount');
      assert.equal(wordsCount.trim(), '3');

      // Add a 4th word from popup
      await popupPage.fill('#quickWordInput', 'ViralPrank');
      await popupPage.click('#quickAddBtn');
      await popupPage.waitForTimeout(400);

      const newWordsCount = await popupPage.textContent('#wordsCount');
      assert.equal(newWordsCount.trim(), '4');

      await popupPage.close();
    });

    // 4. Test YouTube DOM Filtering
    const ytPage = await context.newPage();

    // Mock YouTube page with diverse cards
    await ytPage.route('https://www.youtube.com/**', route => {
      route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: `
          <!DOCTYPE html>
          <html>
          <head><title>YouTube</title></head>
          <body>
            <div id="contents">
              <!-- Card 1: Matches title 'Clickbait' -->
              <ytd-rich-item-renderer id="card1">
                <span id="video-title">Top 10 Clickbait Secrets You Must See</span>
                <div id="channel-name">Good Channel</div>
              </ytd-rich-item-renderer>

              <!-- Card 2: Clean card -->
              <ytd-rich-item-renderer id="card2">
                <span id="video-title">Learn Rust Programming in 2026</span>
                <div id="channel-name">Code Mentor</div>
              </ytd-rich-item-renderer>

              <!-- Card 3: Matches channel 'UnwantedCreator' -->
              <ytd-rich-item-renderer id="card3">
                <span id="video-title">Daily Vlog #402</span>
                <div id="channel-name">UnwantedCreator</div>
              </ytd-rich-item-renderer>

              <!-- Card 4: Matches quick-added word 'ViralPrank' -->
              <ytd-rich-item-renderer id="card4">
                <span id="video-title">Insane ViralPrank in Public</span>
                <div id="channel-name">Prankster</div>
              </ytd-rich-item-renderer>
            </div>
          </body>
          </html>
        `
      });
    });

    await runTest('Content Script: Filter video titles, channels, and popup-added words', async () => {
      await ytPage.goto('https://www.youtube.com');
      await ytPage.waitForTimeout(600);

      const card1 = await ytPage.$eval('#card1', el => el.getAttribute('data-yt-banned'));
      const card2 = await ytPage.$eval('#card2', el => el.getAttribute('data-yt-banned'));
      const card3 = await ytPage.$eval('#card3', el => el.getAttribute('data-yt-banned'));
      const card4 = await ytPage.$eval('#card4', el => el.getAttribute('data-yt-banned'));

      assert.equal(card1, 'true', 'Card 1 (Title: Clickbait) should be banned');
      assert.equal(card2, null, 'Card 2 (Clean content) should remain visible');
      assert.equal(card3, 'true', 'Card 3 (Channel: UnwantedCreator) should be banned');
      assert.equal(card4, 'true', 'Card 4 (Title: ViralPrank) should be banned');
    });

    // 5. Test Dynamic DOM Mutations (Infinite Scroll simulation)
    await runTest('Content Script: Debounced MutationObserver filters dynamically injected cards', async () => {
      await ytPage.evaluate(() => {
        const container = document.getElementById('contents');
        const newCard = document.createElement('ytd-rich-item-renderer');
        newCard.id = 'dynamicCard';
        newCard.innerHTML = `
          <span id="video-title">Another SpoilerAlert Video</span>
          <div id="channel-name">Streamer</div>
        `;
        container.appendChild(newCard);
      });

      // Wait for debounced mutation observer to scan
      await ytPage.waitForTimeout(300);

      const dynamicBanned = await ytPage.$eval('#dynamicCard', el => el.getAttribute('data-yt-banned'));
      assert.equal(dynamicBanned, 'true', 'Dynamically added card matching SpoilerAlert should be banned');
    });

    // 6. Test Pause/Disable Toggle
    await runTest('Popup Toggle: Disabling filter immediately unhides all elements', async () => {
      const popupPage = await context.newPage();
      await popupPage.goto(`chrome-extension://${extId}/popup/popup.html`);

      // Uncheck filter toggle
      await popupPage.click('.switch .slider');
      await popupPage.waitForTimeout(400);

      // Verify YouTube page immediately restores cards without reload
      await ytPage.waitForTimeout(300);
      const card1 = await ytPage.$eval('#card1', el => el.getAttribute('data-yt-banned'));
      const card3 = await ytPage.$eval('#card3', el => el.getAttribute('data-yt-banned'));

      assert.equal(card1, null, 'Card 1 should be unbanned after filter paused');
      assert.equal(card3, null, 'Card 3 should be unbanned after filter paused');

      // Re-enable for subsequent tests
      await popupPage.click('.switch .slider');
      await popupPage.waitForTimeout(400);
      await popupPage.close();
    });

    await ytPage.close();

    console.log(`\n\x1b[32m✨ All ${passedTests}/${totalTests} End-to-End Tests Passed Successfully!\x1b[0m\n`);
  } finally {
    await context.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

main().catch(err => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
