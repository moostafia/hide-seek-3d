/**
 * UI - Manages all UI screens and interactions
 */
class UI {
  constructor(network, voiceChat) {
    this.network = network;
    this.voiceChat = voiceChat;
    this.currentScreen = 'mainMenu';
    this.isHost = false;
    
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Main Menu
    document.getElementById('createRoomBtn').addEventListener('click', () => {
      this.createRoom();
    });

    document.getElementById('joinRoomBtn').addEventListener('click', () => {
      this.joinRoom();
    });

    // Lobby
    document.getElementById('readyBtn').addEventListener('click', () => {
      this.toggleReady();
    });

    document.getElementById('startGameBtn').addEventListener('click', () => {
      this.startGame();
    });

    document.getElementById('leaveLobbyBtn').addEventListener('click', () => {
      this.leaveLobby();
    });

    // Voice chat
    document.getElementById('muteBtn').addEventListener('click', () => {
      this.voiceChat.toggleMute();
    });

    // Game over
    document.getElementById('playAgainBtn').addEventListener('click', () => {
      this.showScreen('lobbyScreen');
    });

    document.getElementById('mainMenuBtn').addEventListener('click', () => {
      this.leaveLobby();
    });

    // Enter key to join
    document.getElementById('roomCodeInput').addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.joinRoom();
      }
    });
  }

  async createRoom() {
    const playerName = document.getElementById('playerNameInput').value.trim();
    
    if (!playerName) {
      alert('Please enter your name');
      return;
    }

    this.showLoading('Creating room...');

    try {
      const response = await this.network.createRoom(playerName);
      this.isHost = true;
      
      // Initialize voice chat
      await this.voiceChat.initialize();
      
      this.hideLoading();
      this.showScreen('lobbyScreen');
      document.getElementById('roomCodeDisplay').textContent = response.roomCode;
      document.getElementById('startGameBtn').style.display = 'block';
    } catch (error) {
      this.hideLoading();
      alert('Failed to create room: ' + error);
    }
  }

  async joinRoom() {
    const playerName = document.getElementById('playerNameInput').value.trim();
    const roomCode = document.getElementById('roomCodeInput').value.trim().toUpperCase();
    
    if (!playerName) {
      alert('Please enter your name');
      return;
    }

    if (!roomCode) {
      alert('Please enter a room code');
      return;
    }

    this.showLoading('Joining room...');

    try {
      const response = await this.network.joinRoom(roomCode, playerName);
      this.isHost = false;
      
      // Initialize voice chat
      await this.voiceChat.initialize();
      
      this.hideLoading();
      this.showScreen('lobbyScreen');
      document.getElementById('roomCodeDisplay').textContent = response.roomCode;
      document.getElementById('startGameBtn').style.display = 'none';
    } catch (error) {
      this.hideLoading();
      alert('Failed to join room: ' + error);
    }
  }

  toggleReady() {
    this.network.setReady();
  }

  startGame() {
    this.network.startGame();
  }

  leaveLobby() {
    // Disconnect voice chat
    this.voiceChat.cleanup();
    
    // Reload page to reset everything
    window.location.reload();
  }

  updateLobby(room) {
    const playersList = document.getElementById('playersList');
    playersList.innerHTML = '';

    room.players.forEach((player, id) => {
      const playerItem = document.createElement('div');
      playerItem.className = 'player-item';

      const playerName = document.createElement('span');
      playerName.className = 'player-name';
      playerName.textContent = player.name;

      const playerStatus = document.createElement('span');
      playerStatus.className = 'player-status';

      if (id === room.host) {
        playerStatus.className += ' host';
        playerStatus.textContent = 'HOST';
      } else if (player.ready) {
        playerStatus.className += ' ready';
        playerStatus.textContent = 'READY';
      } else {
        playerStatus.className += ' not-ready';
        playerStatus.textContent = 'NOT READY';
      }

      playerItem.appendChild(playerName);
      playerItem.appendChild(playerStatus);
      playersList.appendChild(playerItem);
    });

    // Connect voice chat to all peers
    const playerIds = Array.from(room.players.keys());
    this.voiceChat.connectToAllPeers(playerIds);
  }

  showScreen(screenId) {
    // Hide all screens
    document.querySelectorAll('.screen').forEach(screen => {
      screen.classList.remove('active');
    });

    // Show target screen
    document.getElementById(screenId).classList.add('active');
    this.currentScreen = screenId;
  }

  showLoading(message = 'Loading...') {
    const loading = document.getElementById('loadingIndicator');
    loading.querySelector('p').textContent = message;
    loading.classList.add('active');
  }

  hideLoading() {
    document.getElementById('loadingIndicator').classList.remove('active');
  }

  updateTimer(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    const timeString = `${minutes}:${secs.toString().padStart(2, '0')}`;
    document.getElementById('timerDisplay').textContent = timeString;
  }

  updatePlayersCount(hidersRemaining, totalHiders) {
    document.getElementById('playersCount').textContent = `Hiders: ${hidersRemaining}/${totalHiders}`;
  }

  setRole(role) {
    const roleDisplay = document.getElementById('roleDisplay');
    roleDisplay.textContent = role === 'hider' ? '🏃 HIDER' : '👁️ SEEKER';
    roleDisplay.className = `role-badge ${role}`;
  }

  showPhaseMessage(message) {
    const phaseMessage = document.getElementById('phaseMessage');
    phaseMessage.textContent = message;
    phaseMessage.classList.add('show');
    
    setTimeout(() => {
      phaseMessage.classList.remove('show');
    }, 3000);
  }

  showGameOver(data) {
    const winnerText = document.getElementById('winnerText');
    const gameStats = document.getElementById('gameStats');

    if (data.winner === 'hiders') {
      winnerText.textContent = '🏆 HIDERS WIN!';
      winnerText.style.color = '#3498db';
    } else {
      winnerText.textContent = '🏆 SEEKERS WIN!';
      winnerText.style.color = '#e74c3c';
    }

    gameStats.innerHTML = `
      <div class="stat-item">
        <strong>Winner:</strong> ${data.winner === 'hiders' ? 'Hiders' : 'Seekers'}
      </div>
      <div class="stat-item">
        <strong>Hiders Remaining:</strong> ${data.hidersRemaining || 0}
      </div>
      <div class="stat-item">
        <strong>Hiders Found:</strong> ${data.foundHiders ? data.foundHiders.length : 0}
      </div>
    `;

    this.showScreen('gameOverScreen');
  }
}
