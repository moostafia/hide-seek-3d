/**
 * GameManager - Handles game rooms, player management, and game logic
 */
class GameManager {
  constructor(io) {
    this.io = io;
    this.rooms = new Map();
    this.playerRooms = new Map(); // Map player ID to room code
  }

  /**
   * Generate a unique 6-character room code
   */
  generateRoomCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code;
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
      }
    } while (this.rooms.has(code));
    return code;
  }

  /**
   * Create a new game room
   */
  createRoom(playerId, playerName) {
    const code = this.generateRoomCode();
    const room = {
      code: code,
      host: playerId,
      players: new Map(),
      gameState: 'lobby', // lobby, hiding, seeking, gameOver
      hidingTime: 30, // seconds
      seekingTime: 180, // 3 minutes
      gameStartTime: null,
      currentPhase: null,
      hiders: new Set(),
      seekers: new Set(),
      foundHiders: new Set()
    };

    // Add host as first player
    room.players.set(playerId, {
      id: playerId,
      name: playerName,
      ready: false,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      role: null,
      isFound: false
    });

    this.rooms.set(code, room);
    this.playerRooms.set(playerId, code);
    return room;
  }

  /**
   * Join an existing room
   */
  joinRoom(roomCode, playerId, playerName) {
    const room = this.rooms.get(roomCode);
    
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (room.gameState !== 'lobby') {
      return { success: false, error: 'Game already in progress' };
    }

    if (room.players.size >= 8) {
      return { success: false, error: 'Room is full' };
    }

    room.players.set(playerId, {
      id: playerId,
      name: playerName,
      ready: false,
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      role: null,
      isFound: false
    });

    this.playerRooms.set(playerId, roomCode);
    return { success: true, room };
  }

  /**
   * Set player as ready
   */
  setPlayerReady(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const player = room.players.get(playerId);
    if (player) {
      player.ready = !player.ready;
    }

    return room;
  }

  /**
   * Start the game
   */
  startGame(roomCode, playerId) {
    const room = this.rooms.get(roomCode);
    
    if (!room) {
      return { success: false, error: 'Room not found' };
    }

    if (room.host !== playerId) {
      return { success: false, error: 'Only host can start game' };
    }

    if (room.players.size < 2) {
      return { success: false, error: 'Need at least 2 players' };
    }

    // Check if all players are ready (except host)
    let allReady = true;
    room.players.forEach((player, id) => {
      if (id !== room.host && !player.ready) {
        allReady = false;
      }
    });

    if (!allReady) {
      return { success: false, error: 'Not all players are ready' };
    }

    // Assign roles - 1 seeker for every 3 players (minimum 1)
    const playerArray = Array.from(room.players.keys());
    const numSeekers = Math.max(1, Math.floor(playerArray.length / 3));
    
    // Shuffle players
    for (let i = playerArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [playerArray[i], playerArray[j]] = [playerArray[j], playerArray[i]];
    }

    // Assign roles
    room.seekers.clear();
    room.hiders.clear();
    room.foundHiders.clear();

    for (let i = 0; i < numSeekers; i++) {
      const playerId = playerArray[i];
      room.seekers.add(playerId);
      room.players.get(playerId).role = 'seeker';
    }

    for (let i = numSeekers; i < playerArray.length; i++) {
      const playerId = playerArray[i];
      room.hiders.add(playerId);
      room.players.get(playerId).role = 'hider';
    }

    // Start hiding phase
    room.gameState = 'hiding';
    room.currentPhase = 'hiding';
    room.gameStartTime = Date.now();

    // Schedule seeking phase
    setTimeout(() => {
      this.startSeekingPhase(roomCode);
    }, room.hidingTime * 1000);

    return {
      success: true,
      gameState: {
        phase: 'hiding',
        hidingTime: room.hidingTime,
        seekingTime: room.seekingTime,
        players: Array.from(room.players.values())
      }
    };
  }

  /**
   * Start seeking phase
   */
  startSeekingPhase(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    room.currentPhase = 'seeking';
    room.gameState = 'seeking';
    room.gameStartTime = Date.now();

    this.io.to(roomCode).emit('phaseChange', {
      phase: 'seeking',
      duration: room.seekingTime
    });

    // Schedule game end
    setTimeout(() => {
      this.endGame(roomCode);
    }, room.seekingTime * 1000);
  }

  /**
   * End the game
   */
  endGame(roomCode) {
    const room = this.rooms.get(roomCode);
    if (!room || room.gameState === 'gameOver') return;

    room.gameState = 'gameOver';

    // Determine winner
    const hidersRemaining = room.hiders.size - room.foundHiders.size;
    const winner = hidersRemaining > 0 ? 'hiders' : 'seekers';

    this.io.to(roomCode).emit('gameOver', {
      winner,
      hidersRemaining,
      foundHiders: Array.from(room.foundHiders)
    });
  }

  /**
   * Tag a hider
   */
  tagPlayer(roomCode, seekerId, hiderId) {
    const room = this.rooms.get(roomCode);
    
    if (!room || room.currentPhase !== 'seeking') {
      return { success: false };
    }

    const seeker = room.players.get(seekerId);
    const hider = room.players.get(hiderId);

    if (!seeker || !hider || seeker.role !== 'seeker' || hider.role !== 'hider') {
      return { success: false };
    }

    if (room.foundHiders.has(hiderId)) {
      return { success: false }; // Already found
    }

    // Check distance (simple distance check)
    const dx = seeker.position.x - hider.position.x;
    const dy = seeker.position.y - hider.position.y;
    const dz = seeker.position.z - hider.position.z;
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (distance > 5) { // Must be within 5 units
      return { success: false };
    }

    // Tag successful
    room.foundHiders.add(hiderId);
    hider.isFound = true;

    // Check if all hiders are found
    const gameOver = room.foundHiders.size === room.hiders.size;
    
    if (gameOver) {
      room.gameState = 'gameOver';
      return {
        success: true,
        gameOver: true,
        winner: {
          winner: 'seekers',
          hidersRemaining: 0,
          foundHiders: Array.from(room.foundHiders)
        }
      };
    }

    return { success: true, gameOver: false };
  }

  /**
   * Update player position
   */
  updatePlayerPosition(roomCode, playerId, position, rotation) {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const player = room.players.get(playerId);
    if (player) {
      player.position = position;
      player.rotation = rotation;
    }

    return room;
  }

  /**
   * Remove player from room
   */
  removePlayer(playerId) {
    const roomCode = this.playerRooms.get(playerId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room) return null;

    room.players.delete(playerId);
    this.playerRooms.delete(playerId);

    // If room is empty, delete it
    if (room.players.size === 0) {
      this.rooms.delete(roomCode);
      return null;
    }

    // If host left, assign new host
    if (room.host === playerId) {
      room.host = room.players.keys().next().value;
    }

    return roomCode;
  }

  /**
   * Get room by code
   */
  getRoom(roomCode) {
    return this.rooms.get(roomCode);
  }
}

module.exports = GameManager;
