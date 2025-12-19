/**
 * Network - Handles Socket.IO communication with server
 */
class Network {
  constructor() {
    this.socket = null;
    this.playerId = null;
    this.roomCode = null;
    this.connected = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io();

        this.socket.on('connect', () => {
          console.log('Connected to server');
          this.connected = true;
          resolve();
        });

        this.socket.on('disconnect', () => {
          console.log('Disconnected from server');
          this.connected = false;
        });

        this.socket.on('connect_error', (error) => {
          console.error('Connection error:', error);
          reject(error);
        });

        // Room updates
        this.socket.on('roomUpdate', (room) => {
          if (window.ui) {
            window.ui.updateLobby(room);
          }
        });

        // Game start
        this.socket.on('gameStart', (gameState) => {
          if (window.game) {
            window.game.startGame(gameState);
          }
        });

        // Phase change
        this.socket.on('phaseChange', (data) => {
          if (window.game) {
            window.game.changePhase(data);
          }
        });

        // Player moved
        this.socket.on('playerMoved', (data) => {
          if (window.game) {
            window.game.updateRemotePlayer(data.playerId, data.position, data.rotation);
          }
        });

        // Player tagged
        this.socket.on('playerTagged', (data) => {
          if (window.game) {
            window.game.playerTagged(data);
          }
        });

        // Game over
        this.socket.on('gameOver', (data) => {
          if (window.game) {
            window.game.endGame(data);
          }
        });

        // WebRTC signaling
        this.socket.on('signal', (data) => {
          if (window.voiceChat) {
            window.voiceChat.handleSignal(data);
          }
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  createRoom(playerName) {
    return new Promise((resolve, reject) => {
      this.socket.emit('createRoom', playerName, (response) => {
        if (response.success) {
          this.playerId = response.playerId;
          this.roomCode = response.roomCode;
          resolve(response);
        } else {
          reject(response.error);
        }
      });
    });
  }

  joinRoom(roomCode, playerName) {
    return new Promise((resolve, reject) => {
      this.socket.emit('joinRoom', { roomCode, playerName }, (response) => {
        if (response.success) {
          this.playerId = response.playerId;
          this.roomCode = response.roomCode;
          resolve(response);
        } else {
          reject(response.error);
        }
      });
    });
  }

  setReady() {
    if (this.roomCode) {
      this.socket.emit('playerReady', this.roomCode);
    }
  }

  startGame() {
    if (this.roomCode) {
      this.socket.emit('startGame', this.roomCode);
    }
  }

  sendPlayerMove(position, rotation) {
    if (this.roomCode && this.connected) {
      this.socket.emit('playerMove', {
        roomCode: this.roomCode,
        position: { x: position.x, y: position.y, z: position.z },
        rotation: { x: rotation.x, y: rotation.y, z: rotation.z }
      });
    }
  }

  tagPlayer(targetId) {
    if (this.roomCode) {
      this.socket.emit('tagPlayer', {
        roomCode: this.roomCode,
        targetId: targetId
      });
    }
  }

  sendSignal(to, signal) {
    this.socket.emit('signal', { to, signal });
  }
}
