/**
 * Game - Main game logic and Three.js setup
 */
class Game {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.environment = null;
    this.localPlayer = null;
    this.remotePlayers = new Map();
    this.controls = null;
    
    // Game state
    this.gameState = 'lobby'; // lobby, hiding, seeking, gameOver
    this.myRole = null;
    this.gameStartTime = null;
    this.gameDuration = 0;
    this.hidingDuration = 30;
    this.seekingDuration = 180;
    this.hidersCount = 0;
    this.foundHidersCount = 0;
    
    // Network position update throttle
    this.lastPositionUpdate = 0;
    this.positionUpdateInterval = 50; // ms
    
    this.clock = new THREE.Clock();
  }

  initialize() {
    this.setupThreeJS();
    this.environment = new Environment(this.scene);
    this.animate();
  }

  setupThreeJS() {
    const canvas = document.getElementById('gameCanvas');
    
    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB); // Sky blue
    this.scene.fog = new THREE.Fog(0x87CEEB, 50, 150);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 5, 10);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ 
      canvas: canvas,
      antialias: true 
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Handle window resize
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  startGame(gameState) {
    console.log('Starting game:', gameState);
    
    this.gameState = gameState.phase;
    this.hidingDuration = gameState.hidingTime;
    this.seekingDuration = gameState.seekingTime;
    this.gameStartTime = Date.now();
    
    // Create local player
    const myPlayerData = gameState.players.find(p => p.id === window.network.playerId);
    if (myPlayerData) {
      this.myRole = myPlayerData.role;
      
      const spawnPoint = this.environment.getRandomSpawnPoint();
      this.localPlayer = new Player(
        myPlayerData.id,
        myPlayerData.name,
        this.scene,
        true
      );
      this.localPlayer.setPosition(spawnPoint.x, spawnPoint.y, spawnPoint.z);
      this.localPlayer.setRole(this.myRole);

      // Setup controls
      this.controls = new Controls(this.camera, this.localPlayer);

      // Update UI
      window.ui.setRole(this.myRole);
      window.ui.showScreen('gameScreen');
      
      // Show/hide seeker overlay during hiding phase
      this.updateSeekerOverlay();
    }

    // Create remote players
    gameState.players.forEach(playerData => {
      if (playerData.id !== window.network.playerId) {
        const spawnPoint = this.environment.getRandomSpawnPoint();
        const remotePlayer = new Player(
          playerData.id,
          playerData.name,
          this.scene,
          false
        );
        remotePlayer.setPosition(spawnPoint.x, spawnPoint.y, spawnPoint.z);
        remotePlayer.setRole(playerData.role);
        this.remotePlayers.set(playerData.id, remotePlayer);
      }
    });

    // Count hiders
    this.hidersCount = gameState.players.filter(p => p.role === 'hider').length;
    this.foundHidersCount = 0;
    window.ui.updatePlayersCount(this.hidersCount, this.hidersCount);

    // Show phase message
    if (this.myRole === 'hider') {
      window.ui.showPhaseMessage('🏃 HIDE! You have 30 seconds!');
    } else {
      window.ui.showPhaseMessage('👁️ Wait for hiding phase to end...');
    }
  }

  changePhase(data) {
    console.log('Phase change:', data);
    
    this.gameState = data.phase;
    this.gameDuration = data.duration;
    this.gameStartTime = Date.now();

    if (data.phase === 'seeking') {
      if (this.myRole === 'seeker') {
        window.ui.showPhaseMessage('👁️ SEEK! Find all hiders!');
      } else {
        window.ui.showPhaseMessage('🏃 Stay hidden!');
      }
    }
    
    // Update seeker overlay
    this.updateSeekerOverlay();
  }

  updateSeekerOverlay() {
    const overlay = document.getElementById('seekerBlockOverlay');
    if (overlay) {
      if (this.gameState === 'hiding' && this.myRole === 'seeker') {
        overlay.classList.add('active');
      } else {
        overlay.classList.remove('active');
      }
    }
  }

  updateRemotePlayer(playerId, position, rotation) {
    const player = this.remotePlayers.get(playerId);
    if (player) {
      player.setPosition(position.x, position.y, position.z);
      player.setRotation(rotation.x, rotation.y, rotation.z);
    }
  }

  playerTagged(data) {
    console.log('Player tagged:', data);
    
    const hider = this.remotePlayers.get(data.hiderId);
    if (hider) {
      hider.setFound(true);
    }

    // Update if it's me
    if (data.hiderId === window.network.playerId) {
      this.localPlayer.setFound(true);
      window.ui.showPhaseMessage('😢 You were found!');
    }

    this.foundHidersCount++;
    window.ui.updatePlayersCount(this.hidersCount - this.foundHidersCount, this.hidersCount);
  }

  endGame(data) {
    console.log('Game over:', data);
    
    this.gameState = 'gameOver';
    window.ui.showGameOver(data);
  }

  onTagAction() {
    if (this.myRole !== 'seeker' || this.gameState !== 'seeking') {
      return;
    }

    // Find closest hider within range
    let closestHider = null;
    let closestDistance = 5; // Tag range

    this.remotePlayers.forEach((player, id) => {
      if (player.role === 'hider' && !player.isFound) {
        const distance = this.localPlayer.getDistanceTo(player);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestHider = id;
        }
      }
    });

    if (closestHider) {
      window.network.tagPlayer(closestHider);
      window.ui.showPhaseMessage('✅ Tagged!');
    }
  }

  update(delta) {
    if (this.gameState === 'lobby' || this.gameState === 'gameOver') {
      return;
    }

    // Update controls and local player
    if (this.controls && this.localPlayer) {
      this.controls.update(delta);
      this.localPlayer.update(delta);

      // Send position update to server (throttled)
      const now = Date.now();
      if (now - this.lastPositionUpdate > this.positionUpdateInterval) {
        window.network.sendPlayerMove(
          this.localPlayer.position,
          this.localPlayer.rotation
        );
        this.lastPositionUpdate = now;
      }
    }

    // Update remote players
    this.remotePlayers.forEach(player => {
      player.update(delta);
    });

    // Update timer
    if (this.gameStartTime && this.gameState !== 'gameOver') {
      const elapsed = Math.floor((Date.now() - this.gameStartTime) / 1000);
      let remaining = 0;
      
      if (this.gameState === 'hiding') {
        remaining = Math.max(0, this.hidingDuration - elapsed);
      } else if (this.gameState === 'seeking') {
        remaining = Math.max(0, this.seekingDuration - elapsed);
      }
      
      window.ui.updateTimer(remaining);
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const delta = this.clock.getDelta();
    this.update(delta);

    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }
}
