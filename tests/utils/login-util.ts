import { Page } from '@playwright/test';

/**
 * Shared login utility for ShadowMe tests
 * Ensures the user is logged in before proceeding with tests
 * 
 * @param page - Playwright page object
 * @param screenshotPrefix - Optional prefix for screenshot names
 * @returns Promise that resolves when login is complete
 */
export async function ensureLoggedIn(page: Page, screenshotPrefix: string = 'login'): Promise<void> {
  console.log('Checking login status...');
  
  // First check if we're already logged in by looking for login form
  const loginFormVisible = await page.locator('input[type="email"], input[placeholder*="email"]').count() > 0;
  
  if (loginFormVisible) {
    console.log('Login form detected, proceeding with login');
    
    // Find and fill email field
    try {
      await page.fill('input[type="email"], input[placeholder*="email"]', 'test1@example.com');
      console.log('Filled email field');
    } catch (e) {
      console.log('Error filling email:', e);
      // Take screenshot for debugging
      await page.screenshot({ path: `screenshots/${screenshotPrefix}-email-error.png` });
    }
    
    // Find and fill password field
    try {
      await page.fill('input[type="password"], input[placeholder*="password"]', 'passS12@');
      console.log('Filled password field');
    } catch (e) {
      console.log('Error filling password:', e);
      // Take screenshot for debugging
      await page.screenshot({ path: `screenshots/${screenshotPrefix}-password-error.png` });
    }
    
    // Click login button
    try {
      // Try different possible selectors for the login button
      const loginButtonSelectors = [
        'button:has-text("Sign In")',
        'button:has-text("Login")',
        'button[type="submit"]',
        'input[type="submit"]',
        'button.login-button',
        'button.sign-in-button'
      ];
      
      let buttonClicked = false;
      for (const selector of loginButtonSelectors) {
        if (await page.locator(selector).count() > 0) {
          await page.click(selector);
          console.log(`Clicked login button with selector: ${selector}`);
          buttonClicked = true;
          break;
        }
      }
      
      if (!buttonClicked) {
        console.log('Could not find login button, taking screenshot for debugging');
        await page.screenshot({ path: `screenshots/${screenshotPrefix}-button-not-found.png` });
      }
    } catch (e) {
      console.log('Error clicking login button:', e);
      await page.screenshot({ path: `screenshots/${screenshotPrefix}-click-error.png` });
    }
    
    // Wait for navigation or content to load
    await page.waitForTimeout(3000);
    
    // Take a screenshot after login attempt
    await page.screenshot({ path: `screenshots/${screenshotPrefix}-complete.png` });
  } else {
    console.log('No login form detected, assuming already logged in');
  }
  
  console.log('Login check complete');
}
