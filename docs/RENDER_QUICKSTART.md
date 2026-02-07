# Quick Start: Deploy SCE2 to Render.com

## 📋 What You Need

- GitHub account
- Render.com account (free)
- 5-10 minutes

## 🚀 Quick Deploy Steps

### 1. Commit Your Changes

```bash
git add .
git commit -m "Add Render deployment configuration"
git push origin main
```

### 2. Sign Up for Render

1. Go to https://render.com
2. Click "Sign Up"
3. **Sign up with GitHub** (recommended)

### 3. Deploy Your App

**Option A: Easiest (Auto-deploy with render.yaml)**

1. In Render dashboard, click **"New +"**
2. Select **"Render.yaml"**
3. Click **"Connect GitHub"** (if not connected)
4. Select your **SCE2** repository
5. Click **"Apply"**

That's it! Render will deploy:
- ✅ Cloud Server (API)
- ✅ Webapp (Desktop)
- ✅ Mobile Web
- ✅ PostgreSQL Database

**Option B: Manual Deploy**

See `docs/RENDER_DEPLOYMENT.md` for detailed manual steps.

### 4. Wait for Deployment

- Takes about 5-10 minutes
- Watch progress in Render dashboard
- You'll see logs for each service

### 5. Get Your URLs

After deployment, your URLs will be:
- **API**: `https://sce2-cloud-server.onrender.com`
- **Webapp**: `https://sce2-webapp.onrender.com`
- **Mobile**: `https://sce2-mobile.onrender.com`

### 6. Test

1. Open webapp URL
2. Generate a PDF with QR codes
3. Scan QR code with phone
4. Should open mobile upload page! 📱

## 💰 Cost

**Free Tier:**
- Cloud Server: $0 (spins down after 15 min inactivity)
- Webapp: $0 (always fast)
- Mobile: $0 (always fast)
- Database: $0 for 90 days, then $7/month

**Total after 90 days:** ~$7/month

## ⚠️ Important Notes

**Spin Down (Free Tier)**
- API "sleeps" after 15 minutes of no activity
- First request takes ~30 seconds to wake up
- Only affects the API (not webapp/mobile)
- Upgrade to $7/month to avoid this

**Database**
- Free for 90 days
- After that: $7/month
- Automatic daily backups

## 🔧 Troubleshooting

**Build fails?**
- Check logs in Render dashboard
- Make sure all dependencies are in package.json

**API returns 403?**
- Check `ALLOWED_ORIGINS` environment variable
- Should include your Render URLs

**QR codes don't work?**
- Check `VITE_MOBILE_BASE_URL` in webapp
- Should be `https://sce2-mobile.onrender.com`

## 📚 Full Documentation

See `docs/RENDER_DEPLOYMENT.md` for complete guide including:
- Manual deployment steps
- Custom domain setup
- Environment variables
- Monitoring
- Database backups
- Troubleshooting

## 🎉 You're Done!

Your SCE2 is now:
- ✅ Hosted on the cloud
- ✅ Accessible from anywhere
- ✅ QR codes work from scanned PDFs
- ✅ Photo upload works from mobile

Questions? Check the full deployment guide or Render's documentation.
