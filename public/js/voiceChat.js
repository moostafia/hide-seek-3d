/**
 * VoiceChat - Handles WebRTC peer-to-peer voice communication
 */
class VoiceChat {
  constructor(network) {
    this.network = network;
    this.peers = new Map();
    this.localStream = null;
    this.muted = false;
    this.speakingPlayers = new Set();
  }

  async initialize() {
    try {
      // Request microphone access
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        },
        video: false
      });

      console.log('Microphone access granted');
      return true;
    } catch (error) {
      console.error('Failed to get microphone access:', error);
      return false;
    }
  }

  connectToPeer(peerId, initiator = false) {
    if (this.peers.has(peerId)) {
      return; // Already connected
    }

    const peer = new SimplePeer({
      initiator: initiator,
      stream: this.localStream,
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    // Send signaling data through server
    peer.on('signal', (signal) => {
      this.network.sendSignal(peerId, signal);
    });

    // Receive remote stream
    peer.on('stream', (stream) => {
      console.log('Received stream from peer:', peerId);
      this.playRemoteAudio(peerId, stream);
    });

    // Handle errors
    peer.on('error', (error) => {
      console.error('Peer connection error:', error);
      this.peers.delete(peerId);
    });

    // Handle close
    peer.on('close', () => {
      console.log('Peer connection closed:', peerId);
      this.peers.delete(peerId);
      this.removeSpeakingIndicator(peerId);
    });

    this.peers.set(peerId, peer);
    return peer;
  }

  handleSignal(data) {
    const { from, signal } = data;
    
    let peer = this.peers.get(from);
    
    if (!peer) {
      // Create new peer connection (as receiver)
      peer = this.connectToPeer(from, false);
    }

    if (peer) {
      peer.signal(signal);
    }
  }

  playRemoteAudio(peerId, stream) {
    // Create audio element for remote stream
    const audio = document.createElement('audio');
    audio.id = `audio-${peerId}`;
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.style.display = 'none';
    document.body.appendChild(audio);

    // Monitor audio level for speaking indicator
    this.monitorAudioLevel(peerId, stream);
  }

  monitorAudioLevel(peerId, stream) {
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      const dataArray = new Uint8Array(analyser.frequencyBinCount);

      analyser.smoothingTimeConstant = 0.8;
      analyser.fftSize = 1024;

      microphone.connect(analyser);

      // Check audio level periodically
      const checkLevel = () => {
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;

        if (average > 10) { // Threshold for speaking
          this.addSpeakingIndicator(peerId);
        } else {
          this.removeSpeakingIndicator(peerId);
        }

        if (this.peers.has(peerId)) {
          requestAnimationFrame(checkLevel);
        }
      };

      checkLevel();
    } catch (error) {
      console.error('Error monitoring audio level:', error);
    }
  }

  addSpeakingIndicator(peerId) {
    if (!this.speakingPlayers.has(peerId)) {
      this.speakingPlayers.add(peerId);
      this.updateSpeakingIndicators();
    }
  }

  removeSpeakingIndicator(peerId) {
    if (this.speakingPlayers.has(peerId)) {
      this.speakingPlayers.delete(peerId);
      this.updateSpeakingIndicators();
    }
  }

  updateSpeakingIndicators() {
    const container = document.getElementById('speakingIndicators');
    if (!container) return;

    container.innerHTML = '';

    this.speakingPlayers.forEach(peerId => {
      const indicator = document.createElement('div');
      indicator.className = 'speaking-indicator';
      
      // Get player name if available
      const playerName = this.getPlayerName(peerId) || 'Player';
      indicator.textContent = `🎤 ${playerName}`;
      
      container.appendChild(indicator);
    });
  }

  getPlayerName(peerId) {
    if (window.game && window.game.remotePlayers.has(peerId)) {
      return window.game.remotePlayers.get(peerId).name;
    }
    return null;
  }

  toggleMute() {
    this.muted = !this.muted;
    
    if (this.localStream) {
      this.localStream.getAudioTracks().forEach(track => {
        track.enabled = !this.muted;
      });
    }

    // Update UI
    const muteBtn = document.getElementById('muteBtn');
    const muteIcon = document.getElementById('muteIcon');
    
    if (muteBtn) {
      if (this.muted) {
        muteBtn.classList.add('muted');
        muteIcon.textContent = '🔇';
      } else {
        muteBtn.classList.remove('muted');
        muteIcon.textContent = '🎤';
      }
    }

    return this.muted;
  }

  connectToAllPeers(playerIds) {
    // Connect to all other players
    playerIds.forEach(peerId => {
      if (peerId !== this.network.playerId && !this.peers.has(peerId)) {
        // Initiator is the one with "smaller" ID (to avoid double connections)
        const initiator = this.network.playerId < peerId;
        this.connectToPeer(peerId, initiator);
      }
    });
  }

  disconnectAll() {
    this.peers.forEach(peer => {
      peer.destroy();
    });
    this.peers.clear();
    this.speakingPlayers.clear();
    this.updateSpeakingIndicators();

    // Remove audio elements
    document.querySelectorAll('audio[id^="audio-"]').forEach(audio => {
      audio.remove();
    });
  }

  cleanup() {
    this.disconnectAll();
    
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }
  }
}
