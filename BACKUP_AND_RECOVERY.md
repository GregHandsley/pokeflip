# Backup and Recovery Guide

This document outlines the backup and recovery procedures for PokeFlip.

## Overview

PokeFlip uses multiple backup strategies to ensure data safety:
1. **Automated Supabase Backups** (Database-level)
2. **Manual Data Exports** (Application-level CSV/JSON exports)
3. **Periodic Full Exports** (Complete application data snapshots)

## 1. Supabase Automated Backups

### Current Status

Supabase provides automated daily backups for all projects. For **Pro plan and above**, automated backups are enabled by default with:
- **Daily automated backups**
- **Point-in-time recovery (PITR)** available
- **7-day retention** (extendable to 30 days on Enterprise)

### Verifying Backup Status

To verify your Supabase backups are configured:

1. **Via Supabase Dashboard:**
   - Go to your project: https://app.supabase.com
   - Navigate to **Settings** → **Database**
   - Check **Backups** section
   - Verify backup schedule and retention period

2. **Via Supabase CLI (Recommended):**
   ```bash
   # First, authenticate if not already logged in
   supabase login
   
   # List all your projects
   supabase projects list
   
   # List backups for a specific project
   supabase db backups list --project-ref <your-project-ref>
   
   # Or use the automated test script
   ./scripts/test-supabase-backups.sh <project-ref>
   ```

3. **Using the Test Script:**
   ```bash
   # Interactive mode (will prompt for project ref)
   ./scripts/test-supabase-backups.sh
   
   # Non-interactive mode (requires project ref)
   SUPABASE_PROJECT_REF=your-project-ref ./scripts/test-supabase-backups.sh
   
   # Or pass project ref as argument
   ./scripts/test-supabase-backups.sh your-project-ref
   ```

4. **Check Backup Frequency:**
   - Pro plan: Daily backups with 7-day retention
   - Enterprise: Configurable retention (up to 30 days)
   - Free tier: Manual backups only

### Backup Types

- **Full Backups**: Complete database snapshot
- **Incremental Backups**: Changes since last backup
- **Point-in-Time Recovery**: Restore to any specific timestamp (Pro+)

## 2. Manual Data Exports

### Available Export Endpoints

#### Sales Export
```
GET /api/admin/analytics/export/sales
```
Exports all sales orders with profit calculations to CSV.

#### Inventory Export
```
GET /api/admin/analytics/export/inventory
```
Exports all inventory lots with card details to CSV.

#### Full Database Export
```
GET /api/admin/backup/full-export?format=csv
GET /api/admin/backup/full-export?format=json
```
Exports all critical application data:
- Acquisitions and intake lines
- Inventory lots with card details
- Sales orders and sales items
- Bundles and bundle items
- Buyers
- Consumables and consumable purchases
- eBay listings

**Parameters:**
- `format`: `csv` (default) or `json`

**Example:**
```bash
# CSV export
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/admin/backup/full-export?format=csv" \
  -o backup-$(date +%Y%m%d).csv

# JSON export
curl -H "Authorization: Bearer <token>" \
  "http://localhost:3000/api/admin/backup/full-export?format=json" \
  -o backup-$(date +%Y%m%d).json
```

### Scheduled Exports

For periodic exports, consider setting up a cron job:

```bash
# Add to crontab (crontab -e)
# Daily export at 2 AM
0 2 * * * curl -H "Authorization: Bearer <token>" \
  "https://your-domain.com/api/admin/backup/full-export?format=json" \
  -o /backups/pokeflip-$(date +\%Y\%m\%d).json

# Weekly full CSV export
0 3 * * 0 curl -H "Authorization: Bearer <token>" \
  "https://your-domain.com/api/admin/backup/full-export?format=csv" \
  -o /backups/pokeflip-weekly-$(date +\%Y\%W).csv
```

## 3. Recovery Procedures

### Scenario 1: Restore from Supabase Backup

#### Using Supabase Dashboard:

1. **Navigate to Database Backups:**
   - Go to **Settings** → **Database** → **Backups**

2. **Select Restore Point:**
   - Choose from available backup snapshots
   - For PITR: Select specific timestamp

3. **Initiate Restore:**
   - Click **Restore** on the selected backup
   - Confirm the restore operation
   - **Note**: This will overwrite current database

4. **Verify Restore:**
   - Check critical tables have expected data
   - Verify row counts match expectations
   - Test application functionality

#### Using Supabase CLI:

**Important:** Always test restores on a staging/test project first!

```bash
# 1. List available backups
supabase db backups list --project-ref <project-ref>

# 2. View backup details
# The list command shows backup IDs, creation dates, and sizes

# 3. Restore from a specific backup
supabase db restore <backup-id> --project-ref <project-ref>

# 4. Point-in-time recovery (Pro+ plans only)
supabase db restore --timestamp "2025-01-15 14:30:00" --project-ref <project-ref>

# 5. Verify restore completed successfully
# After restore, check your database to ensure data is correct
supabase db remote commit --project-ref <project-ref>
```

**Safety Checklist Before Restoring:**
- ✓ Create a manual export first (using `/api/admin/backup/full-export`)
- ✓ Test restore on a staging/test project if possible
- ✓ Verify you have the correct backup ID
- ✓ Ensure you have a way to rollback if needed
- ✓ Notify team members if restoring production database

### Scenario 2: Restore from Manual Export

Manual exports are **data exports only**, not full database backups. They cannot restore:
- Database schema/structure
- Functions, triggers, views
- RLS policies
- Extensions

They can restore:
- Table data
- Foreign key relationships (if IDs preserved)

#### Restoring from JSON Export:

See `scripts/restore-from-export.sh` for automated restore script.

**Manual Steps:**

1. **Extract data from export:**
   ```bash
   cat backup-20250115.json | jq '.data.acquisitions[]'
   ```

2. **Import using Supabase client:**
   ```bash
   # Use supabase CLI or psql to import data
   psql $DATABASE_URL -c "\COPY acquisitions FROM 'acquisitions.csv' CSV HEADER"
   ```

3. **Handle foreign keys:**
   - Import tables in dependency order:
     1. Sets
     2. Cards
     3. Acquisitions
     4. Inventory Lots
     5. Sales Orders
     6. Sales Items
     7. Bundles
     8. Bundle Items

### Scenario 3: Partial Data Recovery

If you need to restore specific records:

1. **Identify affected records** from export files
2. **Extract specific data:**
   ```bash
   jq '.data.sales_orders[] | select(.id == "<order-id>")' backup.json
   ```
3. **Restore via API or direct SQL:**
   ```sql
   INSERT INTO sales_orders (...) VALUES (...);
   ```

## 4. Backup Testing

### Regular Testing Schedule

- **Monthly**: Test restore from Supabase backup to staging environment
- **Quarterly**: Full disaster recovery test
- **After schema changes**: Verify backup includes new tables/columns

### Testing Procedure

1. **Create test environment:**
   ```bash
   # Create new Supabase project for testing
   supabase projects create pokeflip-test
   ```

2. **Restore backup:**
   ```bash
   # Restore latest backup to test project
   supabase db restore <backup-id> --project-ref <test-project-ref>
   ```

3. **Verify data integrity:**
   - Check row counts
   - Verify foreign key relationships
   - Test critical application flows

4. **Document results:**
   - Record restore time (RTO - Recovery Time Objective)
   - Verify data completeness (RPO - Recovery Point Objective)
   - Note any issues or improvements needed

### Automated Testing Script

See `scripts/test-backup-restore.sh` for automated testing.

## 5. Backup Storage Best Practices

### 3-2-1 Backup Rule

- **3 copies** of data (production + 2 backups)
- **2 different media types** (database backup + CSV export)
- **1 offsite copy** (Supabase backups are automatically offsite)

### Storage Locations

1. **Supabase Automated Backups:**
   - Stored in Supabase's infrastructure
   - Automatically replicated across regions

2. **Manual Exports:**
   - Store locally or in cloud storage (S3, Google Cloud Storage)
   - Encrypt sensitive exports
   - Maintain retention policy (e.g., 90 days)

3. **Local Backups:**
   - Store on separate device/server
   - Use version control for critical exports
   - Keep offsite physical backup for critical data

### Encryption

All exports should be encrypted at rest:
```bash
# Encrypt export file
gpg --encrypt --recipient your@email.com backup.json

# Decrypt when needed
gpg --decrypt backup.json.gpg > backup.json
```

## 6. Disaster Recovery Plan

### RTO (Recovery Time Objective)
- **Target**: < 1 hour for full database restore
- **Acceptable**: < 4 hours for partial recovery

### RPO (Recovery Point Objective)
- **Target**: < 1 hour (hourly incremental backups)
- **Current**: 24 hours (daily automated backups)

### Recovery Steps

1. **Assess damage:**
   - Identify affected data/tables
   - Determine recovery point needed

2. **Choose recovery method:**
   - Full restore: Use Supabase backup
   - Partial restore: Use manual export
   - Point-in-time: Use PITR (if available)

3. **Execute recovery:**
   - Follow appropriate recovery procedure above
   - Verify data integrity
   - Test application functionality

4. **Post-recovery:**
   - Document incident
   - Update backup procedures if needed
   - Notify stakeholders

## 7. Backup Monitoring and Alerts

### Monitoring Backup Health

- **Supabase Dashboard**: Check backup status weekly
- **Automated checks**: Set up alerts for failed backups
- **Export verification**: Verify manual exports complete successfully

### Setting Up Alerts

```bash
# Example: Check backup exists for today
supabase db backups list --project-ref <ref> | grep $(date +%Y-%m-%d)

# Alert if no backup found
if [ $? -ne 0 ]; then
  echo "ALERT: No backup found for today" | mail -s "Backup Alert" admin@example.com
fi
```

## 8. Maintenance Tasks

### Weekly
- Verify Supabase backups are completing
- Check export storage has sufficient space
- Review backup logs for errors

### Monthly
- Test restore procedure
- Review and update backup documentation
- Archive old exports (per retention policy)

### Quarterly
- Full disaster recovery test
- Review and update RTO/RPO targets
- Audit backup access permissions

## 9. Troubleshooting

### Backup Failures

**Issue**: Supabase backup failed
- Check Supabase status page
- Verify project is not paused
- Contact Supabase support if issue persists

**Issue**: Manual export timeout
- Increase timeout limits
- Export in smaller chunks
- Use JSON format (lighter than CSV for large datasets)

### Restore Issues

**Issue**: Foreign key violations during restore
- Restore tables in correct order (see dependency list above)
- Temporarily disable foreign key checks if needed
- Verify all referenced records exist

**Issue**: Missing data after restore
- Check export included all tables
- Verify RLS policies allow data access
- Check for deleted records in export

## 10. Additional Resources

- [Supabase Backup Documentation](https://supabase.com/docs/guides/platform/backups)
- [PostgreSQL Backup and Restore](https://www.postgresql.org/docs/current/backup.html)
- [Supabase CLI Documentation](https://supabase.com/docs/reference/cli)

## Support

For backup-related issues:
1. Check this documentation first
2. Review Supabase dashboard for backup status
3. Consult Supabase support for platform-specific issues
4. Review application logs for export-related errors

