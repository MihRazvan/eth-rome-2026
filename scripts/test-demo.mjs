// SPDX-License-Identifier: MIT
// Local UI acceptance: real browser encryption, explicitly simulated settlement.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir = '.runtime/verification/demo';
await mkdir(dir, { recursive: true });
const server = await createServer({ configFile: 'vite.config.ts', server: { host: '127.0.0.1', port: 18920, strictPort: true } });
await server.listen();
const browser = await chromium.launch();
const errors = [], checks = [];
try {
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/config', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
    await page.goto('http://127.0.0.1:18920/');
    await page.locator('#dd-home').waitFor();
    await page.evaluate(() => document.fonts.ready);
    assert.match(await page.title(), /Deaddrop/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.locator('.dd-demo-link').click();
    await page.locator('#cd-title').fill('Verify a payment boundary');
    await page.locator('#cd-budget').fill('12.50');
    await page.locator('[data-demo-form] button').click();
    await page.locator('[data-demo="fund"]').click();
    await page.locator('[data-demo-valid]').uncheck();
    await page.locator('[data-demo="qualify"]').click();
    assert.match(await page.locator('.cd-message').textContent(), /expired|revoked|valid/i);
    await page.locator('[data-demo-valid]').check();
    await page.locator('[data-demo="qualify"]').click();
    const report = 'Deaddrop ✓\nOnly the client can approve. <script>plain text</script>';
    await page.locator('#cd-report').fill(report);
    await page.locator('[data-demo-form] button').click();
    await page.locator('[data-demo-ciphertext]').waitFor({ state: 'attached' });
    assert.equal(await page.locator('.cd-approve').isVisible(), false);
    await page.locator('[data-demo="open"]').focus();
    await page.keyboard.press('Enter');
    await page.locator('.cd-opened').waitFor();
    assert.equal(await page.locator('[data-demo-plaintext]').textContent(), report);
    await page.locator('[data-demo="approve"]').click();
    assert.match(await page.locator('.cd-receipt').textContent(), /Simulated/);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `${dir}/receipt-${width}.png`, fullPage: true });
    await page.locator('[data-demo="restart"]').click();
    await page.locator('#cd-title').waitFor();
    checks.push(`${width}px: entry, rejected invalid demo eligibility, exact encryption/decryption, simulated payment, restart; no overflow`);
    await page.close();
  }
  assert.deepEqual(errors, []);
  await writeFile(`${dir}/result.json`, JSON.stringify({ checks, errors, scope: 'Local browser walkthrough. No chain/storage writes or live proof.' }, null, 2) + '\n');
  console.log(`Deaddrop browser demo: ${checks.length} viewport checks passed.`);
} finally { await browser.close(); await server.close(); }
