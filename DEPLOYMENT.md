# 🚀 Deployment Guide

This guide provides step-by-step instructions to deploy your Hide & Seek 3D game to free hosting platforms that require **no sign-up for end users**.

## Quick Deploy Options

### Option 1: Render (Recommended) ⭐

**Render provides free hosting with automatic HTTPS (required for WebRTC voice chat on mobile).**

#### Steps:
1. Go to [render.com](https://render.com) and sign up (you only - users don't need accounts)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository: `moostafia/hide-seek-3d`
4. Render will auto-detect the `render.yaml` configuration
5. Click "Create Web Service"
6. Wait ~5 minutes for deployment
7. Your game will be live at: `https://hide-seek-3d.onrender.com` (or similar)

**Share this URL with anyone - no sign-up required for players!**

#### Configuration (already included in render.yaml):
- Build Command: `npm install`
- Start Command: `npm start`
- Environment: Node
- Free tier includes: 750 hours/month

---

### Option 2: Railway.app

**Railway offers generous free tier with excellent WebSocket support.**

#### Steps:
1. Go to [railway.app](https://railway.app)
2. Click "Start a New Project"
3. Select "Deploy from GitHub repo"
4. Choose `moostafia/hide-seek-3d`
5. Railway auto-detects Node.js app
6. Click "Deploy"
7. After deployment, click "Generate Domain" in Settings
8. Your game will be at: `https://hide-seek-3d.up.railway.app` (or similar)

**Share this URL with anyone!**

---

### Option 3: Glitch

**Glitch provides instant deployment and live editing.**

#### Steps:
1. Go to [glitch.com](https://glitch.com)
2. Click "New Project" → "Import from GitHub"
3. Paste your repo URL: `https://github.com/moostafia/hide-seek-3d`
4. Glitch will automatically deploy
5. Click "Share" → "Live App" to get your URL
6. Your game will be at: `https://hide-seek-3d.glitch.me` (or similar)

**Share this URL with anyone!**

**Note:** Glitch apps sleep after 5 minutes of inactivity but wake up instantly when visited.

---

### Option 4: Vercel (Alternative)

**Vercel is great for static sites but requires configuration for WebSocket.**

#### Steps:
1. Go to [vercel.com](https://vercel.com)
2. Click "Import Project"
3. Import from GitHub: `moostafia/hide-seek-3d`
4. Vercel auto-detects `vercel.json` configuration
5. Click "Deploy"
6. Your game will be at: `https://hide-seek-3d.vercel.app` (or similar)

**Note:** WebSocket may have limitations on Vercel's free tier.

---

## Testing Your Deployment

After deployment, test these features:

1. ✅ **Open the URL** - Main menu should load
2. ✅ **Create a room** - Should generate a room code
3. ✅ **Open in another browser/device** - Join the room with the code
4. ✅ **Test voice chat** - Allow microphone access, speak to test
5. ✅ **Start game** - Both players ready, host starts
6. ✅ **Test gameplay** - Movement, camera, tagging should work

---

## Troubleshooting

### Voice chat not working?
- **Cause:** HTTP instead of HTTPS
- **Solution:** All deployment platforms above provide automatic HTTPS
- **Check:** Your URL should start with `https://`

### App sleeping/slow start?
- **Render:** Free tier apps sleep after 15 min inactivity (restarts in ~30 seconds)
- **Glitch:** Apps sleep after 5 min inactivity (restarts instantly)
- **Railway:** Free tier includes 500 hours/month, no sleep
- **Solution:** Consider upgrading to paid tier for 24/7 uptime

### WebSocket connection issues?
- **Check:** Browser console for errors
- **Ensure:** Firewall allows WebSocket connections
- **Try:** Different browser or incognito mode

---

## Recommended: Render Deployment

For the best experience, **Render is recommended** because:
- ✅ Automatic HTTPS (required for voice chat)
- ✅ Good free tier (750 hours/month)
- ✅ Easy deployment with `render.yaml`
- ✅ Reliable WebSocket support
- ✅ Custom domains (optional)

---

## Your Deployment Steps (Render)

1. **Sign up at render.com** (you only - users don't need accounts)
2. **New Web Service** from GitHub
3. **Select repository:** `moostafia/hide-seek-3d`
4. **Deploy** (auto-configured with render.yaml)
5. **Get URL:** `https://hide-seek-3d-xxxx.onrender.com`
6. **Share URL** with friends - they can play instantly!

---

## Share Your Game 🎮

Once deployed, share your URL:
- Discord: "Play my 3D hide & seek game: https://your-app.onrender.com"
- Twitter: "Check out my multiplayer 3D game!"
- Friends: "Join me for hide & seek: [your-url]"

**No sign-up required for players - just click and play!**

---

## Need Help?

If deployment fails:
1. Check deployment logs in platform dashboard
2. Verify `package.json` has correct start script
3. Ensure Node.js version is 14+
4. Check that all dependencies are listed

For WebRTC issues:
- Ensure HTTPS is enabled (all platforms above provide it)
- Test on mobile Safari and Chrome
- Check microphone permissions
