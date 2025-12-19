# 🎮 Hide & Seek 3D

A fully functional 3D multiplayer hide and seek game built with Three.js and WebRTC voice chat. Features mobile-friendly controls, real-time multiplayer gameplay, and always-on voice communication.

## ✨ Features

### Game Mechanics
- **Role-based gameplay**: Players are assigned as Hiders or Seekers
- **Hiding phase**: 30-second countdown for hiders to find spots while seekers wait
- **Seeking phase**: 3-minute timer for seekers to find all hiders
- **Tagging system**: Get close to tag hiders
- **Win conditions**: Seekers win if all hiders found, hiders win if any remain hidden

### 3D Graphics (Three.js)
- Indoor environment with multiple rooms
- Furniture and objects for hiding
- Dynamic lighting with shadows
- Third-person camera controls
- Smooth player animations

### Mobile-Friendly
- Responsive design for all screen sizes
- Touch controls:
  - Virtual joystick for movement (left side)
  - Touch/swipe for camera rotation (right side)
  - Action button for tagging
- Desktop controls: WASD + mouse
- Optimized for mobile browsers (iOS Safari, Android Chrome)

### Voice Chat (WebRTC)
- Always-on voice communication
- Peer-to-peer connections using SimplePeer
- Mute/unmute functionality
- Visual speaking indicators
- Works seamlessly on mobile

### Multiplayer
- Room-based system with 6-character room codes
- Create or join rooms
- Player lobby with ready system
- Real-time position synchronization
- Up to 8 players per room

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone https://github.com/moostafia/hide-seek-3d.git
cd hide-seek-3d
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm start
```

4. Open your browser and navigate to:
```
http://localhost:3000
```

### For Development
```bash
npm run dev
```

## 🎯 How to Play

### Creating a Room
1. Enter your name
2. Click "Create Room"
3. Share the room code with friends
4. Wait for players to join
5. Click "Start Game" when ready

### Joining a Room
1. Enter your name
2. Enter the room code
3. Click "Join Room"
4. Click "Ready" when prepared
5. Wait for host to start

### Gameplay

**As a Hider:**
- Find a hiding spot during the 30-second hiding phase
- Stay hidden from seekers for 3 minutes
- Use objects and rooms to hide
- Stay quiet or use voice chat strategically

**As a Seeker:**
- Wait during the hiding phase (screen blocked)
- Search for hiders when seeking phase begins
- Get close to a hider and press TAG button (or Space on desktop)
- Find all hiders before time runs out

### Controls

**Desktop:**
- **WASD** - Move
- **Mouse** - Look around (click and drag)
- **Space** - Tag (when close to a hider)
- **M** - Mute/unmute microphone

**Mobile:**
- **Left joystick** - Move
- **Right side touch/swipe** - Look around
- **TAG button** - Tag nearby hider
- **Microphone button** - Mute/unmute

## 🏗️ Project Structure

```
hide-seek-3d/
├── server/
│   ├── index.js          # Express server and Socket.IO setup
│   ├── gameManager.js    # Game logic and room management
├── public/
│   ├── index.html        # Main HTML file
│   ├── css/
│   │   └── style.css     # All styles
│   ├── js/
│   │   ├── main.js       # Application entry point
│   │   ├── game.js       # Three.js game loop and logic
│   │   ├── player.js     # Player character class
│   │   ├── controls.js   # Input handling (desktop/mobile)
│   │   ├── network.js    # Socket.IO client
│   │   ├── voiceChat.js  # WebRTC voice chat
│   │   ├── ui.js         # UI management
│   │   └── environment.js # 3D world creation
├── package.json
└── README.md
```

## 🔧 Technical Stack

- **Frontend**: 
  - Three.js (3D graphics)
  - Vanilla JavaScript (ES6+)
  - Socket.IO client (real-time communication)
  - SimplePeer (WebRTC voice chat)

- **Backend**:
  - Node.js
  - Express (web server)
  - Socket.IO (WebSocket server)

## 🌐 Deployment

### Deploy to Heroku

1. Create a Heroku app:
```bash
heroku create your-app-name
```

2. Push to Heroku:
```bash
git push heroku main
```

3. Open your app:
```bash
heroku open
```

### Deploy to Other Platforms

The app works on any platform that supports Node.js:
- Render
- Railway
- DigitalOcean
- AWS
- Google Cloud

Just ensure the PORT environment variable is set correctly.

## 📱 Mobile Support

The game is optimized for mobile browsers:
- iOS Safari (iOS 13+)
- Chrome for Android
- Firefox Mobile
- Samsung Internet

**Note**: WebRTC voice chat requires HTTPS on mobile browsers. Use a platform that provides SSL certificates for production deployment.

## 🎨 Customization

### Adjusting Game Settings

Edit `server/gameManager.js`:
```javascript
hidingTime: 30,      // Hiding phase duration (seconds)
seekingTime: 180,    // Seeking phase duration (seconds)
```

### Changing Environment

Modify `public/js/environment.js` to:
- Add more rooms
- Create different layouts
- Add more hiding spots
- Change lighting

### Customizing Players

Edit `public/js/player.js` to:
- Change player appearance
- Adjust player size
- Modify colors
- Add animations

## 🐛 Troubleshooting

### Voice chat not working
- Ensure microphone permissions are granted
- Use HTTPS in production
- Check browser compatibility
- Verify firewall settings

### Players not syncing
- Check network connection
- Verify Socket.IO is connected
- Check browser console for errors

### Performance issues on mobile
- Lower render quality in `game.js`
- Reduce shadow quality
- Simplify environment geometry

## 📄 License

MIT License - feel free to use this project for learning or your own games!

## 🤝 Contributing

Contributions are welcome! Feel free to submit issues and pull requests.

## 🙏 Acknowledgments

- Three.js for 3D graphics
- Socket.IO for real-time communication
- SimplePeer for WebRTC implementation
- Inspired by classic hide and seek gameplay

## 📞 Support

If you encounter any issues or have questions, please open an issue on GitHub.

---

Built with ❤️ using Three.js, WebRTC, and Socket.IO
