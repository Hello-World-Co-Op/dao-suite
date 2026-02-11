import { test, expect } from '@playwright/test';

test('homepage loads successfully', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Suite Template/);
});

test('homepage displays welcome card', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Welcome to Suite Template')).toBeVisible();
});

test('homepage displays Get Started button', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /Get Started/i })).toBeVisible();
});
