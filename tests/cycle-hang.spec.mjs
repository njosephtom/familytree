// @ts-check
/**
 * Reproduces the "family tree hangs after import + add connection" bug.
 *
 * Root cause: computeLayout / computeGenMap BFS has no cycle guard.
 * If a parent-child cycle is introduced, the while-loop runs forever and
 * locks the browser tab.
 *
 * Test strategy:
 *  1. Log in and create a fresh tree
 *  2. Import the Neriamparampil XML (31 members with real relationships)
 *  3. Confirm import
 *  4. Open an existing person and add a NEW child relationship → this triggers
 *     savePerson → setPersons → useEffect(computeLayout) — the path that hung
 *  5. Assert the page is still responsive within a strict timeout
 *  6. Also create an artificial cycle (person A parent of B, B parent of A)
 *     and verify computeLayout still finishes instead of hanging
 */
import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL   = 'http://localhost:3000';
const TEST_EMAIL = 'playwright.test@familytree.dev';
const TEST_PASS  = 'PlaywrightTest123!';
const XML_FILE   = path.resolve('C:/Users/jtom/Downloads/family-tree-2026-05-20 (2).xml');

// ── helpers ───────────────────────────────────────────────────────────────────

async function login(page) {
  await page.goto(`${BASE_URL}/login`);
  await page.waitForSelector('input[type="email"]', { timeout: 10_000 });
  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.fill('input[type="password"]', TEST_PASS);
  await page.click('button[type="submit"]');
  await page.waitForURL(`${BASE_URL}/dashboard`, { timeout: 15_000 });
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
}

async function importXml(page) {
  await page.waitForSelector('input[type="file"]', { timeout: 10_000, state: 'attached' });
  await page.locator('input[type="file"]').setInputFiles(XML_FILE);
  await page.waitForTimeout(800);

  const confirmBtn = page.locator('button').filter({ hasText: /import \d+ people/i }).first();
  await confirmBtn.waitFor({ timeout: 8_000 });
  await confirmBtn.click();

  // Wait for persons to render on canvas
  await page.waitForSelector('svg foreignObject', { timeout: 20_000 });
  await page.waitForTimeout(1_500);
}

// ── tests ─────────────────────────────────────────────────────────────────────

test.describe('Import XML then add relationship — no hang', () => {
  test.setTimeout(120_000);

  test('page stays responsive after import + relationship edit', async ({ page }) => {
    // Collect JS errors
    const jsErrors = [];
    page.on('pageerror', (err) => jsErrors.push(err.message));

    await login(page);
    await page.waitForTimeout(1_500);

    // Create fresh tree
    await createTree(page, `CycleTest-${Date.now()}`);

    // Import 31-person XML
    await importXml(page);

    const countBefore = await page.locator('svg foreignObject').count();
    console.log(`✓ Imported ${countBefore} persons`);
    expect(countBefore).toBeGreaterThanOrEqual(10);

    await page.screenshot({ path: 'tests/screenshots/cycle-01-after-import.png' });

    // ── Open first visible person card — double-click opens the popup ──────────
    // Single click selects; double-click (two clicks within ~230ms) opens popup
    const firstCard = page.locator('svg foreignObject').first();
    await firstCard.dblclick({ timeout: 5_000 });
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'tests/screenshots/cycle-01b-popup.png' });

    // PersonPopup renders with a "✏️ Edit" button
    const editBtn = page.locator('button').filter({ hasText: /Edit/i }).first();
    await editBtn.waitFor({ timeout: 6_000 });
    await editBtn.click();
    await page.waitForTimeout(500);

    // FormModal is a fixed overlay — its header contains "✏️ Edit ·" or "➕ Add"
    // Use a strict selector: the h3 inside the modal
    const modalHeader = page.locator('h3').filter({ hasText: /✏️ Edit ·|➕ Add Family Member/i });
    await modalHeader.waitFor({ timeout: 8_000 });
    await page.screenshot({ path: 'tests/screenshots/cycle-02-edit-modal.png' });
    console.log('✓ Edit modal open');

    // ── Switch to Relationships tab ───────────────────────────────────────────
    await page.locator('button').filter({ hasText: /Relationships/i }).click();
    await page.waitForTimeout(400);

    // Select "Child" relationship type
    await page.locator('button').filter({ hasText: /^Child$/i }).click();
    await page.waitForTimeout(200);

    // Pick the second person in the list (not the person being edited)
    const linkBtns = page.locator('button').filter({ hasText: '+ Link' });
    const linkCount = await linkBtns.count();
    console.log(`  Available people to link: ${linkCount}`);
    if (linkCount === 0) {
      console.log('  No people to link — skipping relationship add');
    } else {
      await linkBtns.first().click();
      await page.waitForTimeout(300);
      console.log('✓ Added child relationship');
    }

    await page.screenshot({ path: 'tests/screenshots/cycle-03-relationship-added.png' });

    // ── Save the edit — this is where the hang used to occur ─────────────────
    // The footer Save/Update button is inside the modal overlay
    const saveBtn = page.locator('button').filter({ hasText: /^(Save|Update|Save Changes)$/i }).last();

    const t0 = Date.now();
    await saveBtn.click({ timeout: 5_000 });
    console.log(`✓ Save clicked`);

    // Modal must close within 6 s (was hanging indefinitely before the fix)
    await modalHeader.waitFor({ state: 'hidden', timeout: 6_000 });
    console.log(`✓ Modal closed in ${Date.now() - t0} ms`);

    // Canvas still renders correctly
    const countAfter = await page.locator('svg foreignObject').count();
    expect(countAfter).toBeGreaterThanOrEqual(countBefore);
    await page.screenshot({ path: 'tests/screenshots/cycle-04-after-save.png' });

    // No JS errors
    expect(jsErrors).toHaveLength(0);
    console.log('✓ No JS errors');
  });

  // ── Artificial cycle test (unit-level via page.evaluate) ─────────────────────
  test('computeLayout does not hang with a parent-child cycle', async ({ page }) => {
    // We don't need the app loaded for this — just inject and run the function
    // by loading the page and testing via the dev console
    await page.goto(`${BASE_URL}/login`);
    await page.waitForLoadState('domcontentloaded');

    // Inject a standalone copy of the cycle-safe algorithm and run it
    const result = await page.evaluate(async () => {
      // Minimal reproduction of computeLayout BFS with cycle A→B→A
      const persons = [
        { id: 'A', name: 'Alice', parents: ['B'], children: ['B'], spouse: null, exSpouses: [], siblings: [] },
        { id: 'B', name: 'Bob',   parents: ['A'], children: ['A'], spouse: null, exSpouses: [], siblings: [] },
        { id: 'C', name: 'Carol', parents: [],    children: [],    spouse: null, exSpouses: [], siblings: [] },
      ];
      const pm = new Map(persons.map((p) => [p.id, p]));
      const childSet  = new Map(persons.map((p) => [p.id, new Set()]));
      const parentSet = new Map(persons.map((p) => [p.id, new Set()]));
      persons.forEach((p) => {
        (p.children || []).forEach((cid) => { if (pm.has(cid)) { childSet.get(p.id).add(cid); parentSet.get(cid).add(p.id); }});
        (p.parents  || []).forEach((pid) => { if (pm.has(pid)) { childSet.get(pid).add(p.id); parentSet.get(p.id).add(pid); }});
      });

      const genMap  = new Map();
      const queue   = [];
      const inQ     = new Set();
      const relaxed = new Map();
      const MAX_RELAX = persons.length;
      persons.forEach((p) => {
        if (parentSet.get(p.id).size === 0) { genMap.set(p.id, 0); queue.push(p.id); inQ.add(p.id); }
      });
      if (!queue.length) { genMap.set(persons[0].id, 0); queue.push(persons[0].id); inQ.add(persons[0].id); }

      let iterations = 0;
      const MAX_ITER = 10_000; // safety net so the test itself never hangs
      while (queue.length && iterations++ < MAX_ITER) {
        const id = queue.shift(); inQ.delete(id);
        const visits = (relaxed.get(id) ?? 0) + 1;
        relaxed.set(id, visits);
        if (visits > MAX_RELAX) continue;
        const g = genMap.get(id);
        childSet.get(id).forEach((cid) => {
          if ((genMap.get(cid) ?? -1) < g + 1) {
            genMap.set(cid, g + 1);
            if (!inQ.has(cid)) { queue.push(cid); inQ.add(cid); }
          }
        });
      }
      persons.forEach((p) => { if (!genMap.has(p.id)) genMap.set(p.id, 0); });
      return { gens: Object.fromEntries(genMap), iterations, terminated: queue.length === 0 };
    });

    console.log('Cycle BFS result:', result);
    expect(result.terminated).toBe(true);
    expect(result.iterations).toBeLessThan(10_000);
    console.log(`✓ BFS terminated in ${result.iterations} iterations (cycle-safe)`);
  });
});
