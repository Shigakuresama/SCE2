# Quick Proxy Setup Guide

## Option 1: ScraperAPI (Recommended - Fastest Setup)

1. **Sign up**: https://scraperapi.com/signup
2. **Get API key** from dashboard (1000 free requests/month)
3. **Add to .env**:
   ```bash
   SCRAPER_API_KEY=your_key_here
   ```
4. **Restart server**:
   ```bash
   cd packages/cloud-server
   lsof -ti:3333 | xargs kill -9
   npm run dev
   ```

## Option 2: ZenRows (Backup)

1. **Sign up**: https://zenrows.com/signup
2. **Get API key** from dashboard (1000 free requests/month)
3. **Add to .env**:
   ```bash
   ZENROWS_API_KEY=your_key_here
   ```

## Option 3: RapidAPI (Cheapest)

1. **Sign up**: https://rapidapi.com/
2. **Subscribe to Zillow scraper**: https://rapidapi.com/sparior-api/api/zillow-scraper
3. **Get API key** from dashboard
4. **Add to .env**:
   ```bash
   RAPIDAPI_KEY=your_key_here
   ```

---

## Testing Your Setup

```bash
curl "http://localhost:3333/api/zillow/scrape?address=1909%20W%20Martha%20Ln&zipCode=92706"
```

Should return:
```json
{
  "success": true,
  "data": {
    "sqFt": 1234,
    "yearBuilt": 1970
  }
}
```

---

**Recommendation**: Start with ScraperAPI free tier (1000 requests). Upgrade only if needed.
