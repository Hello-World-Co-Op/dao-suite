import { test, expect } from '@playwright/test';

test('homepage loads successfully', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Hello World DAO/);
});

test('dashboard displays welcome message', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Your DAO Dashboard')).toBeVisible();
});

test('dashboard displays navigation links', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Settings')).toBeVisible();
});
