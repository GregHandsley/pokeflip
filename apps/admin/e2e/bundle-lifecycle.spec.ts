import { test, expect } from "@playwright/test";

test.describe("Bundle Lifecycle", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to admin
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
  });

  test("create, edit, and sell a bundle", async ({ page }) => {
    // Step 1: Navigate to bundles page
    await page.click("text=Bundles");
    await page.waitForURL("**/admin/bundles");

    // Step 2: Create a new bundle
    await page.click('button:has-text("Create Bundle")');

    // Fill bundle details
    await page.fill('input[name="name"]', "Test Bundle");
    await page.fill('textarea[name="description"]', "Test bundle description");
    await page.fill('input[name="price"]', "25.00");
    await page.fill('input[name="quantity"]', "2"); // 2 bundles available

    // Search and add cards
    await page.fill('input[placeholder*="search" i]', "Pikachu");
    await page.waitForTimeout(500);

    // Select first search result
    await page.locator("text=Pikachu").first().click();

    // Set quantity per bundle (if there's an input for this)
    await page.fill('input[name="cardQuantity"]', "3"); // 3 cards per bundle

    // Add another card
    await page.fill('input[placeholder*="search" i]', "Charizard");
    await page.waitForTimeout(500);
    await page.locator("text=Charizard").first().click();
    await page.fill('input[name="cardQuantity"]', "2"); // 2 cards per bundle

    // Create bundle
    await page.click('button:has-text("Create Bundle")');

    // Wait for success
    await page.waitForSelector("text=Bundle created", { timeout: 10000 });

    // Step 3: Verify bundle appears in list
    await expect(page.locator("text=Test Bundle")).toBeVisible();
    await expect(page.locator("text=2")).toBeVisible(); // Quantity

    // Step 4: Edit bundle
    await page.locator('button:has-text("Edit")').first().click();

    // Update bundle quantity
    await page.fill('input[name="quantity"]', "3"); // Increase to 3
    await page.click('button:has-text("Save")');

    await page.waitForSelector("text=Bundle updated", { timeout: 5000 });

    // Step 5: Go to Record Sale page
    await page.click("text=Record Sale");
    await page.waitForURL("**/admin/record-sale");

    // Find bundle in active bundles section
    await expect(page.locator("text=Test Bundle")).toBeVisible();

    // Step 6: Sell bundle
    const testBundle = page.locator("text=Test Bundle");
    await testBundle.locator("..").locator('button:has-text("Sell")').first().click();

    // Fill sale details
    await page.fill('input[name="buyerHandle"]', "testbuyer");
    await page.fill('input[name="quantity"]', "1"); // Sell 1 bundle
    await page.fill('input[name="fees"]', "2.50");
    await page.fill('input[name="shipping"]', "3.00");

    // Record sale
    await page.click('button:has-text("Record Sale")');

    await page.waitForSelector("text=Sale recorded", { timeout: 10000 });

    // Step 7: Verify bundle quantity decreased
    await page.click("text=Bundles");
    await page.waitForURL("**/admin/bundles");

    // Should show quantity 2 (was 3, sold 1)
    await expect(page.locator("text=Test Bundle").locator("..").locator("text=2")).toBeVisible();
  });

  test("validates stock when creating bundle", async ({ page }) => {
    await page.goto("/admin/bundles");

    await page.click('button:has-text("Create Bundle")');

    // Create bundle that requires more stock than available
    await page.fill('input[name="name"]', "Large Bundle");
    await page.fill('input[name="price"]', "50.00");
    await page.fill('input[name="quantity"]', "10"); // 10 bundles

    // Add card with limited stock
    await page.fill('input[placeholder*="search" i]', "Rare Card");
    await page.waitForTimeout(500);
    await page.locator("text=Rare Card").first().click();
    await page.fill('input[name="cardQuantity"]', "5"); // 5 cards per bundle = 50 total needed

    // If card only has 20 available, this should show an error
    await page.click('button:has-text("Create Bundle")');

    // Should show error about insufficient stock
    const errorMessage = page.locator("text=/insufficient|not enough|available/i");
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });

  test("prevents editing sold bundle", async ({ page }) => {
    // This test assumes there's a sold bundle in the system
    await page.goto("/admin/bundles");

    // Filter to show sold bundles
    await page.selectOption('select[name="statusFilter"]', "sold");

    // Find a sold bundle - Edit button should not be visible
    const soldBundle = page.locator("text=Sold Bundle").first();
    if (await soldBundle.isVisible()) {
      await expect(soldBundle.locator("..").locator('button:has-text("Edit")')).not.toBeVisible();
    }
  });

  test("prevents deleting sold bundle", async ({ page }) => {
    await page.goto("/admin/bundles");

    // Filter to show sold bundles
    await page.selectOption('select[name="statusFilter"]', "sold");

    // Find a sold bundle and try to delete
    const soldBundle = page.locator("text=Sold Bundle").first();
    if (await soldBundle.isVisible()) {
      // Click three-dot menu
      await soldBundle.locator("..").locator('button[aria-label*="menu" i]').first().click();

      // Delete option should be disabled or not visible
      await expect(page.locator("text=Delete Bundle")).not.toBeVisible({ timeout: 1000 });
    }
  });
});
