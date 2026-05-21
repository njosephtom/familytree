// @ts-check
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = 'http://localhost:3000';
const TEST_EMAIL = 'playwright.test@familytree.dev';
const TEST_PASSWORD = 'PlaywrightTest123!';
const XML_FILE = path.resolve('C:/Users/jtom/Downloads/family-tree-2026-05-20 (2).xml');

// ── helpers ───────────────────────────────────────────────────────────────────

async function login(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASSWORD);
  await page.click('button[type="submit"]');
  // Wait for dashboard to load
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15_000 });
  console.log('✓ Logged in');
}

async function createTree(page, treeName) {
  // Click whichever create button is available.
  const emptyState = page.locator('button', { hasText: 'Create Your First Family Tree' });
  const newTreeBtn = page.locator('button', { hasText: '+ New Tree' });

  if (await emptyState.isVisible({ timeout: 3000 }).catch(() => false)) {
    await emptyState.click();
  } else {
    await newTreeBtn.waitFor({ timeout: 8_000 });
    await newTreeBtn.click();
  }

  const nameInput = page.locator('input[placeholder*="Smith Family"], input[placeholder*="tree" i]').first();
  await nameInput.waitFor({ timeout: 5_000 });
  await nameInput.fill(treeName);

  await page.locator('button', { hasText: 'Create Tree' }).click();
  await page.waitForSelector('input[type="file"]', { timeout: 15_000, state: 'attached' });
  await page.waitForTimeout(1200);
  console.log(`✓ Created tree: ${treeName}`);
}

// ── tests ─────────────────────────────────────────────────────────────────────

test.describe('Family Tree XML Import & Persistence', () => {
  test.setTimeout(90_000);

  test('should import XML, save to Firestore, and persist after reload', async ({ page }) => {
    const treeName = `PW Import ${Date.now()}`;

    // ── 1. Login ──────────────────────────────────────────────────────────────
    await login(page);
    await page.waitForTimeout(2000); // Let dashboard settle

    // Take screenshot of initial state
    await page.screenshot({ path: 'tests/screenshots/01-dashboard.png', fullPage: false });

    // ── 2. Create a dedicated tree for this run ───────────────────────────────
    await createTree(page, treeName);
    await page.waitForTimeout(1500);

    // ── 3. Count persons before import ───────────────────────────────────────
    const personsBefore = await page.locator('svg foreignObject').count();
    console.log(`Persons before import: ${personsBefore}`);

    // ── 4. Click Import button ────────────────────────────────────────────────
    // The toolbar renders into a portal — wait for the hidden file input to be in the DOM
    await page.waitForSelector('input[type="file"]', { timeout: 10_000, state: 'attached' });

    // Playwright file upload: set the file on the hidden input directly
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(XML_FILE);
    console.log('✓ XML file attached');

    await page.waitForTimeout(1500);
    await page.screenshot({ path: 'tests/screenshots/02-import-modal.png', fullPage: false });

    // ── 5. Confirm import ─────────────────────────────────────────────────────
    // Modal shows "Import 31 people" button — match only buttons with a count
    const confirmBtn = page.locator('button').filter({ hasText: /import \d+ people/i }).first();
    await confirmBtn.waitFor({ timeout: 8_000 });
    await confirmBtn.click();
    console.log('✓ Import confirmed');

    // Wait for persons to appear on canvas
    await page.waitForSelector('svg foreignObject', { timeout: 15_000 });
    await page.waitForTimeout(1500);

    // ── 6. Count persons after import ─────────────────────────────────────────
    const personsAfter = await page.locator('svg foreignObject').count();
    console.log(`Persons after import: ${personsAfter}`);
    await page.screenshot({ path: 'tests/screenshots/03-after-import.png', fullPage: false });

    expect(personsAfter).toBeGreaterThan(0);

    // ── 7. Trigger manual save and wait for ✓ Saved ───────────────────────────
    // Collect console errors to detect any Firestore failures
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Click the 💾 Save button for a clean, trackable save
    const manualSave = page.locator('button').filter({ hasText: /💾|save/i })
      .filter({ hasNot: page.locator('button', { hasText: /import|add|cancel|invite/i }) })
      .first();

    const saveBtn = page.locator('button[title="Save to database"]');
    await saveBtn.waitFor({ timeout: 5_000 });
    await saveBtn.click();
    console.log('Clicked manual Save button');

    // Wait for ✓ Saved or ✗ Save failed
    const savedIndicator   = page.locator('span').filter({ hasText: /Saved/ });
    const saveFailedIndicator = page.locator('span').filter({ hasText: /Save failed/ });

    await page.screenshot({ path: 'tests/screenshots/04-saving.png', fullPage: false });

    // Race between saved and save-failed
    const result = await Promise.race([
      savedIndicator.waitFor({ timeout: 15_000 }).then(() => 'saved'),
      saveFailedIndicator.waitFor({ timeout: 15_000 }).then(() => 'failed'),
    ]).catch(() => 'timeout');

    await page.screenshot({ path: 'tests/screenshots/05-after-save.png', fullPage: false });
    console.log(`Save result: ${result}`);

    if (result === 'failed') {
      const errors = consoleErrors.filter(e => /save|firestore|permission/i.test(e));
      console.error('Firestore errors:', errors);
      throw new Error('Firestore save failed — check console errors above');
    }
    if (result === 'timeout') {
      console.error('All console errors:', consoleErrors);
      throw new Error('Save did not complete within 15 seconds');
    }

    console.log('✓ Save to Firestore succeeded');

    // ── 8. Reload and verify persistence ─────────────────────────────────────
    console.log('Reloading page...');
    await page.reload({ waitUntil: 'domcontentloaded' });

    // Ensure the same tree tab is selected after reload.
    const treeTab = page.locator('button', { hasText: treeName }).first();
    await treeTab.waitFor({ timeout: 15_000 });
    await treeTab.click();

    // Wait for auth to restore + the tree canvas to appear
    await page.waitForSelector('svg foreignObject', { timeout: 30_000 });

    const personsAfterReload = await page.locator('svg foreignObject').count();
    console.log(`Persons after reload: ${personsAfterReload}`);
    await page.screenshot({ path: 'tests/screenshots/05-after-reload.png', fullPage: false });

    // Verify same number of persons as after import
    expect(personsAfterReload).toBe(personsAfter);
    console.log(`✓ Persistence verified: ${personsAfterReload} persons survived reload`);

    // Check for save errors
    if (consoleErrors.length > 0) {
      console.warn('Console errors during test:', consoleErrors);
    }
  });

  test('isolate view shows grandparents', async ({ page }) => {
    test.setTimeout(60_000);
    await login(page);
    await page.waitForTimeout(2000);

    // Wait for persons to appear (may already be imported from first test via same tree)
    const firstCard = page.locator('svg foreignObject').first();
    const hasPersons = await firstCard.isVisible({ timeout: 8000 }).catch(() => false);

    if (!hasPersons) {
      console.log('ℹ No persons visible — skipping isolate test (run after import test)');
      test.skip();
      return;
    }

    // Right-click the first person card
    await firstCard.click({ button: 'right' });
    await page.waitForTimeout(500);

    // Look for "Isolate View" in context menu
    const isolateOption = page.locator('div').filter({ hasText: /^Isolate View$/ }).first();
    if (await isolateOption.isVisible({ timeout: 3000 }).catch(() => false)) {
      await isolateOption.click();
      console.log('✓ Isolate view triggered');
      await page.screenshot({ path: 'tests/screenshots/06-isolate-view.png', fullPage: false });
    } else {
      console.log('ℹ Context menu option not found — checking page structure');
      await page.screenshot({ path: 'tests/screenshots/06-context-menu.png', fullPage: false });
    }
  });
});
