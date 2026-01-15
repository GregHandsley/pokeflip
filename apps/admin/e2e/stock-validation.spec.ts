import { test, expect } from "@playwright/test";

test.describe("Stock Validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/admin");
    await page.waitForLoadState("networkidle");
  });

  test("prevents selling more than available", async ({ page }) => {
    // Navigate to record sale page
    await page.goto("/admin/record-sale");

    // Search for a card
    await page.fill('input[placeholder*="search" i]', "Test Card");
    await page.waitForTimeout(500);

    // Select card
    await page.locator("text=Test Card").first().click();

    // Try to set quantity higher than available (e.g., 999)
    await page.fill('input[name="qty"]', "999");

    // Should show error or disable submit button
    const submitButton = page.locator('button:has-text("Record Sale")');
    const isDisabled = await submitButton.isDisabled();

    if (!isDisabled) {
      // If not disabled, try to submit and check for error
      await submitButton.click();
      const errorMessage = page.locator("text=/insufficient|not enough|available/i");
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
    } else {
      // Button is disabled, which is also correct behavior
      expect(isDisabled).toBe(true);
    }
  });

  test("prevents creating bundle with insufficient stock", async ({ page }) => {
    await page.goto("/admin/bundles");
    await page.click('button:has-text("Create Bundle")');

    await page.fill('input[name="name"]', "Test Bundle");
    await page.fill('input[name="quantity"]', "100"); // Large quantity

    // Add card with limited stock
    await page.fill('input[placeholder*="search" i]', "Limited Card");
    await page.waitForTimeout(500);
    await page.locator("text=Limited Card").first().click();
    await page.fill('input[name="cardQuantity"]', "5"); // 100 bundles × 5 cards = 500 needed

    // Should show validation error before allowing create
    const errorBadge = page.locator("text=/insufficient|not available/i");
    await expect(errorBadge).toBeVisible({ timeout: 5000 });

    // Create button should be disabled
    const createButton = page.locator('button:has-text("Create Bundle")');
    const isDisabled = await createButton.isDisabled();
    expect(isDisabled).toBe(true);
  });

  test("prevents selling card that is in a bundle", async ({ page }) => {
    // First, create a bundle with a card
    await page.goto("/admin/bundles");
    await page.click('button:has-text("Create Bundle")');

    await page.fill('input[name="name"]', "Reserved Bundle");
    await page.fill('input[name="quantity"]', "1");

    await page.fill('input[placeholder*="search" i]', "Reserved Card");
    await page.waitForTimeout(500);
    await page.locator("text=Reserved Card").first().click();

    await page.click('button:has-text("Create Bundle")');
    await page.waitForSelector("text=Bundle created", { timeout: 10000 });

    // Now try to sell that card individually
    await page.goto("/admin/inventory");

    // Find the card in inventory
    await page.fill('input[placeholder*="search" i]', "Reserved Card");
    await page.waitForTimeout(500);

    // Click on the card
    await page.locator("text=Reserved Card").first().click();

    // Try to mark as sold - should be disabled or show error
    const lotCards = page.locator("[data-lot-id]");
    const firstLot = lotCards.first();

    if (await firstLot.isVisible()) {
      await firstLot.click();

      // If modal opens, it should show that card is in bundle
      const bundleBadge = page.locator("text=/in bundle|reserved/i");
      await expect(bundleBadge).toBeVisible({ timeout: 3000 });

      // Or the mark as sold button should be disabled
      const markSoldButton = page.locator('button:has-text("Mark as Sold")');
      const isDisabled = await markSoldButton.isDisabled();
      expect(isDisabled).toBe(true);
    }
  });

  test("shows bundle reservation in inventory", async ({ page }) => {
    // Create a bundle first
    await page.goto("/admin/bundles");
    await page.click('button:has-text("Create Bundle")');

    await page.fill('input[name="name"]', "Display Test Bundle");
    await page.fill('input[name="quantity"]', "2");

    await page.fill('input[placeholder*="search" i]', "Display Card");
    await page.waitForTimeout(500);
    await page.locator("text=Display Card").first().click();

    await page.click('button:has-text("Create Bundle")');
    await page.waitForSelector("text=Bundle created", { timeout: 10000 });

    // Go to inventory
    await page.goto("/admin/inventory");

    // Find the card
    await page.fill('input[placeholder*="search" i]', "Display Card");
    await page.waitForTimeout(500);
    await page.locator("text=Display Card").first().click();

    // Should see "In Bundle" badge or indicator
    const bundleIndicator = page.locator("text=/in bundle|reserved/i");
    await expect(bundleIndicator).toBeVisible({ timeout: 5000 });
  });
});
