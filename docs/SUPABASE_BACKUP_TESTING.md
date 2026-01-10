# Testing Supabase Backups via CLI

This guide provides step-by-step instructions for testing Supabase backups using the Supabase CLI.

## Prerequisites

1. **Install Supabase CLI:**
   ```bash
   # macOS
   brew install supabase/tap/supabase
   
   # Or using npm
   npm install -g supabase
   ```

2. **Authenticate:**
   ```bash
   supabase login
   ```
   This will open your browser to authenticate and store your access token.

3. **Get Your Project Reference:**
   - Find your project ref in the Supabase dashboard URL: `https://app.supabase.com/project/<project-ref>`
   - Or list projects: `supabase projects list`

## Quick Test

### Option 1: Using the Test Script (Recommended)

```bash
# Interactive mode - will guide you through the process
./scripts/test-supabase-backups.sh

# Non-interactive mode with project ref
./scripts/test-supabase-backups.sh <your-project-ref>

# Or set environment variable
export SUPABASE_PROJECT_REF=<your-project-ref>
./scripts/test-supabase-backups.sh
```

### Option 2: Manual CLI Commands

#### Step 1: List Your Projects
```bash
supabase projects list
```

Output will show:
```
  ID  |        Name        |    Region    |      Created
------+--------------------+--------------+------------------
 abc  | my-project         | us-east-1    | 2024-01-15 10:00
 def  | staging-project    | eu-west-1    | 2024-01-20 14:30
```

#### Step 2: List Backups for a Project
```bash
supabase db backups list --project-ref <your-project-ref>
```

Example output:
```
  ID                                    | Created At          | Size
----------------------------------------+---------------------+--------
 backup_abc123                          | 2025-01-15 02:00:00 | 45 MB
 backup_def456                          | 2025-01-14 02:00:00 | 44 MB
 backup_ghi789                          | 2025-01-13 02:00:00 | 43 MB
```

**What to Look For:**
- ✓ Backups exist and are recent (within last 1-3 days)
- ✓ Backup sizes are reasonable (not 0 bytes)
- ✓ Multiple backups available (indicates regular schedule)

#### Step 3: Verify Backup Health
```bash
# Check if backups are being created regularly
supabase db backups list --project-ref <project-ref> | head -5
```

**Red Flags:**
- ❌ "No backups found" - backups may not be enabled
- ❌ Last backup is > 7 days old - daily backups may have stopped
- ❌ Backup size is 0 bytes - backup may have failed

## Testing Backup Restoration

### ⚠️ IMPORTANT: Test on Staging First!

Never test restore on production without:
1. Taking a manual export first
2. Testing on a staging/test project
3. Having a rollback plan

### Safe Testing Procedure

#### 1. Create a Test Project (Recommended)
```bash
# Create a new test project via dashboard or CLI
# This allows you to test restore without affecting production
```

#### 2. Test Restore to Test Project
```bash
# List backups to find one to restore
supabase db backups list --project-ref <production-project-ref>

# Restore to test project (replace with test project ref)
supabase db restore <backup-id> --project-ref <test-project-ref>
```

#### 3. Verify Restored Data
```bash
# Connect to restored database and verify:
# - Table row counts match expectations
# - Foreign key relationships are intact
# - Critical data is present and correct

# Use Supabase Studio or psql
supabase db remote commit --project-ref <test-project-ref>
```

#### 4. Test Application Functionality
- Run your application against the restored database
- Verify critical workflows still work
- Check data integrity across related tables

## Automated Testing

### Weekly Backup Health Check

Create a cron job to check backups weekly:

```bash
# Add to crontab (crontab -e)
# Every Monday at 9 AM
0 9 * * 1 /path/to/scripts/test-supabase-backups.sh <project-ref> >> /var/log/supabase-backup-check.log 2>&1
```

### CI/CD Integration

Add backup verification to your CI pipeline:

```yaml
# .github/workflows/check-backups.yml
name: Check Backups

on:
  schedule:
    - cron: '0 9 * * 1'  # Weekly on Monday
  workflow_dispatch:

jobs:
  check-backups:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
        with:
          version: latest
      
      - name: Check Backup Health
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
          SUPABASE_PROJECT_REF: ${{ secrets.SUPABASE_PROJECT_REF }}
        run: |
          chmod +x scripts/test-supabase-backups.sh
          ./scripts/test-supabase-backups.sh
```

## Troubleshooting

### "Access token not provided"
```bash
# Solution: Login again
supabase login
# Or set environment variable
export SUPABASE_ACCESS_TOKEN=<your-token>
```

### "No backups found"
**Possible causes:**
1. Project is on Free tier (backups require Pro+)
2. Project is too new (first backup takes 24 hours)
3. Backups are disabled in project settings

**Solutions:**
- Check your Supabase plan in dashboard
- Verify backups are enabled: Settings → Database → Backups
- Wait 24-48 hours for first backup if project is new

### "Failed to list backups"
**Possible causes:**
1. Invalid project ref
2. Network issues
3. API rate limiting

**Solutions:**
- Verify project ref is correct: `supabase projects list`
- Check your internet connection
- Wait a few minutes and retry (rate limit resets)

### "Backup restore failed"
**Possible causes:**
1. Insufficient permissions
2. Backup is corrupted
3. Database is in use

**Solutions:**
- Ensure you have admin access to the project
- Try a different backup ID
- Check if database has active connections
- Contact Supabase support if issue persists

## Advanced: Point-in-Time Recovery (Pro+ Only)

If you're on Pro plan or higher, you can restore to any specific timestamp:

```bash
# Restore to a specific date and time
supabase db restore \
  --timestamp "2025-01-15 14:30:00" \
  --project-ref <project-ref>

# Useful for:
# - Recovering from accidental data deletion
# - Rolling back specific changes
# - Testing data at a specific point in time
```

## Best Practices

1. **Regular Verification:**
   - Check backups weekly (automated via cron)
   - Verify at least one backup exists
   - Check backup sizes are reasonable

2. **Test Restores:**
   - Test restore procedure monthly
   - Use staging/test project for testing
   - Document any issues encountered

3. **Monitor Backup Age:**
   - Ensure backups are created daily
   - Alert if last backup is > 2 days old
   - Keep retention policy appropriate for your needs

4. **Documentation:**
   - Document your project refs
   - Keep notes on backup testing results
   - Update recovery procedures based on tests

## Quick Reference

```bash
# Authentication
supabase login

# List projects
supabase projects list

# List backups
supabase db backups list --project-ref <ref>

# View backup details
supabase db backups list --project-ref <ref> | grep <backup-id>

# Restore from backup (⚠️ use with caution)
supabase db restore <backup-id> --project-ref <ref>

# Point-in-time restore (Pro+)
supabase db restore --timestamp "YYYY-MM-DD HH:MM:SS" --project-ref <ref>

# Automated test
./scripts/test-supabase-backups.sh <ref>
```

## Additional Resources

- [Supabase CLI Documentation](https://supabase.com/docs/reference/cli)
- [Supabase Backup Documentation](https://supabase.com/docs/guides/platform/backups)
- [Point-in-Time Recovery Guide](https://supabase.com/docs/guides/platform/backups#point-in-time-recovery)

