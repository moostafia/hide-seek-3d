# 🚀 Using GitHub Codespaces for Temporary Hosting

Yes! You can use GitHub Codespaces to host your app temporarily and create a shareable link for non-local users.

## Quick Start with Codespaces

### Step 1: Open in Codespaces

1. Go to your repository: `https://github.com/moostafia/hide-seek-3d`
2. Click the green **"Code"** button
3. Click the **"Codespaces"** tab
4. Click **"Create codespace on [your-branch]"**

### Step 2: Wait for Setup

Codespaces will automatically:
- ✅ Create a cloud development environment
- ✅ Run `npm install` (configured in `.devcontainer/devcontainer.json`)
- ✅ Set up port forwarding for port 3000

### Step 3: Start Your Server

In the Codespaces terminal, run:
```bash
npm start
```

You should see:
```
Server running on port 3000
Visit http://localhost:3000 to play
```

### Step 4: Get Your Shareable Link

When the server starts, Codespaces will automatically detect port 3000 and show a notification:

1. **Click the notification** that says "Your application is available on port 3000"
2. OR go to the **"PORTS"** tab at the bottom of VS Code
3. Find port **3000** in the list
4. Right-click on the port → Select **"Port Visibility"** → **"Public"**
5. Right-click again → **"Copy Local Address"**

Your shareable link will look like:
```
https://[codespace-name]-3000.app.github.dev
```

### Step 5: Share the Link

✅ **This link works for anyone** - no GitHub account needed!
✅ **HTTPS included** - Voice chat will work on mobile!
✅ **Valid while Codespace is running**

Share it like:
```
🎮 Play my Hide & Seek 3D game:
https://vigilant-space-fishstick-3000.app.github.dev

No sign-up needed - just click and play!
```

---

## Important Notes

### ⏰ Codespace Limitations

**Active Time:**
- Codespaces stop after **30 minutes of inactivity**
- Maximum **60 hours per month** on free plan
- Perfect for testing and temporary sharing

**When Codespace stops:**
- The link stops working
- Players get disconnected
- Just restart the Codespace to get it running again

### 🔄 Restarting Your Codespace

If your Codespace stops:
1. Go to GitHub.com → Your repository
2. Click "Code" → "Codespaces" tab
3. Find your Codespace and click it to restart
4. Run `npm start` again
5. The URL will be the same!

### 📱 Mobile Testing

The Codespace URL has HTTPS, so:
- ✅ Works on mobile browsers
- ✅ Voice chat works (WebRTC requires HTTPS)
- ✅ Touch controls work
- ✅ Can share with mobile users

---

## Alternative: VS Code Desktop

You can also use Codespaces from VS Code desktop:

1. Install "GitHub Codespaces" extension
2. Open Command Palette (`Ctrl+Shift+P` or `Cmd+Shift+P`)
3. Type "Codespaces: Create New Codespace"
4. Select your repository
5. VS Code will connect to the cloud Codespace
6. Run `npm start` and get the shareable link

---

## Making the Port Public (Important!)

By default, ports are **private**. To share with others:

### In Codespaces:
1. Click the **"PORTS"** tab (bottom panel)
2. Find port **3000**
3. Right-click → **"Port Visibility"** → **"Public"**
4. Now anyone with the link can access it!

### Visual Steps:
```
PORTS tab
├── 3000 (Hide & Seek 3D Game)
    ├── Right-click
    ├── Port Visibility: Public ✅
    └── Copy Local Address
```

---

## Comparison: Codespaces vs. Permanent Hosting

| Feature | Codespaces (Temporary) | Render/Railway (Permanent) |
|---------|------------------------|----------------------------|
| **Setup Time** | Instant | 5 minutes |
| **Cost** | Free (60hrs/month) | Free tier available |
| **Uptime** | While running | 24/7 |
| **Link Duration** | Temporary | Permanent |
| **Use Case** | Testing, demos | Production |
| **HTTPS** | ✅ Yes | ✅ Yes |
| **Voice Chat** | ✅ Works | ✅ Works |

---

## Recommended Workflow

### For Quick Testing (Use Codespaces):
1. Open Codespaces
2. Run `npm start`
3. Share link immediately
4. Test with friends for a few hours

### For Long-term Sharing (Deploy to Render):
1. Follow [QUICKSTART.md](QUICKSTART.md)
2. Deploy to Render (5 minutes)
3. Get permanent URL
4. Share indefinitely

---

## Troubleshooting

### Port 3000 not showing in PORTS tab?
- Run `npm start` first
- Wait a few seconds
- Click refresh icon in PORTS tab

### Link not working for others?
- Check port visibility is set to **"Public"**
- Ensure `npm start` is still running
- Check Codespace is still active (not stopped)

### Voice chat not working?
- Codespaces provides HTTPS automatically
- Make sure microphone permissions are granted
- Test on Chrome or Safari for best results

### "Application not found" error?
- Your Codespace may have stopped
- Restart it from GitHub.com
- Run `npm start` again

---

## Example Session

```bash
# 1. Codespace opens
# 2. Terminal automatically runs: npm install

# 3. You run:
npm start

# Output:
# Server running on port 3000
# Visit http://localhost:3000 to play

# 4. Look at PORTS tab:
# Port 3000 | Hide & Seek 3D Game | (Click to open)

# 5. Right-click → Port Visibility → Public
# 6. Right-click → Copy Local Address
# 7. Share: https://xyz-3000.app.github.dev
```

---

## Summary

**Yes, you can use Codespaces!** It's perfect for:
- ✅ Quick testing
- ✅ Temporary sharing
- ✅ Demo to friends
- ✅ No deployment needed

**For permanent hosting**, use [Render, Railway, or Glitch](QUICKSTART.md).

**Codespace URL Format:**
```
https://[random-name]-3000.app.github.dev
```

**Share this link** - players need no GitHub account to join!
