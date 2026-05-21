import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1280, height: 800 });
await page.goto('http://localhost:5199/login', { waitUntil: 'networkidle' });
await page.waitForSelector('h1');
await page.waitForTimeout(500);
await page.screenshot({ path: 'screenshots/login-v2-signin.png' });

// Click 'Sign up' toggle
await page.click('button:text("Sign up")');
await page.waitForTimeout(300);
await page.screenshot({ path: 'screenshots/login-v2-signup.png' });

await browser.close();
console.log('screenshots saved');
