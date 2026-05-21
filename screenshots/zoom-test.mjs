import { chromium } from 'playwright';

const BASE  = 'http://localhost:3001';
const EMAIL = 'playwright.test@familytree.dev';
const PASS  = 'PlaywrightTest123!';

const browser = await chromium.launch({ headless: false, slowMo: 200 });
const page    = await browser.newPage();
await page.setViewportSize({ width: 1400, height: 860 });

const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGE ERROR: ' + e.message));

// ── Login ─────────────────────────────────────────────────────────────────────
console.log('1. Logging in...');
await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 20000 });
await page.fill('input[type="email"]', EMAIL);
await page.fill('input[type="password"]', PASS);
await page.click('button[type="submit"]');
await page.waitForURL(`${BASE}/dashboard`, { timeout: 20000 });
console.log('   ✓ Logged in');

// ── Switch to a tree that has members ─────────────────────────────────────────
console.log('2. Looking for a tree with members...');
await page.waitForTimeout(3000); // wait for lazy FamilyTreeApp to load

// Try PW Import tree first (has members from previous imports)
const importTab = page.locator('button', { hasText: /PW Import/ }).first();
if (await importTab.isVisible({ timeout: 3000 }).catch(() => false)) {
  await importTab.click();
  await page.waitForTimeout(2500);
  console.log('   ✓ Clicked PW Import tree');
} else {
  // Fall back to Playwright Test Tree
  const treeTabs = await page.locator('button', { hasText: 'Playwright Test Tree' }).all();
  if (treeTabs.length > 0) {
    await treeTabs[0].click();
    await page.waitForTimeout(2500);
    console.log('   ✓ Clicked Playwright Test Tree');
  }
}

// Wait for FamilyTreeApp to finish lazy loading
await page.waitForFunction(() => {
  const loading = document.body.innerText.includes('Loading…');
  return !loading;
}, { timeout: 10000 }).catch(() => console.log('   (still showing Loading…)'));
await page.waitForTimeout(1000);

const memberCount = await page.locator('text=/\\d+ members/').first().textContent().catch(() => '? members');

await page.screenshot({ path: 'screenshots/zoom-01-before.png' });
console.log('   Screenshot: zoom-01-before.png');

// ── Get initial zoom state from SVG transform ─────────────────────────────────
async function getTransform() {
  return page.evaluate(() => {
    const g = document.querySelector('svg g[transform]');
    return g ? g.getAttribute('transform') : null;
  });
}

async function extractScale(transform) {
  if (!transform) return null;
  const m = transform.match(/scale\(([^)]+)\)/);
  return m ? parseFloat(m[1]) : null;
}

const t0 = await getTransform();
const scale0 = await extractScale(t0);
console.log(`\n3. Initial SVG transform: ${t0}`);
console.log(`   Initial scale: ${scale0}`);

// ── Test + button ─────────────────────────────────────────────────────────────
console.log('\n4. Clicking + (zoom in)...');
const plusBtn = page.locator('[data-testid="zoom-in"]').first();
await plusBtn.waitFor({ timeout: 5000 });

for (let i = 0; i < 3; i++) {
  await plusBtn.click();
  await page.waitForTimeout(300);
}

const t1 = await getTransform();
const scale1 = await extractScale(t1);
console.log(`   After 3x +: scale=${scale1}`);
await page.screenshot({ path: 'screenshots/zoom-02-zoomed-in.png' });

if (scale1 !== null && scale0 !== null) {
  if (scale1 > scale0) console.log('   ✅ + button WORKS (scale increased)');
  else                 console.log('   ❌ + button NOT WORKING (scale unchanged)');
} else {
  console.log('   ⚠️  Could not read scale from SVG transform');
}

// ── Test - button ─────────────────────────────────────────────────────────────
console.log('\n5. Clicking - (zoom out)...');
const minusBtn = page.locator('[data-testid="zoom-out"]').first();
await minusBtn.waitFor({ timeout: 5000 });

for (let i = 0; i < 5; i++) {
  await minusBtn.click();
  await page.waitForTimeout(300);
}

const t2 = await getTransform();
const scale2 = await extractScale(t2);
console.log(`   After 5x -: scale=${scale2}`);
await page.screenshot({ path: 'screenshots/zoom-03-zoomed-out.png' });

if (scale2 !== null && scale1 !== null) {
  if (scale2 < scale1) console.log('   ✅ - button WORKS (scale decreased)');
  else                 console.log('   ❌ - button NOT WORKING (scale unchanged)');
}

// ── Test scroll-wheel zoom ────────────────────────────────────────────────────
console.log('\n6. Testing scroll-wheel zoom...');
const canvas = page.locator('svg').first();
await canvas.waitFor({ timeout: 5000 });

const box = await canvas.boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;

// Scroll up (zoom in)
await page.mouse.move(cx, cy);
await page.mouse.wheel(0, -300);
await page.waitForTimeout(500);

const t3 = await getTransform();
const scale3 = await extractScale(t3);
console.log(`   After scroll up: scale=${scale3}`);

if (scale3 !== null && scale2 !== null) {
  if (scale3 > scale2) console.log('   ✅ Scroll-wheel zoom IN works');
  else                 console.log('   ❌ Scroll-wheel zoom NOT responding');
}

await page.mouse.wheel(0, 400);
await page.waitForTimeout(500);
const t4 = await getTransform();
const scale4 = await extractScale(t4);
console.log(`   After scroll down: scale=${scale4}`);
await page.screenshot({ path: 'screenshots/zoom-04-scroll-zoom.png' });

// ── Reset ─────────────────────────────────────────────────────────────────────
console.log('\n7. Testing Reset button...');
const resetBtn = page.locator('button', { hasText: 'Reset' }).first();
await resetBtn.click();
await page.waitForTimeout(600);
const tR = await getTransform();
const scaleR = await extractScale(tR);
console.log(`   After Reset: scale=${scaleR}`);
await page.screenshot({ path: 'screenshots/zoom-05-reset.png' });

// ── Zoom AFTER reset (this is the reported hang) ──────────────────────────────
console.log('\n8. Clicking + AFTER Reset (testing for post-reset hang)...');
for (let i = 0; i < 3; i++) {
  await plusBtn.click();
  await page.waitForTimeout(400);
}
const tP = await getTransform();
const scaleP = await extractScale(tP);
console.log(`   After 3x + post-reset: scale=${scaleP}`);

if (scaleP !== null && scaleR !== null) {
  if (scaleP > scaleR) console.log('   ✅ Zoom after Reset WORKS');
  else                 console.log('   ❌ Zoom after Reset is STUCK (scale unchanged — this is the hang!)');
}
await page.screenshot({ path: 'screenshots/zoom-06-post-reset.png' });

// ── Errors summary ────────────────────────────────────────────────────────────
console.log('\n── Errors ────────────────────────────────────────────────');
errors.filter(e => !/firestore.*channel/i.test(e)).forEach(e => console.log(' ❌', e));
if (!errors.filter(e => !/firestore.*channel/i.test(e)).length) console.log('   None ✓');

await browser.close();
console.log('\nDone. Check screenshots/zoom-*.png');
