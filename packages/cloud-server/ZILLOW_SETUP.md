# Zillow Scraping Setup Guide

SCE2 supports automatic Zillow property data enrichment (square footage, year built, etc.). However, Zillow has strong anti-bot protection that blocks direct scraping.

To enable automatic Zillow data, you need to use a **proxy service**. Choose one of the options below:

## Quick Setup (Choose One)

### Option 1: ScraperAPI (Recommended) ✅

**Best for:** Reliability, ease of use
**Cost:** $49/month
**Free tier:** 1000 requests/month

1. Sign up at https://scraperapi.com/
2. Get your API key from the dashboard
3. Add to your `.env` file:
   ```
   SCRAPER_API_KEY=your_api_key_here
   ```
4. Restart the server

**Why ScraperAPI?**
- Handles anti-bot protection automatically
- 99.9% success rate
- No code changes needed
- Best documentation

---

### Option 2: ZenRows

**Best for:** Higher success rate
**Cost:** $49/month
**Free tier:** 1000 requests/month

1. Sign up at https://zenrows.com/
2. Get your API key from the dashboard
3. Add to your `.env` file:
   ```
   ZENROWS_API_KEY=your_api_key_here
   ```
4. Restart the server

**Why ZenRows?**
- Slightly better success rate than ScraperAPI
- Faster response times
- Good API documentation

---

### Option 3: RapidAPI (Cheapest)

**Best for:** Low volume, cost-effective
**Cost:** Starting at $5/month
**Free tier:** Varies by API

1. Sign up at https://rapidapi.com/
2. Get your API key from the dashboard
3. Subscribe to a Zillow scraper API:
   - https://rapidapi.com/sparior-api/api/zillow-scraper (recommended)
   - Or search for "Zillow" on RapidAPI
4. Add to your `.env` file:
   ```
   RAPIDAPI_KEY=your_api_key_here
   ```
5. Restart the server

**Why RapidAPI?**
- Cheapest option
- Multiple scraper options
- Pay per use

---

## Without Proxy Service

The extension **will still work perfectly** without a proxy service. You'll just:
- Manually enter square footage and year built in extension options
- Or manually enter them for each property during scraping

All other data (customer name, phone, email, etc.) is still scraped automatically from the SCE website.

---

## Testing Your Setup

After configuring a proxy service:

1. Restart the cloud server:
   ```bash
   cd packages/cloud-server
   npm run dev
   ```

2. Test the endpoint:
   ```bash
   curl "http://localhost:3333/api/zillow/scrape?address=1909%20W%20Martha%20Ln&zipCode=92706"
   ```

3. If working, you should see:
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

## How It Works

1. **Extension scrapes SCE website** → Gets customer info (name, phone, email)
2. **Extension calls server API** → Gets Zillow data automatically
3. **Server tries proxy services** → In order: ScraperAPI → ZenRows → RapidAPI → Direct
4. **Extension fills form** → Uses all available data

---

## Troubleshooting

**Q: Still getting 403 Forbidden after setting up proxy?**
A: Check that:
- API key is correct (no extra spaces)
- Server was restarted after adding key
- API key is active (not suspended/trial expired)

**Q: Empty data returned?**
A: The property might not exist on Zillow. Try a different address.

**Q: Rate limited?**
A: Free tiers have limits. Upgrade or try a different service.

---

## Cost Comparison

| Service    | Free Tier | Paid Starting | Success Rate |
|------------|-----------|---------------|--------------|
| ScraperAPI | 1K/month  | $49/month     | 99.9%        |
| ZenRows    | 1K/month  | $49/month     | 99.95%       |
| RapidAPI   | Varies    | $5/month      | 95-99%       |

**Recommendation:** Start with ScraperAPI's free tier to test. If you need more requests, the paid plans are worth it for the time saved.

---

## Questions?

- ScraperAPI docs: https://scraperapi.com/documentation/
- ZenRows docs: https://www.zenrows.com/documentation
- RapidAPI docs: https://rapidapi.com/learn/rest
