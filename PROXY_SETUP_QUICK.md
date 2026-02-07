# Complete Proxy Setup Guide - Follow These Steps

## Step 1: Sign Up for ScraperAPI (Recommended)

1. Go to: https://scraperapi.com/signup
2. Sign up with email (use scm.energysavings@gmail.com)
3. You'll get 1000 free requests per month
4. Get your API key from the dashboard

## Step 2: Add API Key to Environment

Edit `/home/sergio/Projects/SCE2/packages/cloud-server/.env`:

```bash
SCRAPER_API_KEY=your_actual_api_key_here
```

## Step 3: Restart Server

```bash
cd /home/sergio/Projects/SCE2/packages/cloud-server
lsof -ti:3333 | xargs kill -9 2>/dev/null
npm run dev
```

## Step 4: Test It Works

```bash
curl "http://localhost:3333/api/zillow/scrape?address=1909%20W%20Martha%20Ln&zipCode=92706"
```

Should return:
```json
{
  "success": true,
  "data": {
    "sqFt": 1234,
    "yearBuilt": 1970,
    ...
  }
}
```

---

## Quick Start Summary

1. Signup: https://scraperapi.com/signup
2. Get API key from dashboard
3. Add to `.env`: `SCRAPER_API_KEY=xxx`
4. Restart server
5. Test with curl above

**That's it!** The extension will now automatically fetch Zillow data.
