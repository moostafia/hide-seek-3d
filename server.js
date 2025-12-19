import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import cookieParser from 'cookie-parser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cookieParser());

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Simple password protection
const GAME_PASSWORD = 'Boom123';

// Password check middleware
app.use((req, res, next) => {
  // Skip password for socket.io and API status
  if (req.path.startsWith('/socket.io') || req.path === '/api/status') {
    return next();
  }
  
  // Check if already authenticated via cookie
  if (req.cookies && req.cookies.game_auth === 'true') {
    return next();
  }
  
  // Check password in query string
  if (req.query.pass === GAME_PASSWORD) {
    res.cookie('game_auth', 'true', { maxAge: 24 * 60 * 60 * 1000, httpOnly: false }); // 24 hours
    // Redirect to clean URL without password
    const cleanUrl = req.path + (req.query.room ? `?room=${req.query.room}` : '');
    return res.redirect(cleanUrl);
  }
  
  // Show password form
  if (req.path === '/' || req.path === '/index.html') {
    return res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>🎄 Hide & Seek 3D - Enter Password</title>
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body { 
            font-family: Arial, sans-serif; 
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
          }
          .container {
            background: rgba(255,255,255,0.1);
            padding: 40px;
            border-radius: 20px;
            text-align: center;
            color: white;
          }
          h1 { color: #ff6b6b; margin-bottom: 10px; }
          p { color: #aaa; margin-bottom: 20px; }
          input[type="password"] {
            padding: 15px 25px;
            font-size: 18px;
            border: none;
            border-radius: 10px;
            margin-bottom: 15px;
            width: 200px;
          }
          button {
            padding: 15px 40px;
            font-size: 18px;
            background: linear-gradient(135deg, #c41e3a 0%, #ff6b6b 100%);
            color: white;
            border: none;
            border-radius: 10px;
            cursor: pointer;
          }
          button:hover { transform: scale(1.05); }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🎄 Hide & Seek 3D 🎄</h1>
          <p>Enter the game password to play</p>
          <form method="GET">
            <input type="password" name="pass" placeholder="Password" required><br>
            ${req.query.room ? `<input type="hidden" name="room" value="${req.query.room}">` : ''}
            <button type="submit">🎅 Enter Game</button>
          </form>
        </div>
      </body>
      </html>
    `);
  }
  
  return res.status(401).send('Unauthorized');
});

// Serve static files from dist folder (after build) or use with Vite in dev
app.use(express.static(join(__dirname, 'dist')));

// Game state
const MAX_PLAYERS = 8;
const players = new Map();
const rooms = new Map();

// Create or get a room
function getOrCreateRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      name: roomId,
      players: new Set(),
      maxPlayers: MAX_PLAYERS,
      createdAt: Date.now()
    });
    console.log(`Created new room: ${roomId}`);
  }
  return rooms.get(roomId);
}

// Generate a random room ID
function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Default public room
const DEFAULT_ROOM = 'christmas-lobby';
getOrCreateRoom(DEFAULT_ROOM);

// Generate random snowman appearance
function generateSnowmanAppearance() {
  const hatStyles = ['topHat', 'santaHat', 'beanie', 'cowboy', 'wizard', 'crown', 'none'];
  const scarfColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xff6600, 0x9900ff];
  const noseTypes = ['carrot', 'button', 'long', 'small'];
  const armStyles = ['sticks', 'mittens', 'waving', 'crossed'];
  const accessories = ['pipe', 'broom', 'candy_cane', 'gift', 'none'];
  const bodyProportions = ['normal', 'chubby', 'tall', 'small'];
  const eyeStyles = ['coal', 'buttons', 'googly', 'sleepy', 'happy'];
  
  return {
    hatStyle: hatStyles[Math.floor(Math.random() * hatStyles.length)],
    hatColor: Math.floor(Math.random() * 0xffffff),
    scarfColor: scarfColors[Math.floor(Math.random() * scarfColors.length)],
    noseType: noseTypes[Math.floor(Math.random() * noseTypes.length)],
    armStyle: armStyles[Math.floor(Math.random() * armStyles.length)],
    accessory: accessories[Math.floor(Math.random() * accessories.length)],
    proportion: bodyProportions[Math.floor(Math.random() * bodyProportions.length)],
    eyeStyle: eyeStyles[Math.floor(Math.random() * eyeStyles.length)]
  };
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`Player connected: ${socket.id}`);
  
  // Handle player join with room support
  socket.on('player-join', (data) => {
    const { name, roomId } = data;
    
    // Use provided roomId or default to public lobby
    const targetRoomId = roomId || DEFAULT_ROOM;
    const room = getOrCreateRoom(targetRoomId);
    
    // Check if room is full
    if (room.players.size >= MAX_PLAYERS) {
      socket.emit('room-full', { message: `Room is full! Maximum ${MAX_PLAYERS} players.` });
      return;
    }
    
    // Generate random spawn position
    const angle = Math.random() * Math.PI * 2;
    const radius = 5 + Math.random() * 10;
    
    const player = {
      id: socket.id,
      name: name || `Snowman-${socket.id.slice(0, 4)}`,
      position: {
        x: Math.cos(angle) * radius,
        y: 0,
        z: Math.sin(angle) * radius
      },
      rotation: 0,
      appearance: generateSnowmanAppearance(),
      room: targetRoomId
    };
    
    players.set(socket.id, player);
    room.players.add(socket.id);
    socket.join(targetRoomId);
    
    // Send player their own data, ID, and room info
    socket.emit('player-joined', {
      id: socket.id,
      player: player,
      roomId: targetRoomId,
      players: Array.from(players.values()).filter(p => p.id !== socket.id && p.room === targetRoomId)
    });
    
    // Notify other players in the same room
    socket.to(targetRoomId).emit('player-connected', player);
    
    // Send current player count for this room
    io.to(targetRoomId).emit('player-count', {
      current: room.players.size,
      max: MAX_PLAYERS,
      roomId: targetRoomId
    });
    
    console.log(`Player ${player.name} joined room ${targetRoomId}. Room players: ${room.players.size}/${MAX_PLAYERS}`);
  });
  
  // Handle player movement
  socket.on('player-move', (data) => {
    const player = players.get(socket.id);
    if (player) {
      player.position = data.position;
      player.rotation = data.rotation;
      
      // Broadcast to other players in the room
      socket.to(player.room).emit('player-moved', {
        id: socket.id,
        position: data.position,
        rotation: data.rotation
      });
    }
  });
  
  // Handle chat messages
  socket.on('chat-message', (data) => {
    const player = players.get(socket.id);
    if (player) {
      io.to(player.room).emit('chat-message', {
        id: socket.id,
        name: player.name,
        message: data.message,
        timestamp: Date.now()
      });
    }
  });
  
  // Handle player disconnect
  socket.on('disconnect', () => {
    const player = players.get(socket.id);
    if (player) {
      const room = rooms.get(player.room);
      if (room) {
        room.players.delete(socket.id);
        
        // Notify other players
        socket.to(player.room).emit('player-disconnected', { id: socket.id });
        
        // Update player count
        io.to(player.room).emit('player-count', {
          current: room.players.size,
          max: MAX_PLAYERS
        });
        
        console.log(`Player ${player.name} disconnected. Total players: ${room.players.size}/${MAX_PLAYERS}`);
      }
      players.delete(socket.id);
    }
  });
});

// API endpoint to get server status
app.get('/api/status', (req, res) => {
  const room = rooms.get(DEFAULT_ROOM);
  res.json({
    players: room ? room.players.size : 0,
    maxPlayers: MAX_PLAYERS,
    uptime: process.uptime()
  });
});

// API endpoint to create a new private room
app.get('/api/create-room', (req, res) => {
  const roomId = generateRoomId();
  getOrCreateRoom(roomId);
  res.json({
    roomId: roomId,
    shareUrl: `?room=${roomId}`
  });
});

// API endpoint to get room info
app.get('/api/room/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (room) {
    res.json({
      roomId: req.params.roomId,
      players: room.players.size,
      maxPlayers: MAX_PLAYERS
    });
  } else {
    res.json({
      roomId: req.params.roomId,
      players: 0,
      maxPlayers: MAX_PLAYERS,
      exists: false
    });
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`
🎄 Christmas Hide & Seek 3D Server 🎄
=====================================
Server running on port ${PORT}
Max players: ${MAX_PLAYERS}
Open http://localhost:${PORT} to play!
  `);
});
