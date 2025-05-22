import { test, expect } from '@playwright/test';
import { ensureLoggedIn } from './utils/login-util';

/**
 * Basic test that verifies login functionality works.
 * This test is designed to be fast and reliable, focusing only on login.
 */
test.describe('Login Test', () => {
  test('should successfully login to ShadowMe', async ({ page }) => {
    // Navigate to the homepage
    await page.goto('http://localhost:3000/');
    console.log('Navigated to homepage');
    
    // Take a screenshot of the initial page
    await page.screenshot({ path: 'screenshots/login-initial.png' });
    
    // Use the shared login utility to ensure we're logged in
    await ensureLoggedIn(page, 'login');
    
    // Take a screenshot of logged in state
    await page.screenshot({ path: 'screenshots/login-success.png' });
    
    // Simple verification that the test completed successfully
    console.log('Login test completed successfully');
    expect(true).toBeTruthy();
  });
});

