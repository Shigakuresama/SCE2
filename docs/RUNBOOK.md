# SCE2 Operations Runbook

This runbook covers deployment procedures, monitoring, common issues, and rollback procedures for the SCE2 platform.

---

## Table of Contents

1. [Deployment Procedures](#deployment-procedures)
2. [Monitoring and Alerts](#monitoring-and-alerts)
3. [Common Issues and Fixes](#common-issues-and-fixes)
4. [Rollback Procedures](#rollback-procedures)
5. [Maintenance Tasks](#maintenance-tasks)
6. [Emergency Contacts](#emergency-contacts)

---

## End-to-End Daily Workflow (Hardened)

Use this sequence for day-to-day operations:

1. Open webapp route builder (`/mobile-pack` locally or `/#/mobile-pack` on deployed static hosting), select houses, and tap **Plan Route**.
2. Tap **Generate PDF** to download the fillable QR route sheet with persisted ordered stops.
3. Optional (desktop): run extension extraction first if you need fresh customer name/phone before PDF.
4. In field, scan each QR from mobile-web and upload:
   - `BILL` image
   - `SIGNATURE` image
   - age/notes as needed
5. Tap **Complete Visit** in mobile-web (enabled only when BILL + SIGNATURE exist and status is `READY_FOR_FIELD`).
6. Back at office/home, open webapp `/field-ops`:
   - filter missing bill/signature/age/notes
   - resolve gaps before submission
7. Run extension submit automation on SCE website (desktop extension only).

### Extension-only Boundaries

- Customer extraction from SCE portal supports two paths:
  - cloud extraction (webapp operator panel) when `SCE_AUTOMATION_ENABLED=true`
  - extension extraction fallback when cloud extraction is disabled or unstable
- Final SCE submission automation is extension-only.
- Mobile/deployed flow supports route planning, fillable PDF generation, QR scan, field data, and document uploads.

### Expected Artifact Organization

- Uploaded files are written to `UPLOAD_DIR` (or `./uploads`) with unique names.
- Each file is tracked in `Document` rows linked by `propertyId` with `docType` (e.g., `BILL`, `SIGNATURE`).
- Operational completeness is reviewed in webapp `/field-ops` by checklist status.

### Status Transition Guardrails

- `PENDING_SCRAPE` → `READY_FOR_FIELD` after extraction.
- `READY_FOR_FIELD` → `VISITED` only through `POST /api/properties/:id/complete-visit`.
- Completion requires both BILL + SIGNATURE documents; otherwise API returns conflict.

### Cloud Extraction Operations (Feature-Flagged)

Use this flow for server-side extraction without the extension:

1. Confirm cloud extraction is enabled in cloud-server:
   - `SCE_AUTOMATION_ENABLED=true`
   - `SCE_SESSION_ENCRYPTION_KEY` is set (32+ byte secret)
   - `SCE_FORM_PATH=/onsite/customer-search`
2. Open webapp Queue page and use the **Cloud Extraction** panel.
3. Create an encrypted session (label + expiry + storage-state JSON).
   - Capture this JSON from an authenticated browser session on
     `https://sce.dsmcentral.com/onsite/customer-search` (not just `sce.com` marketing pages).
   - If runs fail with `Unexpected SCE page .../onsite/`, refresh login and regenerate the session JSON.
4. Select the session, verify property IDs, then click **Run Cloud Extraction**.
5. Monitor run status and counters:
   - `QUEUED` / `RUNNING` / `COMPLETED` / `COMPLETED_WITH_ERRORS` / `FAILED`
6. Confirm successful properties moved to `READY_FOR_FIELD`.
7. For failed items, keep them in `PENDING_SCRAPE` and retry in another run after fixing selector/session issues.

### Cloud Extraction Rollback (Extension Fallback)

If cloud extraction becomes unstable:

1. Set `SCE_AUTOMATION_ENABLED=false` on cloud-server and redeploy.
2. Continue extraction with the desktop extension flow.
3. Keep submission automation on extension path (unchanged).
4. Re-enable cloud extraction only after validating on a small batch (2-3 properties).

---

## Deployment Procedures

### Local Development Deployment

#### Starting All Services

```bash
# From project root
npm run dev
```

**Services:**
- Cloud Server: http://localhost:3333
- Webapp: http://localhost:5173
- Mobile Web: http://localhost:5174

#### Starting Individual Services

```bash
# Cloud server only
npm run dev:cloud

# Webapp only
npm run dev:web

# Mobile web only
npm run dev:mobile
```

### Production Deployment (Render)

#### Prerequisites

1. **GitHub Repository** - Code must be pushed to `main` branch
2. **Render Account** - Account with active services
3. **Environment Variables** - Configured in Render dashboard

#### Auto-Deployment

All three SCE2 services are configured for auto-deployment:

```
GitHub Push (main branch) → Render Webhook → Auto-Build → Auto-Deploy
```

**Trigger:** Push to `main` branch
**Build Time:** ~2-3 minutes per service
**Downtime:** Zero (static sites), ~30 seconds (cloud server)
**Current webapp slug:** `sce2-webap` (`https://sce2-webap.onrender.com`)

#### Manual Deployment (via Render Dashboard)

1. Navigate to https://dashboard.render.com
2. Select service (sce2-cloud-server, sce2-webap, or sce2-mobile)
3. Click "Manual Deploy"
4. Select branch (`main`)
5. Click "Deploy"

#### Manual Deployment (via Render CLI)

```bash
# Install Render CLI
npm install -g @render/cli

# Login
render login

# Find service IDs
render services list -o json | jq -r '.[] | .service? | select(.name=="sce2-cloud-server" or .name=="sce2-webap" or .name=="sce2-mobile") | [.name,.id] | @tsv'

# Trigger deploys (replace <service-id>)
render deploys create <service-id>

# Check latest deploy status
render deploys list <service-id> -o json | jq '.[0] | {id,status,commit: .commit.id,finishedAt}'
```

### Database Migration

#### Development (SQLite)

```bash
cd packages/cloud-server

# Push schema changes
npm run db:push

# Generate Prisma client
npm run db:generate
```

#### Production (PostgreSQL)

```bash
cd packages/cloud-server

# Create migration file
npm run db:migrate

# Review migration file
cat prisma/migrations/<timestamp>/migration.sql

# Apply migration
npm run db:migrate

# Generate Prisma client
npm run db:generate
```

**CAUTION:** Always review migration files before applying to production!

### Environment Variables

#### Local Development

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
# Edit .env with your values
```

#### Production (Render Dashboard)

1. Navigate to service in Render dashboard
2. Scroll to "Environment" section
3. Click "Add Environment Variable"
4. Add key-value pair
5. Click "Save"

**Required Variables:**

| Variable | Cloud Server | Webapp | Mobile Web |
|----------|--------------|--------|------------|
| `DATABASE_URL` | ✅ | ❌ | ❌ |
| `BASE_URL` | ✅ | ✅ | ✅ |
| `ALLOWED_ORIGINS` | ✅ | ❌ | ❌ |
| `SCRAPER_API_KEY` | ✅ | ❌ | ❌ |

---

## Monitoring and Alerts

### Health Checks

#### Cloud Server Health Endpoint

```bash
curl https://sce2-cloud-server.onrender.com/api/health
```

**Expected Response:**
```json
{
  "success": true,
  "message": "SCE2 API is running",
  "timestamp": "2025-02-08T06:12:42.198Z"
}
```

#### Service Availability

| Service | URL | Health Check |
|---------|-----|--------------|
| Cloud Server | https://sce2-cloud-server.onrender.com | `/api/health` |
| Webapp | https://sce2-webap.onrender.com | Returns HTML |
| Mobile Web | https://sce2-mobile.onrender.com | Returns HTML |

### Monitoring Setup

#### Render Dashboard

Render provides built-in monitoring:

1. Navigate to https://dashboard.render.com
2. Select service
3. View metrics:
   - CPU usage
   - Memory usage
   - Response times
   - Error rates
   - Deployments

#### Log Monitoring

View logs via Render dashboard or MCP:

```bash
# Using Render MCP
npx mcp__render__list_logs --resource srv-d63psi7pm1nc738bmqvg --limit 50
```

**Key Log Patterns to Monitor:**

```
[ERROR] - Application errors
[WARN] - Warnings that may need attention
[Proxy] - ScraperAPI activity
[Zillow] - Zillow scraping activity
```

### Alerting

#### Render Built-in Alerts

Configure alerts in Render dashboard:

1. Navigate to service
2. Scroll to "Alerts" section
3. Configure:
   - CPU > 80% for 5 minutes
   - Memory > 90% for 5 minutes
   - Response time > 3 seconds
   - Error rate > 5%

**Notification Channels:**
- Email (default)
- Slack (via webhook)
- Discord (via webhook)
- PagerDuty (integration)

#### Custom Alerts (Optional)

Set up external monitoring with:

- **UptimeRobot** - https://uptimerobot.com
- **Pingdom** - https://www.pingdom.com
- **StatusCake** - https://www.statuscake.com

Monitor:
- `/api/health` endpoint
- Webapp homepage
- Mobile web homepage

### Performance Metrics

#### Key Performance Indicators (KPIs)

| Metric | Target | Current |
|--------|--------|---------|
| Cloud Server Uptime | > 99.5% | TBD |
| API Response Time | < 2 seconds | ~2-3 seconds |
| Error Rate | < 1% | 0% |
| ScraperAPI Success Rate | > 95% | ~100% (fallback to defaults) |

#### Database Performance

**Monitoring Prisma:**

```bash
cd packages/cloud-server

# Enable query logging (development)
# Already enabled in development mode

# Check database size
ls -lh dev.sqlite

# Check for slow queries
# Review logs for "SELECT" statements
```

---

## Common Issues and Fixes

### Issue: Cloud Server Not Starting

**Symptoms:**
- Service shows "Deploy failed" in Render dashboard
- `/api/health` returns connection refused
- Logs show "EADDRINUSE" or "Cannot start service"

**Diagnosis:**

```bash
# Check Render logs
npx mcp__render__list_logs --resource srv-d63psi7pm1nc738bmqvg --limit 20

# Check for port conflicts
# Look for "EADDRINUSE" in logs
```

**Fixes:**

1. **Port conflict:**
   ```bash
   # Ensure PORT is set correctly in environment variables
   PORT=3333
   ```

2. **Database locked:**
   ```bash
   # Kill existing connections
   # Restart service via Render dashboard
   ```

3. **Missing dependencies:**
   ```bash
   # Rebuild service
   npm run build:prod
   ```

4. **Prisma client not generated:**
   ```bash
   # Add to build script
   npx prisma generate
   ```

### Issue: ScraperAPI Failing

**Symptoms:**
- Zillow scraping returns 403 errors
- Logs show "ScraperAPI failed"
- Property data missing

**Diagnosis:**

```bash
# Check logs for ScraperAPI errors
npx mcp__render__list_logs --resource srv-d63psi7pm1nc738bmqvg --type app | grep -i "scraperapi"
```

**Fixes:**

1. **Invalid API key:**
   ```bash
   # Verify SCRAPER_API_KEY in Render dashboard
   # Get new key from https://scraperapi.com/
   ```

2. **Rate limit exceeded:**
   ```
   # Free tier: 1000 requests/month
   # Upgrade plan or reduce scraping frequency
   ```

3. **Fallback to defaults:**
   ```
   # System already falls back to defaults
   # sqFt: 1200, yearBuilt: 1970
   ```

### Issue: Extension Not Connecting

**Symptoms:**
- Extension shows "Connection failed"
- No data in extension popup
- Console shows CORS errors

**Diagnosis:**

```bash
# Check extension background console
chrome://extensions/ → Service worker

# Check CORS configuration
# Verify ALLOWED_ORIGINS includes extension
```

**Fixes:**

1. **CORS misconfiguration:**
   ```bash
   # Update ALLOWED_ORIGINS in cloud-server .env
   ALLOWED_ORIGINS="chrome-extension://*,http://localhost:5173"
   ```

2. **Server not running:**
   ```bash
   # Check /api/health endpoint
   curl https://sce2-cloud-server.onrender.com/api/health
   ```

3. **Base URL mismatch:**
   ```bash
   # Ensure BASE_URL matches deployed URL
   BASE_URL="https://sce2-cloud-server.onrender.com"
   ```

### Issue: Map Drawing Not Working

**Symptoms:**
- Rectangle/circle drawing not working
- Click events not registering
- Shapes not appearing on map

**Diagnosis:**

```bash
# Check browser console for errors
# Look for Leaflet-related errors
```

**Fixes:**

1. **Use click-move-click pattern:**
   - First click: set start point
   - Second click: complete shape

2. **Event listener cleanup issue:**
   ```typescript
   // Fixed in MapLayout.tsx
   // Ensure cleanup only removes active mode listeners
   ```

3. **Leaflet not loaded:**
   ```bash
   # Check network tab for leaflet.js
   # Verify leaflet is in dependencies
   ```

### Issue: Database Migration Failed

**Symptoms:**
- `npm run db:migrate` fails
- Database schema out of sync
- Prisma errors

**Diagnosis:**

```bash
# Check migration status
cd packages/cloud-server
npx prisma migrate status
```

**Fixes:**

1. **Resolve migration conflict:**
   ```bash
   # Reset database (DEV ONLY!)
   npx prisma migrate reset --force

   # Re-apply migrations
   npx prisma migrate dev
   ```

2. **Manual schema sync (dev):**
   ```bash
   # Push schema without migration
   npx prisma db push
   ```

3. **Generate Prisma client:**
   ```bash
   npx prisma generate
   ```

### Issue: High Memory Usage

**Symptoms:**
- Render service shows high memory
- Service crashes or restarts
- Slow response times

**Diagnosis:**

```bash
# Check Render metrics
# Memory usage > 90% indicates problem
```

**Fixes:**

1. **Memory leak in code:**
   ```typescript
   // Check for:
   // - Unclosed connections
   // - Global variables growing unbounded
   // - Event listeners not removed
   ```

2. **Upgrade Render plan:**
   ```
   # Free tier: 512 MB RAM
   # Starter: 512 MB - 2 GB RAM
   # Standard: 2 GB - 8 GB RAM
   ```

3. **Add memory monitoring:**
   ```typescript
   // Log memory usage periodically
   setInterval(() => {
     const used = process.memoryUsage();
     console.log(`Memory: ${Math.round(used.rss / 1024 / 1024)}MB`);
   }, 60000); // Every minute
   ```

### Issue: Fillable PDF Fields Not Working

**Symptoms:**
- PDF fields are not clickable
- Cannot type into AGE or NOTES fields
- Export button does nothing

**Diagnosis:**

Check PDF viewer supports AcroForm fields:
- Adobe Acrobat Reader: ✅ Supported
- Preview (macOS): ❌ Not supported
- Browser viewers: ⚠️ Partial support
- Tablet PDF apps: ✅ Usually supported

**Fixes:**

1. **Use compatible PDF viewer**
   ```bash
   # Recommended viewers:
   - Adobe Acrobat Reader (free)
   - Foxit Reader (free)
   - PDF-XChange Editor (free)
   ```

2. **Enable form filling in viewer settings**
   ```
   Adobe Reader: Edit → Preferences → Forms → Enable form filling
   ```

3. **Alternative: Use mobile web as primary data entry**
   - Scan QR code
   - Fill fields in mobile web app
   - PDF serves as reference only

4. **Verify PDF field generation**
   ```bash
   # Check PDF was generated with form fields
   # Open PDF in Adobe Reader
   # Look for "Form" field indicators (highlighted areas)
   ```

5. **Export PDF form data**
   ```bash
   # If fields are filled but not syncing:
   # 1. Open webapp
   # 2. Click "Export PDF Form Data"
   # 3. Select the PDF file
   # 4. Data should sync to database
   ```

---

## Rollback Procedures

### Git Rollback (Code Changes)

#### Undo Last Commit (Local)

```bash
# Soft reset (keep changes)
git reset --soft HEAD~1

# Hard reset (discard changes)
git reset --hard HEAD~1
```

#### Undo Published Commit (Remote)

```bash
# Revert commit (creates new commit)
git revert <commit-hash>

# Push revert
git push origin main
```

**Example:**
```bash
# Revert last commit
git revert HEAD
git push origin main

# Revert specific commit
git revert 37399e2
git push origin main
```

### Render Rollback (Deployment)

#### Automatic Rollback (via Git)

```bash
# Revert to previous commit
git revert HEAD

# Push to trigger auto-deployment
git push origin main

# Render will auto-deploy the reverted commit
```

#### Manual Rollback (via Render Dashboard)

1. Navigate to https://dashboard.render.com
2. Select service
3. Scroll to "Events" section
4. Find previous successful deployment
5. Click "Redeploy" on that event

#### Rollback to Specific Commit

```bash
# Checkout specific commit
git checkout <commit-hash>

# Create rollback branch
git checkout -b rollback/<commit-hash>

# Push rollback branch
git push origin rollback/<commit-hash>

# Update Render to deploy from rollback branch
# (Via dashboard: service → Settings → Branch)
```

### Database Rollback

#### Revert Last Migration

```bash
cd packages/cloud-server

# List migrations
npx prisma migrate status

# Revert last migration
npx prisma migrate resolve --rolled-back <migration-name>

# Or reset entire database (DEV ONLY!)
npx prisma migrate reset --force
```

**WARNING:** `migrate reset` deletes all data! Only use in development.

#### Restore from Backup

```bash
# If using PostgreSQL with backups
# Restore from backup via Render dashboard:
# Database → Backups → Restore

# Or via psql
pg_restore -d sce_db backup.sql
```

### Extension Rollback

#### Reinstall Previous Version

```bash
# Checkout previous commit
git checkout <previous-commit-hash>

# Rebuild extension
cd packages/extension
npm run build

# Reload extension in Chrome:
# chrome://extensions/ → Reload button
```

#### Uninstall Extension

1. Navigate to `chrome://extensions/`
2. Find "SCE2 Rebate Automation"
3. Click "Remove"
4. Confirm removal

---

## Maintenance Tasks

### Daily Checks

- [ ] Check Render dashboard for failed deployments
- [ ] Review error logs for patterns
- [ ] Verify all services are running
- [ ] Check ScraperAPI usage (if actively scraping)

### Weekly Tasks

- [ ] Review and rotate logs (if needed)
- [ ] Check database size and growth
- [ ] Review Render metrics (CPU, memory)
- [ ] Test critical user flows

### Monthly Tasks

- [ ] Update dependencies (npm packages)
- [ ] Review and update documentation
- [ ] Backup database (if using PostgreSQL)
- [ ] Review ScraperAPI usage and costs
- [ ] Security audit (check for vulnerabilities)

### Quarterly Tasks

- [ ] Major dependency upgrades
- [ ] Performance optimization review
- [ ] Cost analysis (Render, ScraperAPI, etc.)
- [ ] Disaster recovery drill

---

## Emergency Contacts

### Render Support

- **Documentation:** https://render.com/docs
- **Support:** https://render.com/support
- **Status Page:** https://status.render.com

### ScraperAPI Support

- **Documentation:** https://scraperapi.com/documentation
- **Support:** https://scraperapi.com/contact
- **Dashboard:** https://scraperapi.com/dashboard

### GitHub Repository

- **Issues:** https://github.com/Shigakuresama/SCE2/issues
- **Discussions:** https://github.com/Shigakuresama/SCE2/discussions

### Internal Contacts

*(Add your team's contact information here)*

- **Primary Developer:** [Name] - [Email] - [Phone]
- **Backup Developer:** [Name] - [Email] - [Phone]
- **DevOps Lead:** [Name] - [Email] - [Phone]

---

## Appendix

### Service URLs

| Service | Production URL | Staging URL |
|---------|----------------|-------------|
| Cloud Server | https://sce2-cloud-server.onrender.com | N/A |
| Webapp | https://sce2-webap.onrender.com | N/A |
| Mobile Web | https://sce2-mobile.onrender.com | N/A |

### Quick Reference

| Task | Command |
|------|---------|
| Check health | `curl https://sce2-cloud-server.onrender.com/api/health` |
| View logs | `npx mcp__render__list_logs --resource srv-d63psi7pm1nc738bmqvg` |
| Restart service | Render dashboard → service → Manual Deploy → Restart |
| Rollback deployment | `git revert HEAD && git push origin main` |
| Database migration | `cd packages/cloud-server && npm run db:migrate` |

### Related Documentation

- **Developer Guide:** `docs/CONTRIB.md`
- **Setup Guide:** `docs/SETUP_COMPLETE.md`
- **Deployment Guide:** `docs/RENDER_DEPLOYMENT.md`
- **Architecture:** `CLAUDE.md`

---

**Last Updated:** 2026-02-11
**Version:** 1.0.0
