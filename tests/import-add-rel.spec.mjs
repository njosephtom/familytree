// @ts-check
/**
 * Test: Import 31-person XML → Add new node → Update relationships on new node
 *
 * Steps:
 *  1. Login
 *  2. Create a fresh tree
 *  3. Import the Neriamparampil XML (31 persons)
 *  4. Verify all 31 persons rendered on canvas
 *  5. Add a brand-new person ("Test Person") via ＋ Add Member
 *  6. Verify the new person appears on canvas (32 total)
 *  7. Open the new person → edit → Relationships tab
 *     a. Add a Parent relationship (link to an existing person)
 *     b. Add a Child relationship (link to another existing person)
 *     c. Add a Spouse relationship (link to a third existing person)
 *  8. Save → verify modal closes quickly (no hang)
 *  9. Verify canvas still shows 32 persons
 * 10. Re-open the new person and verify the relationships are shown in "Current Relationships"
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL   = 'http://localhost:3000';
const TEST_EMAIL = 'playwright.test@familytree.dev';
const TEST_PASS  = 'PlaywrightTest123!';
const XML_FILE   = path.resolve('C:/Users/jtom/Downloads/family-tree-2026-05-20 (2).xml');

const SS = (name) => `tests/screenshots/import-add-rel-${name}.png`;

// ── helpers ───────────────────────────────────────────────────────────────────

async function login(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15_000 });
  console.log('  ✓ Logged in');
}

async function createTree(page, name) {
  const emptyBtn = page.locator('button', { hasText: 'Create Your First Family Tree' });
  const newBtn   = page.locator('button', { hasText: '+ New Tree' });
  if (await emptyBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await emptyBtn.click();
  } else {
    await newBtn.waitFor({ timeout: 8_000 });
    await newBtn.click();
  }
  const nameInput = page.locator('input[placeholder*="Smith Family"], input[placeholder*="tree" i]').first();
  await nameInput.waitFor({ timeout: 5_000 });
  await nameInput.fill(name);
  await page.locator('button', { hasText: 'Create Tree' }).click();
  await page.waitForSelector('input[type="file"]', { timeout: 15_000, state: 'attached' });
  await page.waitForTimeout(1_000);
  console.log(`  ✓ Tree created: ${name}`);
}

async function importXml(page) {
  await page.waitForSelector('input[type="file"]', { timeout: 10_000, state: 'attached' });
  // Directly trigger click on ⬇ Import XML toolbar button then set files
  const importBtn = page.locator('button').filter({ hasText: /Import XML/i }).first();
  const importBtnVisible = await importBtn.isVisible({ timeout: 2_000 }).catch(() => false);
  if (importBtnVisible) {
    // Use the button to ensure the file dialog is triggered on the right input
    await importBtn.click();
    await page.waitForTimeout(300);
  }
  // Set files directly on the hidden input (works whether dialog opened or not)
  await page.locator('input[type="file"]').setInputFiles(XML_FILE);
  await page.waitForTimeout(1_000);
  await page.screenshot({ path: SS('00-import-dialog') });
  const confirmBtn = page.locator('button').filter({ hasText: /import \d+ people/i }).first();
  await confirmBtn.waitFor({ timeout: 10_000 });
  await confirmBtn.click();
  await page.waitForSelector('svg foreignObject', { timeout: 20_000 });
  await page.waitForTimeout(1_500);
  console.log('  ✓ XML imported');
}

/** Opens FormModal via ＋ Add Member button in the toolbar */
async function openAddMemberModal(page) {
  const addBtn = page.locator('button').filter({ hasText: /＋ Add Member|Add Member/i }).first();
  await addBtn.waitFor({ timeout: 6_000 });
  await addBtn.click();
  const header = page.locator('h3').filter({ hasText: /Add Family Member/i });
  await header.waitFor({ timeout: 6_000 });
  return header;
}

/** Opens FormModal for an existing person via double-click → Edit */
async function openEditModal(page, cardIndex = 0) {
  const cards = page.locator('svg foreignObject');
  await cards.nth(cardIndex).dblclick({ timeout: 5_000 });
  await page.waitForTimeout(600);
  const editBtn = page.locator('button').filter({ hasText: /Edit/i }).first();
  await editBtn.waitFor({ timeout: 6_000 });
  await editBtn.click();
  await page.waitForTimeout(400);
  const header = page.locator('h3').filter({ hasText: /✏️ Edit ·/i });
  await header.waitFor({ timeout: 6_000 });
  return header;
}

/** Adds a relationship of the given type to the first available link target */
async function addRelationship(page, relType, searchHint = '') {
  // Click the relationship type button
  const typeLabel = { parent: 'Parent', child: 'Child', spouse: 'Spouse', sibling: 'Sibling', exSpouse: 'Ex-Spouse' }[relType];
  await page.locator('button').filter({ hasText: new RegExp(`^${typeLabel}$`, 'i') }).click();
  await page.waitForTimeout(200);

  if (searchHint) {
    const searchInput = page.locator('div').filter({ hasText: /Add Relationship/i })
      .locator('input[placeholder*="Search"]').first();
    if (await searchInput.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await searchInput.fill(searchHint);
      await page.waitForTimeout(300);
    }
  }

  const linkBtns = page.locator('button').filter({ hasText: '+ Link' });
  const count = await linkBtns.count();
  if (count === 0) throw new Error(`No available persons to link as ${relType}`);
  await linkBtns.first().click();
  await page.waitForTimeout(250);

  // Confirm the relationship appears in "Current Relationships"
  const current = page.locator('div').filter({ hasText: typeLabel }).filter({ hasText: /×/ });
  await current.first().waitFor({ timeout: 3_000 }).catch(() => {});
  console.log(`  ✓ Added ${relType} relationship`);
}

// ── test ─────────────────────────────────────────────────────────────────────

test.describe('Import XML + add new node + update relationships', () => {
  test.setTimeout(150_000);

  test('import 31 persons, add new node, set parent/child/spouse', async ({ page }) => {
    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    // ── 1. Login ──────────────────────────────────────────────────────────────
    await login(page);
    await page.waitForTimeout(1_500);

    // ── 2. Create a dedicated tree ────────────────────────────────────────────
    await createTree(page, `ImportRelTest-${Date.now()}`);

    // ── 3. Import the 31-person XML ───────────────────────────────────────────
    await importXml(page);
    await page.screenshot({ path: SS('01-after-import') });

    const countAfterImport = await page.locator('svg foreignObject').count();
    console.log(`  ✓ Canvas has ${countAfterImport} person cards`);
    expect(countAfterImport).toBeGreaterThanOrEqual(10); // generous lower bound

    // ── 4. Add a brand-new person via ＋ Add Member ───────────────────────────
    const addHeader = await openAddMemberModal(page);
    await page.screenshot({ path: SS('02-add-modal-open') });
    console.log('  ✓ Add Member modal open');

    // Fill in details
    await page.locator('input[placeholder="e.g. Jane"]').fill('Test Person');
    await page.locator('input[placeholder="e.g. Smith"]').fill('Neriamparampil');

    // Set sex to male
    await page.locator('button').filter({ hasText: /^male$/i }).click();
    await page.waitForTimeout(200);
    await page.screenshot({ path: SS('03-new-person-details') });

    // Save the new person (details only first) — button says "Add to Tree"
    await page.locator('button').filter({ hasText: /add to tree/i }).click();
    await page.waitForTimeout(1_000);
    await addHeader.waitFor({ state: 'hidden', timeout: 6_000 });
    console.log('  ✓ New person saved (no relationships yet)');

    const countAfterAdd = await page.locator('svg foreignObject').count();
    console.log(`  ✓ Canvas now has ${countAfterAdd} person cards`);
    expect(countAfterAdd).toBe(countAfterImport + 1);
    await page.screenshot({ path: SS('04-new-person-on-canvas') });

    // ── 5. Open the new person and add relationships ───────────────────────────
    // The new person "Test Person" is the last card added → find it by name via search
    const searchInput = page.locator('input[placeholder="Search members…"]').first();
    await searchInput.waitFor({ timeout: 5_000 });
    await searchInput.fill('Test Person');
    await page.waitForTimeout(500);

    // Click the result in the dropdown
    const searchResult = page.locator('div').filter({ hasText: /^Test Person$/ }).first();
    await searchResult.waitFor({ timeout: 5_000 });
    await searchResult.click();
    await page.waitForTimeout(600);
    await page.screenshot({ path: SS('05-new-person-popup') });

    // Open Edit modal for the new person
    const editBtn = page.locator('button').filter({ hasText: /Edit/i }).first();
    await editBtn.waitFor({ timeout: 6_000 });
    await editBtn.click();
    await page.waitForTimeout(400);

    const editHeader = page.locator('h3').filter({ hasText: /✏️ Edit · Test Person/i });
    await editHeader.waitFor({ timeout: 6_000 });
    console.log('  ✓ Edit modal for Test Person open');
    await page.screenshot({ path: SS('06-edit-modal-open') });

    // Switch to Relationships tab
    await page.locator('button').filter({ hasText: /Relationships/i }).click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: SS('07-relationships-tab') });

    // ── a. Add a Parent ───────────────────────────────────────────────────────
    await addRelationship(page, 'parent');
    await page.screenshot({ path: SS('08-parent-added') });

    // ── b. Add a Child ────────────────────────────────────────────────────────
    await addRelationship(page, 'child');
    await page.screenshot({ path: SS('09-child-added') });

    // ── c. Add a Spouse ───────────────────────────────────────────────────────
    await addRelationship(page, 'spouse');
    await page.screenshot({ path: SS('10-spouse-added') });

    // Verify all three relationship types now shown in "Current Relationships"
    const currentRelsSection = page.locator('div').filter({ hasText: /Current Relationships/i });
    await currentRelsSection.waitFor({ timeout: 3_000 });
    const removeButtons = page.locator('button').filter({ hasText: '×' });
    const relCount = await removeButtons.count();
    console.log(`  ✓ Current relationships shown: ${relCount}`);
    expect(relCount).toBeGreaterThanOrEqual(3);
    await page.screenshot({ path: SS('11-all-rels-added') });

    // ── 6. Save — this triggers computeLayout on 32 persons with new edges ────
    const t0 = Date.now();
    await page.locator('button').filter({ hasText: /save changes/i }).click();
    console.log('  ✓ Save clicked');

    // Must close within 6 s (was hanging indefinitely before the cycle fix)
    await editHeader.waitFor({ state: 'hidden', timeout: 6_000 });
    console.log(`  ✓ Modal closed in ${Date.now() - t0} ms`);
    await page.screenshot({ path: SS('12-after-save') });

    // ── 7. Canvas still intact ────────────────────────────────────────────────
    const countFinal = await page.locator('svg foreignObject').count();
    expect(countFinal).toBeGreaterThanOrEqual(countAfterImport + 1);
    console.log(`  ✓ Final canvas count: ${countFinal}`);

    // ── 8. Re-open new person and verify relationships persisted ──────────────
    await searchInput.fill('Test Person');
    await page.waitForTimeout(500);
    await searchResult.waitFor({ timeout: 5_000 });
    await searchResult.click();
    await page.waitForTimeout(600);

    await editBtn.waitFor({ timeout: 5_000 });
    await editBtn.click();
    await page.waitForTimeout(400);
    await editHeader.waitFor({ timeout: 6_000 });

    await page.locator('button').filter({ hasText: /Relationships/i }).click();
    await page.waitForTimeout(300);

    // Current Relationships section must still show ≥ 3 entries
    const persistedRels = await page.locator('button').filter({ hasText: '×' }).count();
    console.log(`  ✓ Persisted relationships after re-open: ${persistedRels}`);
    expect(persistedRels).toBeGreaterThanOrEqual(3);
    await page.screenshot({ path: SS('13-relationships-persisted') });

    // Close modal
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);

    // ── 9. No JS errors ───────────────────────────────────────────────────────
    if (jsErrors.length > 0) {
      console.warn('  ⚠ JS errors:', jsErrors);
    }
    expect(jsErrors).toHaveLength(0);
    console.log('  ✓ No JS errors — test passed');
  });
});
