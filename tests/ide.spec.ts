import { test, expect } from '@playwright/test';

test('Verify IDE header is visible and capture layout', async ({ page }) => {
  await page.goto('http://localhost:3000');
  
  // Wait for the app to settle
  await page.waitForTimeout(2000);

  // Take a full page screenshot to debug visually if needed
  await page.screenshot({ path: 'ide-debug-screenshot.png' });

  const header = page.locator('header');
  const headerCount = await header.count();
  console.log(`Found ${headerCount} header elements.`);

  if (headerCount > 0) {
    const isVisible = await header.isVisible();
    console.log(`Header is visible: ${isVisible}`);
    
    const box = await header.boundingBox();
    console.log(`Header bounding box: ${JSON.stringify(box)}`);
    
    const zIndex = await header.evaluate((el) => window.getComputedStyle(el).zIndex);
    console.log(`Header z-index: ${zIndex}`);

    const opacity = await header.evaluate((el) => window.getComputedStyle(el).opacity);
    console.log(`Header opacity: ${opacity}`);

    const display = await header.evaluate((el) => window.getComputedStyle(el).display);
    console.log(`Header display: ${display}`);
  }

  // Verify elements are not overlapping it
  const main = page.locator('main');
  if (await main.count() > 0) {
    const mainBox = await main.boundingBox();
    console.log(`Main bounding box: ${JSON.stringify(mainBox)}`);
  }
});
