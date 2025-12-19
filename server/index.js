const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const GameManager = require('./gameManager');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Game manager instance
const gameManager = new GameManager(io);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Create room
  socket.on('createRoom', (playerName, callback) => {
    const room = gameManager.createRoom(socket.id, playerName);
    socket.join(room.code);
    callback({ success: true, roomCode: room.code, playerId: socket.id });
    io.to(room.code).emit('roomUpdate', room);
  });

  // Join room
  socket.on('joinRoom', (data, callback) => {
    const result = gameManager.joinRoom(data.roomCode, socket.id, data.playerName);
    if (result.success) {
      socket.join(data.roomCode);
      callback({ success: true, roomCode: data.roomCode, playerId: socket.id });
      io.to(data.roomCode).emit('roomUpdate', result.room);
    } else {
      callback({ success: false, error: result.error });
    }
  });

  // Player ready
  socket.on('playerReady', (roomCode) => {
    const room = gameManager.setPlayerReady(roomCode, socket.id);
    if (room) {
      io.to(roomCode).emit('roomUpdate', room);
    }
  });

  // Start game
  socket.on('startGame', (roomCode) => {
    const result = gameManager.startGame(roomCode, socket.id);
    if (result.success) {
      io.to(roomCode).emit('gameStart', result.gameState);
    }
  });

  // Player position update
  socket.on('playerMove', (data) => {
    const room = gameManager.updatePlayerPosition(data.roomCode, socket.id, data.position, data.rotation);
    if (room) {
      socket.to(data.roomCode).emit('playerMoved', {
        playerId: socket.id,
        position: data.position,
        rotation: data.rotation
      });
    }
  });

  // Tag player
  socket.on('tagPlayer', (data) => {
    const result = gameManager.tagPlayer(data.roomCode, socket.id, data.targetId);
    if (result.success) {
      io.to(data.roomCode).emit('playerTagged', {
        seekerId: socket.id,
        hiderId: data.targetId
      });
      
      // Check win condition
      if (result.gameOver) {
        io.to(data.roomCode).emit('gameOver', result.winner);
      }
    }
  });

  // WebRTC signaling
  socket.on('signal', (data) => {
    io.to(data.to).emit('signal', {
      from: socket.id,
      signal: data.signal
    });
  });

  // Disconnect
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    const roomCode = gameManager.removePlayer(socket.id);
    if (roomCode) {
      const room = gameManager.getRoom(roomCode);
      if (room) {
        io.to(roomCode).emit('roomUpdate', room);
      }
    }
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to play`);
});
