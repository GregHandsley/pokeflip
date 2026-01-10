# User Guide

Complete guide to using the Pokeflip application for inventory and sales management.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Inventory Management](#inventory-management)
3. [Sales Processing](#sales-processing)
4. [Acquisitions](#acquisitions)
5. [Bundles](#bundles)
6. [Analytics & Reporting](#analytics--reporting)
7. [Settings & Configuration](#settings--configuration)
8. [Workflows](#workflows)

## Getting Started

### First Login

1. Navigate to the application URL
2. You'll be redirected to the login page if not authenticated
3. Enter your credentials (managed via Supabase Auth)

### Dashboard Overview

The dashboard provides an at-a-glance view of:
- **Inbox Summary**: Items ready to list, items needing photos
- **Quick Stats**: Open purchases, inventory totals, listed items
- **Financial Overview**: Recent sales, total revenue, profit margins
- **Performance Status**: Database connectivity, system health

## Inventory Management

### Viewing Inventory

1. Navigate to **Inventory** from the main menu
2. View cards by set or search for specific cards
3. Each card shows:
   - Total quantity on hand
   - Quantity for sale
   - Quantity sold
   - Active lots

### Managing Lots

#### Viewing Lot Details
1. Click on a card from the inventory list
2. View all lots for that card
3. See lot details:
   - Condition
   - Variation (language, printing)
   - Quantity
   - Status (draft, ready, listed, sold)
   - List price
   - Photos

#### Updating Lot Status
1. Open a lot detail view
2. Click **Update Status**
3. Select new status:
   - **Draft**: Initial state, needs processing
   - **Ready**: Processed, ready to list
   - **Listed**: Available for sale
   - **Sold**: No longer available
   - **Archived**: Hidden from inventory

#### Marking Lots for Sale
1. Open a lot detail view
2. Toggle **For Sale** switch
3. Set list price (in pence)
4. Save changes

#### Merging Lots
1. Select multiple lots with the same card
2. Click **Merge Lots**
3. Choose the target lot to merge into
4. Confirm merge

**Note**: Lots can only be merged if they have the same card, condition, and variation.

#### Splitting Lots
1. Open a lot detail view
2. Click **Split Lot**
3. Define split quantities and statuses
4. Confirm split

Example: Split a lot of 10 cards into:
- 5 cards → Listed status
- 3 cards → Ready status
- 2 cards → Draft status

#### Adding Photos to Lots
1. Open a lot detail view
2. Click **Upload Photos**
3. Select up to 2 photos (or use API image)
4. Photos are required for listing items for sale

### Bulk Operations

From the inventory page, you can:
- Bulk update status
- Bulk toggle for sale
- Bulk set list prices

## Sales Processing

### Recording a Sale

1. Navigate to **Sales** → **Record Sale**
2. Select or create buyer:
   - Enter buyer handle
   - Platform (eBay, other)
   - Platform order reference (optional)
3. Add sale items:
   - Search for cards
   - Select lot
   - Enter quantity
   - Set sold price
4. Add consumables (packaging materials):
   - Select consumable
   - Enter quantity
5. Add order details:
   - Sale date
   - Discount (if applicable)
   - Fees
   - Shipping cost
6. Review summary:
   - Total revenue
   - Total costs
   - Net profit
   - Margin percentage
7. Save sale

### Viewing Sales

Navigate to **Sales** to see:
- All sales orders
- Order details (buyer, items, dates)
- Profit breakdown
- Export to CSV

### Applying Promotional Deals

When recording a sale:
1. Select a promotional deal from the dropdown
2. Deal is automatically applied to eligible items
3. Discount is calculated and shown in summary

### Profit Calculation

Profits are calculated as:
- **Revenue**: Sum of (sold_price × quantity) for all items, minus discounts
- **Costs**: 
  - Purchase cost (from acquisitions)
  - Consumables cost (packaging materials)
  - Fees and shipping
- **Net Profit**: Revenue - Total Costs
- **Margin**: (Net Profit / Revenue) × 100%

## Acquisitions

### Adding a New Purchase

1. Navigate to **Purchases** → **Add Cards**
2. Enter purchase details:
   - Purchase date
   - Total purchase cost
   - Status (open, committed)
3. Add intake lines:
   - Select set
   - Select card
   - Enter quantity
   - Set condition
   - Add variation (language, etc.)
   - Upload photos (optional)
4. Save acquisition

### Processing Intake Lines

1. Open an acquisition
2. Review intake lines
3. For each line:
   - Add or verify photos
   - Set list price (if for sale)
   - Mark as ready
4. Commit acquisition when all lines are ready

### Committing an Acquisition

1. Review all intake lines
2. Click **Commit Acquisition**
3. System will:
   - Create inventory lots for each intake line
   - Merge with existing lots (same card, condition, variation)
   - Or create new lots if no match found
   - Update purchase status to "committed"

## Bundles

### Creating a Bundle

1. Navigate to **Bundles** → **Create Bundle**
2. Enter bundle details:
   - Name
   - Description
   - Quantity (how many bundles to create)
   - Price per bundle
3. Add bundle items:
   - Search for cards
   - Select lot
   - Enter quantity per bundle
4. Upload bundle photos (optional)
5. Save bundle

### Selling a Bundle

1. Navigate to **Bundles**
2. Find the bundle you want to sell
3. Click **Sell Bundle**
4. Select buyer
5. Enter sale date and discount (if any)
6. Confirm sale

When a bundle is sold:
- Bundle quantity decreases
- Individual lot quantities decrease
- Sale order is created
- Profit is calculated

## Analytics & Reporting

### Dashboard Analytics

View operational analytics:
- Items added/listed/sold over time
- Revenue trends
- Profit trends
- Inventory levels

### Card Analytics

1. Navigate to **Analytics**
2. Select a card
3. View:
   - Sales history
   - Profit margins
   - Inventory turnover
   - Price trends

### Exporting Data

1. Navigate to **Analytics** → **Export**
2. Choose export type:
   - **Sales**: All sales orders with details
   - **Inventory**: Current inventory levels
3. Data is exported as CSV
4. Download file

### Performance Monitoring

1. Navigate to **Settings** → **Performance**
2. View:
   - **Health Check**: System status, database connectivity
   - **Business Metrics**: Sales volume, inventory levels
   - **Performance Metrics**: Database performance, index usage

## Settings & Configuration

### Consumables

Manage packaging materials:
1. Navigate to **Settings** → **Consumables**
2. Add consumables (e.g., bubble mailers, boxes)
3. Record purchases (cost, quantity)
4. System tracks average cost per unit for profit calculations

### Packaging Rules

Define packaging templates:
1. Navigate to **Settings** → **Packaging Rules**
2. Create rules based on card count ranges
3. Specify consumables for each rule
4. Set default rule

Example: 
- 1-5 cards → 1 bubble mailer, 1 toploader
- 6-20 cards → 1 box, 2 bubble wraps

### Promotional Deals

Create sales promotions:
1. Navigate to **Settings** → **Promotional Deals**
2. Create deal:
   - **Buy X Get Y**: Buy 2 get 1 free
   - **Percentage Discount**: 10% off
   - **Fixed Discount**: £5 off
   - **Bundle Discount**: Discount on bundles
3. Set minimum/maximum card counts
4. Activate/deactivate deals

### Set Translations

Manage card set translations:
1. Navigate to **Settings** → **Set Translations**
2. Import translations for non-English sets
3. Bulk import from CSV
4. Edit individual translations

## Workflows

### Typical Workflow: New Purchase to Sale

1. **Record Purchase**
   - Add acquisition
   - Add intake lines with photos
   - Set list prices

2. **Process Inbox**
   - Review items ready to list
   - Add missing photos
   - Verify pricing

3. **List Items**
   - Mark lots as "listed"
   - Toggle "for sale"
   - Set list prices

4. **Record Sale**
   - When items sell, record sale
   - Add buyer information
   - Include consumables
   - Save order

5. **Review Profit**
   - Check profit on individual sale
   - Review overall profitability
   - Export sales data

### Bulk Listing Workflow

1. Navigate to **Inbox**
2. Filter items:
   - Ready to list
   - Has photos
   - High value items
3. Select multiple items
4. Bulk update:
   - Set status to "listed"
   - Toggle "for sale"
   - Set list prices
5. Save changes

### Inventory Audit Workflow

1. Navigate to **Inventory**
2. Review inventory levels
3. Check for discrepancies:
   - Quantities don't match physical inventory
   - Missing photos
   - Incorrect statuses
4. Update lots as needed
5. Merge duplicate lots
6. Archive old lots

### Profit Analysis Workflow

1. Navigate to **Sales** → **Profit Analysis**
2. Review overall profitability:
   - Total revenue vs. costs
   - Margin percentages
   - Profit by time period
3. Analyze by acquisition:
   - See which purchases were most profitable
   - Review profit margins per card
4. Export data for external analysis

## Tips & Best Practices

### Inventory Management
- Take photos when adding intake lines (saves time later)
- Use consistent condition ratings (Near Mint, Lightly Played, etc.)
- Keep variations consistent (e.g., always use "English" not "EN")
- Regularly merge duplicate lots

### Sales Processing
- Record consumables for accurate profit calculations
- Apply discounts through the promotional deals system
- Verify buyer information before saving sale
- Review profit summary before finalizing sale

### Photography
- Use good lighting
- Show card condition clearly
- Take multiple angles for high-value cards
- Use API images when appropriate (faster, consistent quality)

### Pricing
- Research market prices before setting list prices
- Consider condition when pricing
- Use bulk pricing for multiple cards
- Review and adjust prices regularly

### Reporting
- Export sales data regularly for backup
- Review analytics monthly for trends
- Monitor inventory levels to avoid stockouts
- Track profit margins to optimize pricing

## Troubleshooting

### Items Not Showing in Inventory
- Check lot status (must be draft, ready, or listed)
- Verify card is correct
- Check for archived lots

### Sale Not Recording
- Verify all required fields are filled
- Check buyer exists or create new buyer
- Ensure lots have sufficient quantity

### Profit Calculation Issues
- Verify acquisition costs are recorded
- Check consumables are properly tracked
- Review discount calculations

### Photo Upload Issues
- Check file size (too large will fail)
- Verify file format (JPEG, PNG)
- Ensure stable internet connection

For technical issues, check:
- Health check endpoint (`/api/health`)
- Performance metrics page
- Error logs in browser console

## Keyboard Shortcuts

- `Cmd/Ctrl + K`: Search (where available)
- `Esc`: Close modals
- `Enter`: Submit forms (when focused on submit button)

## Support

For questions or issues:
1. Check this user guide
2. Review API documentation for technical details
3. Check error logs for specific errors
4. Contact system administrator

