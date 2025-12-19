/**
 * Main - Entry point of the application
 */

// Global instances
window.network = null;
window.voiceChat = null;
window.ui = null;
window.game = null;

// Initialize application
async function init() {
  try {
    // Create network connection
    window.network = new Network();
    await window.network.connect();
    console.log('Network connected');

    // Create voice chat
    window.voiceChat = new VoiceChat(window.network);
    console.log('Voice chat initialized');

    // Create UI manager
    window.ui = new UI(window.network, window.voiceChat);
    console.log('UI initialized');

    // Create game instance
    window.game = new Game();
    window.game.initialize();
    console.log('Game initialized');

    console.log('Application ready!');
  } catch (error) {
    console.error('Failed to initialize application:', error);
    alert('Failed to connect to server. Please refresh the page.');
  }
}

// Start application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
