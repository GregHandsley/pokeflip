import { test, expect } from "@playwright/test";

test.describe("Purchase → List → Sell Workflow", () => {
  test.beforeEach(async ({ page }) => {
    // Assuming authentication is required
    // In real test, you'd set up auth state
    await page.goto("/admin");

    // Wait for page to load
    await page.waitForLoadState("networkidle");
  });

  test("complete purchase to sale workflow", async ({ page }) => {
    // Step 1: Create a purchase (acquisition)
    await page.click("text=Purchases");
    await page.waitForURL("**/admin/acquisitions");

    await page.click("text=Add Cards"); // or whatever the button text is

    // Fill in purchase form
    await page.fill('input[name="source_name"]', "Test Purchase");
    await page.fill('input[name="purchase_total_pence"]', "5000"); // £50
    await page.click('button[type="submit"]');

    // Wait for purchase to be created
    await page.waitForSelector("text=Test Purchase");

    // Step 2: Add intake lines (cards to the purchase)
    // This would depend on your UI, but assuming there's an "Add Cards" or similar
    await page.click("text=Add Cards"); // Button to add intake lines

    // Add a card
    await page.fill('input[placeholder*="card"]', "Pikachu");
    await page.selectOption('select[name="condition"]', "NM");
    await page.fill('input[name="quantity"]', "5");
    await page.fill('input[name="price_pence"]', "1000"); // £10
    await page.click('button:has-text("Add")');

    // Commit the acquisition
    await page.click('button:has-text("Commit")');

    // Wait for confirmation
    await page.waitForSelector("text=Committed", { timeout: 10000 });

    // Step 3: Go to Inbox (where cards are listed for sale)
    await page.click("text=Inbox");
    await page.waitForURL("**/admin/inbox");

    // Verify card appears in inbox
    await expect(page.locator("text=Pikachu")).toBeVisible();

    // Step 4: Mark card as ready/listed
    // This depends on your UI - might be a button or status change
    await page.locator('button:has-text("Ready")').first().click();

    // Step 5: Record a sale
    await page.click("text=Record Sale");
    await page.waitForURL("**/admin/record-sale");

    // Search for the card
    await page.fill('input[placeholder*="search"]', "Pikachu");
    await page.waitForTimeout(500); // Wait for search results

    // Select the card
    await page.locator("text=Pikachu").first().click();

    // Set quantity and price
    await page.fill('input[name="qty"]', "2");
    await page.fill('input[name="price"]', "12.50"); // £12.50

    // Fill in buyer info
    await page.fill('input[name="buyer"]', "testbuyer");
    await page.selectOption('select[name="platform"]', "ebay");

    // Add fees
    await page.fill('input[name="fees"]', "1.50");
    await page.fill('input[name="shipping"]', "3.00");

    // Submit sale
    await page.click('button:has-text("Record Sale")');

    // Wait for success message
    await page.waitForSelector("text=Sale recorded", { timeout: 10000 });

    // Step 6: Verify sale appears in sales page
    await page.click("text=Sales & Profit");
    await page.waitForURL("**/admin/sales");

    // Should see the sale
    await expect(page.locator("text=testbuyer")).toBeVisible();
    await expect(page.locator("text=Pikachu")).toBeVisible();

    // Verify profit is calculated correctly
    // Revenue: 2 × £12.50 = £25
    // Costs: £1.50 fees + £3.00 shipping = £4.50
    // Profit: £25 - £4.50 = £20.50
    await expect(page.locator("text=/£20.50|20.50/")).toBeVisible();
  });

  test("validates stock before allowing sale", async ({ page }) => {
    // Create purchase and commit (similar to above but with 1 card)
    // Then try to sell 2 cards - should fail
    // This is a simplified version - adjust based on your actual UI

    await page.goto("/admin/record-sale");

    // Try to add more cards than available
    await page.fill('input[placeholder*="search"]', "Card Name");
    await page.waitForTimeout(500);

    // Select card
    await page.click("text=Card Name");

    // Try to set quantity higher than available
    await page.fill('input[name="qty"]', "999");

    // Should show error or prevent submission
    const errorMessage = page.locator("text=/insufficient|not enough|available/");
    await expect(errorMessage).toBeVisible({ timeout: 5000 });
  });
});
