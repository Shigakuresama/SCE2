# Deploying SCE2 to Render.com

This guide walks you through deploying SCE2 to Render.com's free tier.

## Prerequisites

1. **GitHub Repository**: Push your SCE2 code to GitHub
2. **Render Account**: Sign up at [render.com](https://render.com)
3. **ScraperAPI Key** (optional): For Zillow scraping proxy

## Step 1: Push Code to GitHub

```bash
# If you haven't already:
git add .
git commit -m "Add Render deployment configuration"
git push origin main
```

## Step 2: Create Render Account

1. Go to [render.com](https://render.com)
2. Click "Sign Up"
3. Sign up with GitHub (recommended)

## Step 3: Deploy

### Option A: Automatic Deploy (Recommended)

1. In Render dashboard, click **"New +"**
2. Select **"Render.yaml"**
3. Connect your GitHub repository
4. Select the `SCE2` repository
5. Click **"Apply"**

Render will automatically deploy all services:
- `sce2-cloud-server` (API)
- `sce2-webap` (Desktop web app)
- `sce2-mobile` (Mobile web app)
- `sce2-db` (PostgreSQL database)

### Option B: Manual Deploy

#### Deploy Database First
1. Click **"New +"**
2. Select **"PostgreSQL"**
3. Name: `sce2-db`
4. Database: `sce2`
5. User: `sce2_user`
6. Plan: **Free**
7. Click **"Create Database"**

#### Deploy Cloud Server
1. Click **"New +"**
2. Select **"Web Service"**
3. Connect your GitHub repo
4. Configure:
   - **Name**: `sce2-cloud-server`
   - **Environment**: `Node`
   - **Build Command**: `cd packages/cloud-server && npm install && npm run build && npx playwright install chromium`
   - **Start Command**: `cd packages/cloud-server && npm run db:push && npm start`
   - **Plan**: **Free**
5. Add Environment Variables:
   - `NODE_ENV` = `production`
   - `PORT` = `3333`
   - `ALLOWED_ORIGINS` = `https://sce2-webap.onrender.com,https://sce2-mobile.onrender.com`
   - `BASE_URL` = `https://sce2-cloud-server.onrender.com`
   - `SCE_BASE_URL` = `https://sce.dsmcentral.com`
   - `SCE_FORM_PATH` = `/onsite/customer-search`
   - `SCE_LOGIN_URL` = `https://sce-trade-ally-community.my.site.com/tradeally/s/login/?ec=302&inst=Vt&startURL=%2Ftradeally%2Fsite%2FSiteLogin.apexp`
   - `SCE_AUTOMATION_ENABLED` = `false` (default rollout-safe value)
   - `SCE_SESSION_ENCRYPTION_KEY` = `<32+ byte secret>`
   - `SCE_AUTOMATION_TIMEOUT_MS` = `45000`
   - `PLAYWRIGHT_BROWSERS_PATH` = `0`
   - Connect the `sce2-db` database as `DATABASE_URL`
6. Click **"Deploy Web Service"**

#### Deploy Webapp
1. Click **"New +"**
2. Select **"Static Site"**
3. Configure:
   - **Name**: `sce2-webap`
   - **Build Command**: `npm install && npm run build --workspace=packages/webapp`
   - **Publish Directory**: `./packages/webapp/dist`
   - **Plan**: **Free**
4. Add Environment Variables:
   - `VITE_CLOUD_BASE_URL` = `https://sce2-cloud-server.onrender.com`
   - `VITE_MOBILE_BASE_URL` = `https://sce2-mobile.onrender.com`
5. Click **"Deploy Static Site"**

#### Deploy Mobile Web
Repeat the webapp steps with:
- **Name**: `sce2-mobile`
- **Build Command**: `npm install && npm run build --workspace=packages/mobile-web`
- **Publish Directory**: `./packages/mobile-web/dist`
- Environment Variable:
  - `VITE_API_BASE_URL` = `https://sce2-cloud-server.onrender.com`

## Step 4: Set ScraperAPI Key (Optional)

If you want Zillow scraping to work with proxy:

1. Go to `sce2-cloud-server` service in Render
2. Scroll to **"Environment"** section
3. Add variable:
   - `SCRAPER_API_KEY` = `your-api-key-here`
4. Click **"Save Changes"

## Step 5: Test Your Deployment

### Check API Health
```bash
curl https://sce2-cloud-server.onrender.com/api/health
```

### Access Webapps
- **Desktop**: https://sce2-webap.onrender.com
- **Mobile**: https://sce2-mobile.onrender.com
- **Queue (direct link)**: https://sce2-webap.onrender.com/#/queue

### Generate Test PDF
1. Open webapp URL
2. Open route builder at `https://sce2-webap.onrender.com/#/mobile-pack`
3. Add some properties
4. Generate PDF with QR codes
5. Scan QR code with your phone
6. Should open mobile upload interface

## URLs After Deployment

Once deployed, your URLs will be:
- **API**: `https://sce2-cloud-server.onrender.com`
- **Webapp**: `https://sce2-webap.onrender.com`
- **Mobile**: `https://sce2-mobile.onrender.com`

> Note: Production currently uses the `sce2-webap` slug. `sce2-webapp.onrender.com` is not active.

## Important Notes

### Free Tier Limitations

**Cloud Server (API)**:
- Spins down after 15 minutes of inactivity
- Takes ~30 seconds to wake up on first request
- This means the first API call after inactivity will be slow

**Static Sites** (Webapp & Mobile):
- No spin-down, always fast
- Truly free, no limitations

**Database**:
- Free for 90 days
- $7/month after that

### Custom Domains (Optional)

If you want custom domains:
1. Buy a domain (Namecheap, GoDaddy, etc.)
2. In Render service, go to **"Settings"** → **"Custom Domains"**
3. Add your domain
4. Update DNS records as instructed

### Database Backups

Render automatically backs up PostgreSQL:
- **Daily backups** are kept for 7 days on free tier
- Download backups from **"Dashboard"** → **"sce2-db"** → **"Backups"**

## Troubleshooting

### Build Fails

Check the **"Logs"** tab in your service. Common issues:
- Missing dependencies → Check `package.json`
- TypeScript errors → Run `npm run build` locally first
- Database connection → Ensure database is deployed first

### Service Won't Start

1. Check **"Environment"** variables are correct
2. Check **"Logs"** for errors
3. Ensure database is deployed and connected

### Cloud Extraction Fails On Render

1. Confirm `SCE_AUTOMATION_ENABLED=true` only when you are actively rolling out cloud extraction.
2. Verify `SCE_SESSION_ENCRYPTION_KEY` is set and non-empty.
3. Confirm build logs include `npx playwright install chromium`.
4. Validate a session from webapp Queue panel before starting runs.
5. Note: run start now performs session preflight validation and returns `400` for invalid sessions.
6. If sessions keep landing on `/onsite`, recreate login bridge session and validate until URL includes `/onsite/customer-search`.
7. If Playwright launch errors continue, set `SCE_AUTOMATION_ENABLED=false` and use extension fallback until runtime is fixed.

### API Returns 403/CORS Errors

1. Check `ALLOWED_ORIGINS` includes your Render URLs
2. Ensure frontend URLs are correct

### Queue Path Returns 404

1. Use `https://sce2-webap.onrender.com/#/queue` instead of `/queue`
2. Static hosting serves the SPA from `index.html`; hash routing avoids deep-link 404s
3. Hard refresh (`Ctrl/Cmd + Shift + R`) after deployment to load the latest router bundle

### QR Codes Don't Work

1. Check `VITE_MOBILE_BASE_URL` in webapp environment
2. Ensure mobile service is deployed
3. Verify mobile URL is accessible

## Monitoring

Monitor your services:
- Go to **[Render Dashboard](https://dashboard.render.com)**
- Each service shows:
  - CPU/Memory usage
  - Request counts
  - Response times
  - Error logs

## Next Steps

After successful deployment:
1. Test all functionality
2. Set up monitoring alerts (optional)
3. Consider upgrading to paid tier if spin-down is problematic
4. Add custom domain (optional)
5. Set up automated backups

## Cost Estimate

**Free Tier**:
- Cloud Server: $0 (with spin-down)
- Webapp: $0 (static site)
- Mobile: $0 (static site)
- Database: $0 for 90 days, then $7/month

**After 90 days**:
- Total: ~$7/month (database only)
- Or upgrade Cloud Server to Starter ($7/month) to avoid spin-down

## Support

- Render Docs: https://render.com/docs
- Render Status: https://status.render.com
- Email: support@render.com
