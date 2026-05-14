import { test, expect } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('http://localhost:3000');
  // Wait for Monaco editor to finish loading
  await page.waitForSelector('header', { timeout: 10000 });
});

test('header is visible and not overlapped by main content', async ({ page }) => {
  const header = page.locator('header');
  await expect(header).toBeVisible();

  const headerBox = await header.boundingBox();
  const main = page.locator('main');
  const mainBox = await main.boundingBox();

  expect(headerBox).not.toBeNull();
  expect(mainBox).not.toBeNull();

  // Main content must start below the header
  expect(mainBox!.y).toBeGreaterThanOrEqual(headerBox!.y + headerBox!.height - 1);
});

test('provider toggle switches between OpenAI and Ollama', async ({ page }) => {
  const openaiBtn = page.getByRole('button', { name: /openai/i });
  const ollamaBtn = page.getByRole('button', { name: /ollama/i });

  await expect(openaiBtn).toBeVisible();
  await expect(ollamaBtn).toBeVisible();

  // Switch to Ollama
  await ollamaBtn.click();
  // The button should visually reflect the active state (bg-indigo-600 class)
  await expect(ollamaBtn).toHaveClass(/bg-indigo-600/);

  // Switch back to OpenAI
  await openaiBtn.click();
  await expect(openaiBtn).toHaveClass(/bg-white/);
});

test('Run Prototype button is visible and clickable', async ({ page }) => {
  const runBtn = page.getByRole('button', { name: /run prototype/i });
  await expect(runBtn).toBeVisible();
  await expect(runBtn).toBeEnabled();
});

test('chat panel accepts keyboard input', async ({ page }) => {
  const chatInput = page.locator('input[placeholder*="QUERY"]');
  await expect(chatInput).toBeVisible();

  await chatInput.fill('Hello');
  await expect(chatInput).toHaveValue('Hello');
});

test('initial tutor message is displayed', async ({ page }) => {
  // The welcome message from the Tutor agent should be present on load
  const tutorMessage = page.locator('text=Socratic Tutor');
  await expect(tutorMessage).toBeVisible();
});

test('execution sandbox section is rendered', async ({ page }) => {
  const sandboxHeader = page.locator('text=Execution Sandbox');
  await expect(sandboxHeader).toBeVisible();
});
