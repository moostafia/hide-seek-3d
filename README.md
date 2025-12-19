# Hide & Seek 3D - Christmas Edition 🎄

A multiplayer 3D hide and seek game built with Three.js and Socket.io. Play as customizable snowmen in a festive winter wonderland!

## Features

- 🎿 3D winter environment with snow, trees, and Christmas decorations
- ⛄ Randomized snowman avatars with unique appearances
- 👥 Real-time multiplayer (up to 20 players)
- 💬 In-game chat
- 🎵 Christmas music
- 📱 Mobile-friendly with touch controls
- 🐕 Interactive dog companion
- 📷 Face camera support

## Local Development

### Prerequisites
- Node.js 18+ 
- npm

### Setup

```bash
# Install dependencies
npm install

# Start development (Vite dev server + backend server)
# Terminal 1: Start the game server
npm run dev:server

# Terminal 2: Start Vite dev server  
npm run dev
```

Open http://localhost:5173 in your browser.

### Build for Production

```bash
npm run build
```

### Run Production Build Locally

```bash
npm start
# or
npm run build && npm run server
```

Open http://localhost:3000 in your browser.

## Deployment

### Deploy to Railway, Render, or Heroku

1. **Connect your repository** to the platform

2. **Set build command:**
   ```
   npm run build
   ```

3. **Set start command:**
   ```
   npm run server
   ```

4. **Environment Variables (optional):**
   - `PORT` - Server port (usually auto-set by platform)

### Deploy to Vercel (Static Only)

⚠️ Note: Vercel is for static sites. For full multiplayer functionality, you'll need to deploy the server separately.

### Deploy with Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

ENV PORT=3000
EXPOSE 3000

CMD ["npm", "run", "server"]
```

### Manual Server Deployment

1. Build the project:
   ```bash
   npm run build
   ```

2. Upload `dist/`, `server.js`, `package.json`, and `package-lock.json` to your server

3. On the server:
   ```bash
   npm ci --only=production
   npm run server
   ```

## Project Structure

```
├── index.html      # Main HTML entry point
├── main.js         # Three.js game client code
├── server.js       # Express + Socket.io server
├── vite.config.js  # Vite build configuration
├── package.json    # Dependencies and scripts
└── dist/           # Production build output
```

## Game Controls

### Desktop
- **WASD / Arrow Keys** - Move
- **Mouse** - Look around
- **Space** - Jump (if implemented)
- **V** - Toggle first/third person view
- **Enter** - Send chat message

### Mobile
- **Left joystick** - Move
- **Right area** - Look around
- **Buttons** - Various toggles

## Troubleshooting

### Connection Issues
- Ensure the server is running
- Check if port 3000 is available
- For HTTPS sites, ensure WebSocket connections use WSS

### Performance
- Lower device may experience lag with many players
- Try reducing browser window size
- Close other resource-heavy applications

## License

MIT
