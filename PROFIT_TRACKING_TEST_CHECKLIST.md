# Profit Tracking System - Testing Checklist

## Prerequisites
- [x] Run database migration: `20251231010000_packaging_recipes_and_profit.sql`
- [x] Ensure you have at least one inventory lot available for testing

---

## 1. Consumables Management (`/admin/settings/consumables`)

### Add Consumables
- [x] Navigate to Settings > Consumables
- [x] Click "Add Consumable"
- [x] Add a consumable with name "Sleeves" and unit "each"
- [x] Add another consumable: "Toploaders", unit "each"
- [x] Add another consumable: "Team Bags", unit "pack"
- [x] Add another consumable: "Envelopes", unit "each"
- [x] Add another consumable: "Labels", unit "roll"

*** Can the units be buttons to click rather than having to input the text.
*** I should be able to edit a consumable after adding a consumable
*** Rolls and pack does not work. I only need one label and one team bag. Was this just an example, but is there any point having these different types of units?

- [x] Verify all consumables appear in the list
- [x] Verify initial average cost shows "No purchases" for new consumables

### Record Purchases
- [x] Click "Record Purchase"
- [x] Select "Sleeves" from dropdown
- [x] Enter quantity: 100
- [x] Enter total cost: £5.00
- [x] Select purchase date (today)
- [x] Submit and verify purchase appears in Recent Purchases
- [x] Verify average cost updates to £0.05 per unit

*** In recent purchases, the date needs to be in UK format 31/12/2025. Currently it is 12/31/2025

- [x] Record another purchase: 200 sleeves for £8.00
- [x] Verify average cost recalculates correctly (should be ~£0.043 per unit)
- [ ] Record purchases for other consumables:
  - [x] Toploaders: 50 for £10.00
  - [x] Team Bags: 10 packs for £3.00
  - [x] Envelopes: 100 for £2.50
  - [x] Labels: 1 roll for £1.50
- [x] Verify all purchases appear in Recent Purchases table
- [x] Verify cost per unit calculates correctly for each purchase

---

## 2. Packaging Rules (`/admin/settings/packaging-rules`)

### Create Default Rule (Single Card)
- [x] Navigate to Settings > Packaging Rules
- [x] Click "Add Rule" or "Create Default Rule"
- [x] Set name: "Single Card"
- [x] Check "Set as default rule"
- [x] Set Min Card Count: 1
- [x] Leave Max Card Count empty (unlimited)
- [ ] Add consumables:
  - [x] Add "Sleeves" × 1
  - [x] Add "Toploaders" × 1
  - [x] Add "Team Bags" × 1
  - [x] Add "Labels" × 1
  - [x] Add "Envelopes" × 1
- [x] Save rule
- [x] Verify rule appears with "Default" badge
- [x] Verify all consumables are listed correctly

### Create Multi-Card Rule
- [x] Click "Add Rule"
- [x] Set name: "Multi-Card"
- [x] Uncheck "Set as default rule"
- [x] Set Min Card Count: 2
- [x] Leave Max Card Count empty
- [x] Add consumables:
  - [x] Add "Sleeves" × 2 (or appropriate qty)
  - [x] Add "Envelopes" × 1
  - [x] Add "Labels" × 1
- [x] Save rule
- [x] Verify rule appears in list
- [x] Verify rule shows correct card count range

### Edit Rule
- [ ] Click "Edit" on a rule
- [ ] Modify consumable quantities
- [ ] Add/remove consumables
- [ ] Save and verify changes persist

*** This doesn't work. It creates another rule rather than edit the original. 

---

## 3. Mark as Sold - Basic Flow

### Single Card Sale
- [x] Go to Inventory
- [x] Expand a card with available lots
- [x] Click green checkmark on an active lot
- [x] Verify modal opens
- [x] Verify lot info displays correctly
- [x] Set quantity: 1
- [x] Verify packaging rule auto-applies (should show consumables for single card)
- [x] Enter sold price: £2.00
- [x] Enter buyer handle: "testbuyer1"
- [x] Leave fees, shipping, order group empty
- [ ] Verify profit calculation shows:
  - [x] Revenue: £2.00
  - [x] Costs breakdown (consumables, fees, shipping)
  - [x] Net profit
  - [x] Margin percentage
- [x] Click "Mark as Sold"
- [x] Verify sale is created
- [x] Verify lot quantity decreases
- [x] Verify lot moves to "Sold Lots" section if quantity reaches 0

### Multi-Card Sale
- [x] Click green checkmark on another lot
- [x] Set quantity: 3
- [x] Verify packaging rule auto-applies (should show multi-card consumables)
- [ ] Enter sold price: £5.00
- [ ] Enter buyer handle: "testbuyer2"

*** It needs to be clearer that the buyer handle is required. If I do not input one, I want a modal, not a system prompt. 

- [x] Enter fees: £0.50
- [x] Enter shipping: £1.00
- [x] Verify profit calculation updates in real-time
- [x] Verify consumables cost is calculated correctly
- [x] Click "Mark as Sold"
- [ ] Verify sale is created with all data

---

## 4. Mark as Sold - Consumables Features

### Auto-Apply Packaging Rule
- [x] Open Mark Sold modal
- [x] Set quantity: 1
- [x] Verify consumables auto-populate from default rule
- [x] Change quantity to 2
- [x] Verify consumables update to multi-card rule (if exists)
- [x] Change quantity back to 1
- [x] Verify consumables revert to single card rule

*** When making a new consumable, it should have a button that identifies that the number of this item correlates to the number of cards sold. For example, sleeves. 2x cards sold needs 2x sleeves. The quantity should automatically increase. 

### Override Consumables
- [x] With auto-applied consumables visible
- [x] Click "Add Consumable"
- [x] Select a consumable from dropdown
- [x] Set quantity
- [x] Verify cost updates in real-time
- [x] Remove a consumable using delete button
- [x] Verify profit calculation updates
- [x] Modify quantity of existing consumable
- [x] Verify cost recalculates

### Consumables Cost Calculation
- [x] Add consumable with known average cost
- [x] Set quantity: 5
- [x] Verify total cost = (avg_cost_per_unit × 5) / 100
- [x] Verify this matches displayed cost in pounds

---

## 5. Profit Calculation & Warnings

### Break-Even Warning
- [x] Open Mark Sold modal
- [x] Set quantity: 1
- [x] Add consumables (note the total consumables cost)
- [x] Enter fees: £0.50
- [x] Enter shipping: £1.00
- [x] Calculate break-even: consumables + fees + shipping
- [x] Enter sold price BELOW break-even (e.g., if break-even is £2.00, enter £1.50)
- [x] Verify yellow warning appears: "Price Below Break-Even"
- [x] Verify warning shows correct break-even price
- [x] Increase price above break-even
- [x] Verify warning disappears

### Profit Calculation Accuracy
- [x] Set up a sale with known values:
  - Sold price: £5.00
  - Fees: £0.50
  - Shipping: £1.00
  - Consumables: £0.25 (from known costs)
- [x] Verify:
  - [x] Revenue: £5.00
  - [x] Total Costs: £1.75
  - [x] Net Profit: £3.25
  - [x] Margin: 65%
- [x] Test with negative profit scenario:
  - [x] Sold price: £1.00
  - [x] Costs total: £2.00
  - [x] Verify profit shows negative (red)
  - [x] Verify margin shows negative percentage

### Real-Time Updates
- [x] Change sold price
- [x] Verify profit updates immediately
- [x] Change fees
- [x] Verify profit updates immediately
- [x] Change shipping
- [x] Verify profit updates immediately
- [x] Add/remove/modify consumables
- [x] Verify profit updates immediately

---

## 6. Sales & Profit Reports (`/admin/sales`)

### View Reports
- [x] Navigate to Sales & Profit
- [x] Verify summary cards display:
  - [x] Total Revenue (sum of all sales)
  - [x] Total Costs
  - [x] Net Profit
  - [x] Average Margin %
- [x] Verify numbers are correct based on test sales

*** It would be good if I can click on the sold item in the inventory and it wil take me to the details of the page. 

### Sales Orders Table
- [x] Verify all sales appear in table
- [x] Verify columns: Date *** Needs to be UK style, Buyer, Revenue, Costs, Profit, Margin, Actions
- [x] Verify profit is color-coded (green for positive, red for negative)
- [x] Verify margin is color-coded
- [x] Click "View Details" on an order
- [x] Verify modal opens with detailed breakdown

*** It would be more beneficial if this modal opened with the details of the sale (e.g. the cards that were in the sale.)

### Order Detail Modal
- [x] In order detail modal, verify:
  - [x] Revenue displays correctly
  - [x] Net Profit displays correctly
  - [x] Cost breakdown shows:
    - [x] Fees
    - [x] Shipping
    - [x] Consumables
    - [x] Total Costs
  - [x] Consumables Used section lists all consumables
  - [x] Each consumable shows: name, quantity, unit, total cost
  - [x] Margin percentage displays correctly
- [x] Close modal and verify it closes properly

*** Woudld be nice to be able to click around the modal to close it, not just on the x

---

## 7. Edge Cases & Error Handling

### Consumables Edge Cases
- [x] Try to record purchase with quantity 0 (should fail)
- [x] Try to record purchase with negative cost (should fail)

*** I don't want a system message, but a modal.

- [x] Try to add consumable with empty name (should fail)

*** I don't want a system message, but a modal.

- [x] Record purchase with very large quantity (verify calculation handles it)

### Packaging Rules Edge Cases
- [x] Create rule with no consumables (should warn/require at least one)
- [x] Create two default rules (second should unset first)
- [x] Create rule with overlapping card count ranges
- [x] Edit rule and remove all consumables (should warn)

*** I would like to be able to delete a packaging rule

### Mark Sold Edge Cases
- [x] Try to mark sold with quantity > available (should fail)
- [x] Try to mark sold with quantity 0 (should fail)
- [x] Try to mark sold with negative price (should fail)
- [x] Try to mark sold with empty buyer handle (should fail)
- [x] Mark sold with no consumables (should work, consumables cost = 0)
- [x] Mark sold with very high fees/shipping (verify profit calculation)
- [x] Mark sold when lot quantity reaches 0 (verify status changes to "sold")

### Profit Calculation Edge Cases
- [x] Test with £0.00 sold price (margin should be 0% or negative)
- [x] Test with very small price (e.g., £0.01)
- [x] Test with very large price (e.g., £1000.00)
- [x] Test with many consumables (10+ items)
- [x] Test with consumables that have no purchases (avg cost = 0)

---

## 8. Data Persistence

### Verify Data Saves
- [x] Create a sale with consumables
- [x] Refresh the page
- [x] Go to Sales & Profit
- [x] Verify the sale appears
- [x] Click "View Details"
- [x] Verify all consumables are saved correctly
- [x] Verify profit calculation matches what was shown in modal

### Verify Inventory Updates
- [x] Mark a lot as sold (quantity 1, available 1)
- [x] Verify lot status changes to "sold"
- [x] Verify lot appears in "Sold Lots" collapsed section
- [x] Mark another lot as sold (quantity 5, available 3, sell 2)
- [x] Verify available quantity decreases to 1
- [x] Verify status remains active (not sold)

---

## 9. Integration Testing

### Full Workflow
1. [x] Add consumables (sleeves, toploaders, etc.)
2. [x] Record purchases for each consumable
3. [x] Create packaging rules (single card, multi-card)
4. [x] Mark a single card as sold
5. [x] Verify consumables auto-apply
6. [x] Verify profit calculation
7. [x] Submit sale
8. [x] Go to Sales & Profit reports
9. [x] Verify sale appears with correct profit
10. [x] View order details
11. [x] Verify all data matches

### Repeat Buyer
- [x] Mark item as sold to "buyer1"
- [x] Mark another item as sold to "buyer1"
- [x] When entering "buyer1" again, verify:
  - [x] Autocomplete shows "buyer1"
  - [x] Shows "Repeat buyer: 2 orders"
  - [x] Shows total spend

  *** It would be good to be able to click on the buyer in the sales and profit table to see their transactions. 

### Order Grouping
- [x] Mark multiple items as sold with same order group "ORDER-001"

*** Can a new order number be autogenerated. If it is associated to anoter order I can then delete and type in. I do not want duplicate order numbers. 

- [x] Verify order group appears in suggestions
- [ ] Verify sales can be grouped by order group

*** In the sales and profit tab, this is recording as two different sales. This will need more work as I want to be able to add cards into one sale. Please add a placeholder into the sales modal so I can do this later. 

---

## 10. UI/UX Testing

### Navigation
- [x] Verify "Sales & Profit" appears in main nav
- [x] Verify "Settings" section appears in sidebar
- [x] Verify Settings sub-items (Consumables, Packaging Rules) appear
- [x] Verify all links work correctly

### Responsive Design
- [x] Test on different screen sizes
- [x] Verify tables are scrollable on mobile
- [x] Verify modals are usable on mobile

### Visual Feedback
- [x] Verify loading states show when fetching data
- [x] Verify success/error messages appear appropriately
- [x] Verify profit colors (green/red) are clear
- [x] Verify warning messages are visible

---

## 11. Performance Testing

- [x] Test with many consumables (50+)
- [x] Test with many sales orders (100+)
- [x] Verify profit calculation is fast (real-time updates)
- [x] Verify reports page loads quickly with many orders

---

## 12. Database Verification

### Check Database Directly
- [x] Verify `consumables` table has entries
- [x] Verify `consumable_purchases` table has entries
- [x] Verify `packaging_rules` table has entries
- [x] Verify `packaging_rule_items` table has entries
- [x] Verify `sales_orders` table has entries with optional fields
- [x] Verify `sales_consumables` table has entries
- [x] Verify `v_consumable_costs` view returns correct averages
- [x] Verify `v_sales_order_profit` view returns correct calculations

---

## Quick Smoke Test (Minimum Viable Test)

If short on time, test these critical paths:

1. [x] Add one consumable and record a purchase
2. [x] Create a default packaging rule with that consumable
3. [x] Mark one lot as sold (qty 1)
4. [x] Verify consumables auto-apply
5. [x] Verify profit calculation shows correctly
6. [x] Submit sale
7. [x] Go to Sales & Profit and verify sale appears
8. [x] View order details and verify breakdown is correct

---

## Known Issues to Watch For

- [x] Migration may need to be run manually if auto-migration fails
- [x] If columns don't exist, API will gracefully handle it but features will be limited
- [x] Consumables with no purchases will show £0.00 cost (expected behavior)

