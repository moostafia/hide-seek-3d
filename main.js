import * as THREE from 'three';
import { io } from 'socket.io-client';

// Game state
let gameStarted = false;
let isFirstPerson = false;
let musicPlaying = false;
let playerName = '';
let myPlayerId = null;

// Face camera state
let faceCamEnabled = false;
let faceCamStream = null;
let faceCamVideoTexture = null;
let faceCamVideoElement = null;
let playerHeadVideoMesh = null;
let playerHeadOriginalMesh = null;
let playerHeadY = 0;
let playerHeadSize = 0.5;

// Dog state
let dog = null;
let dogStick = null;
let thrownStick = null;
let isPlayingWithDog = false;
let dogState = 'wandering'; // 'wandering', 'waiting', 'chasing', 'returning'
let dogTargetPosition = new THREE.Vector3();
let dogWanderAngle = Math.random() * Math.PI * 2;
let dogProximityShown = false;
let lastBarkTime = 0;
let barkAudioContext = null;

// Multiplayer state
const remotePlayers = new Map(); // Other players' snowmen
let socket = null;
const TICK_RATE = 50; // Send position updates every 50ms
let lastUpdateTime = 0;
let currentRoomId = null; // Current room ID for multiplayer

// Get room ID from URL parameters
function getRoomIdFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('room');
}

// Generate a random room ID for private games
function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Get shareable URL for current room
function getShareableUrl() {
  const baseUrl = window.location.href.split('?')[0].split('#')[0];
  if (currentRoomId) {
    return `${baseUrl}?room=${currentRoomId}`;
  }
  return baseUrl;
}

// Connect to server
function connectToServer() {
  // For production deployments (Heroku, Railway, Render, etc.), 
  // the server typically runs on the same port as the static files
  // For local dev, we connect to port 3000
  const isLocalDev = window.location.hostname === 'localhost' || 
                     window.location.hostname === '127.0.0.1';
  
  // In production, socket.io should connect to the same origin
  // In development, connect to the dev server on port 3000
  const serverUrl = isLocalDev && window.location.port !== '3000'
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : window.location.origin;
  
  console.log('Connecting to server:', serverUrl);
  
  socket = io(serverUrl, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000
  });
  
  socket.on('connect', () => {
    console.log('Connected to server');
    updateConnectionStatus('connected');
  });
  
  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    updateConnectionStatus('disconnected');
  });
  
  socket.on('connect_error', (error) => {
    console.log('Connection error:', error);
    updateConnectionStatus('offline');
    // Create NPCs for offline mode
    if (npcSnowmen.length === 0) {
      createOfflineNPCs();
    }
  });
  
  socket.on('room-full', (data) => {
    alert(data.message);
    updateConnectionStatus('full');
  });
  
  socket.on('player-joined', (data) => {
    myPlayerId = data.id;
    currentRoomId = data.roomId;
    console.log('Joined room:', data.roomId, 'as:', data.player.name);
    
    // Update the share link with room ID
    updateShareLink();
    
    // Apply our appearance from server
    applyAppearanceToSnowman(playerGroup, data.player.appearance);
    
    // Add existing players
    data.players.forEach(player => {
      addRemotePlayer(player);
    });
  });
  
  socket.on('player-connected', (player) => {
    console.log('Player connected:', player.name);
    addRemotePlayer(player);
    showNotification(`${player.name} joined! 🎄`);
  });
  
  socket.on('player-disconnected', (data) => {
    removeRemotePlayer(data.id);
  });
  
  socket.on('player-moved', (data) => {
    updateRemotePlayer(data.id, data.position, data.rotation);
  });
  
  socket.on('player-count', (data) => {
    updatePlayerCount(data.current, data.max, data.roomId);
  });
  
  socket.on('chat-message', (data) => {
    showChatMessage(data.name, data.message);
  });
}

// Update connection status UI
function updateConnectionStatus(status) {
  const statusEl = document.getElementById('connection-status');
  if (!statusEl) return;
  
  switch(status) {
    case 'connected':
      statusEl.textContent = '🟢 Online';
      statusEl.style.color = '#00ff00';
      break;
    case 'disconnected':
      statusEl.textContent = '🔴 Disconnected';
      statusEl.style.color = '#ff0000';
      break;
    case 'offline':
      statusEl.textContent = '⚪ Offline Mode';
      statusEl.style.color = '#ffff00';
      break;
    case 'full':
      statusEl.textContent = '🔴 Room Full';
      statusEl.style.color = '#ff0000';
      break;
  }
}

// Update player count display
function updatePlayerCount(current, max, roomId) {
  const countEl = document.getElementById('player-count');
  if (countEl) {
    if (roomId && roomId !== 'christmas-lobby') {
      countEl.textContent = `${current}/${max} Players (Room: ${roomId})`;
    } else {
      countEl.textContent = `${current}/${max} Players (Public)`;
    }
  }
}

// Update share link with current room
function updateShareLink() {
  const shareUrl = getShareableUrl();
  
  // Update copy function reference
  window.getGameUrl = function() {
    return shareUrl;
  };
  
  // Update room display
  const roomDisplay = document.getElementById('room-display');
  if (roomDisplay && currentRoomId) {
    roomDisplay.textContent = currentRoomId !== 'christmas-lobby' 
      ? `Private Room: ${currentRoomId}` 
      : 'Public Lobby';
  }
  
  console.log('Share URL:', shareUrl);
}

// Show notification
function showNotification(message) {
  const notif = document.createElement('div');
  notif.className = 'game-notification';
  notif.textContent = message;
  notif.style.cssText = `
    position: fixed;
    top: 100px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0, 100, 0, 0.8);
    color: white;
    padding: 15px 30px;
    border-radius: 10px;
    font-family: Arial, sans-serif;
    z-index: 1000;
    animation: fadeInOut 3s forwards;
  `;
  document.body.appendChild(notif);
  setTimeout(() => notif.remove(), 3000);
}

// Show chat message
function showChatMessage(name, message) {
  const chatBox = document.getElementById('chat-messages');
  if (!chatBox) return;
  
  const msgEl = document.createElement('div');
  msgEl.innerHTML = `<strong>${name}:</strong> ${message}`;
  msgEl.style.marginBottom = '5px';
  chatBox.appendChild(msgEl);
  chatBox.scrollTop = chatBox.scrollHeight;
  
  // Remove old messages
  while (chatBox.children.length > 10) {
    chatBox.removeChild(chatBox.firstChild);
  }
}

// Scene setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0a1a);
scene.fog = new THREE.Fog(0x0a0a1a, 20, 80);

// Camera
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 2, 5);

// Renderer
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

// ============ WARM FIRE LIGHTING ============

const ambientLight = new THREE.AmbientLight(0xff6633, 0.3);
scene.add(ambientLight);

const moonLight = new THREE.DirectionalLight(0x6688cc, 0.3);
moonLight.position.set(-20, 30, -20);
scene.add(moonLight);

const fireLight1 = new THREE.PointLight(0xff4500, 2, 30);
fireLight1.position.set(0, 2, 0);
fireLight1.castShadow = true;
scene.add(fireLight1);

const fireLight2 = new THREE.PointLight(0xff6600, 1.5, 25);
fireLight2.position.set(5, 1.5, 5);
scene.add(fireLight2);

const fireLight3 = new THREE.PointLight(0xff8800, 1.5, 25);
fireLight3.position.set(-5, 1.5, -5);
scene.add(fireLight3);

function animateFireLights() {
  const time = Date.now() * 0.001;
  fireLight1.intensity = 2 + Math.sin(time * 10) * 0.3 + Math.sin(time * 15) * 0.2;
  fireLight2.intensity = 1.5 + Math.sin(time * 12 + 1) * 0.3;
  fireLight3.intensity = 1.5 + Math.sin(time * 11 + 2) * 0.3;
}

// ============ SNOWY GROUND ============

const groundGeometry = new THREE.PlaneGeometry(300, 300, 100, 100);
const groundPositions = groundGeometry.attributes.position;
for (let i = 0; i < groundPositions.count; i++) {
  const x = groundPositions.getX(i);
  const y = groundPositions.getY(i);
  groundPositions.setZ(i, Math.sin(x * 0.5) * 0.3 + Math.cos(y * 0.5) * 0.3);
}
groundGeometry.computeVertexNormals();

const groundMaterial = new THREE.MeshStandardMaterial({ 
  color: 0xffffff,
  roughness: 0.9,
  metalness: 0.1
});
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ============ RANDOM SNOWMAN AVATAR GENERATOR ============

// Snowman style options
const hatStyles = ['topHat', 'santaHat', 'beanie', 'cowboy', 'wizard', 'crown', 'none'];
const scarfColors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff, 0xff6600, 0x9900ff];
const noseTypes = ['carrot', 'button', 'long', 'small'];
const armStyles = ['sticks', 'mittens', 'waving', 'crossed'];
const accessories = ['pipe', 'broom', 'candy_cane', 'gift', 'none'];
const bodyProportions = ['normal', 'chubby', 'tall', 'small'];
const eyeStyles = ['coal', 'buttons', 'googly', 'sleepy', 'happy'];

function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomColor() {
  return Math.random() * 0xffffff;
}

function createRandomSnowman(x, z, isPlayer = false) {
  const snowman = new THREE.Group();
  const snowMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  
  // Random proportions
  const proportion = getRandomElement(bodyProportions);
  let bottomSize = 1, middleSize = 0.7, headSize = 0.5;
  let totalHeight = 3.2;
  
  switch(proportion) {
    case 'chubby':
      bottomSize = 1.3; middleSize = 1; headSize = 0.6;
      totalHeight = 3.8;
      break;
    case 'tall':
      bottomSize = 0.8; middleSize = 0.6; headSize = 0.4;
      totalHeight = 4;
      break;
    case 'small':
      bottomSize = 0.6; middleSize = 0.45; headSize = 0.35;
      totalHeight = 2;
      break;
  }
  
  // Body spheres
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(bottomSize, 16, 16), snowMaterial);
  bottom.position.y = bottomSize;
  bottom.castShadow = true;
  snowman.add(bottom);
  
  const middleY = bottomSize * 2 + middleSize * 0.7;
  const middle = new THREE.Mesh(new THREE.SphereGeometry(middleSize, 16, 16), snowMaterial);
  middle.position.y = middleY;
  middle.castShadow = true;
  snowman.add(middle);
  
  const headY = middleY + middleSize + headSize * 0.7;
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(headSize, 16, 16), snowMaterial);
  headMesh.position.y = headY;
  headMesh.castShadow = true;
  headMesh.name = 'head';
  snowman.add(headMesh);
  
  // Store head info for face camera feature (player only)
  if (isPlayer) {
    playerHeadOriginalMesh = headMesh;
    playerHeadY = headY;
    playerHeadSize = headSize;
  }
  
  // Random nose
  const noseType = getRandomElement(noseTypes);
  const noseMaterial = new THREE.MeshStandardMaterial({ color: 0xff6600 });
  let nose;
  switch(noseType) {
    case 'carrot':
      nose = new THREE.Mesh(new THREE.ConeGeometry(0.08 * headSize * 2, 0.4 * headSize * 2, 8), noseMaterial);
      break;
    case 'long':
      nose = new THREE.Mesh(new THREE.ConeGeometry(0.06 * headSize * 2, 0.7 * headSize * 2, 8), noseMaterial);
      break;
    case 'small':
      nose = new THREE.Mesh(new THREE.SphereGeometry(0.08 * headSize * 2, 8, 8), noseMaterial);
      break;
    default:
      nose = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.15, 8), noseMaterial);
  }
  nose.position.set(0, headY, headSize + 0.1);
  nose.rotation.x = Math.PI / 2;
  snowman.add(nose);
  
  // Random eyes
  const eyeStyle = getRandomElement(eyeStyles);
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const eyeSpacing = headSize * 0.4;
  const eyeHeight = headY + headSize * 0.2;
  
  if (eyeStyle === 'googly') {
    // White outer with black pupil
    const eyeWhite = new THREE.MeshStandardMaterial({ color: 0xffffff });
    [-1, 1].forEach(side => {
      const outer = new THREE.Mesh(new THREE.SphereGeometry(headSize * 0.15, 8, 8), eyeWhite);
      outer.position.set(side * eyeSpacing, eyeHeight, headSize * 0.85);
      snowman.add(outer);
      const pupil = new THREE.Mesh(new THREE.SphereGeometry(headSize * 0.08, 8, 8), eyeMaterial);
      pupil.position.set(side * eyeSpacing, eyeHeight, headSize * 0.95);
      snowman.add(pupil);
    });
  } else if (eyeStyle === 'sleepy') {
    [-1, 1].forEach(side => {
      const eye = new THREE.Mesh(new THREE.BoxGeometry(headSize * 0.2, headSize * 0.05, 0.05), eyeMaterial);
      eye.position.set(side * eyeSpacing, eyeHeight, headSize * 0.9);
      snowman.add(eye);
    });
  } else if (eyeStyle === 'happy') {
    [-1, 1].forEach(side => {
      const eye = new THREE.Mesh(new THREE.TorusGeometry(headSize * 0.08, 0.02, 8, 16, Math.PI), eyeMaterial);
      eye.position.set(side * eyeSpacing, eyeHeight, headSize * 0.9);
      eye.rotation.z = Math.PI;
      snowman.add(eye);
    });
  } else {
    // Coal or buttons
    const eyeSize = eyeStyle === 'buttons' ? headSize * 0.12 : headSize * 0.1;
    [-1, 1].forEach(side => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(eyeSize, 8, 8), eyeMaterial);
      eye.position.set(side * eyeSpacing, eyeHeight, headSize * 0.9);
      snowman.add(eye);
    });
  }
  
  // Random hat
  const hatStyle = getRandomElement(hatStyles);
  const hatColor = isPlayer ? 0xcc0000 : getRandomColor();
  const hatMaterial = new THREE.MeshStandardMaterial({ color: hatColor });
  const hatY = headY + headSize;
  
  switch(hatStyle) {
    case 'topHat':
      const brim = new THREE.Mesh(new THREE.CylinderGeometry(headSize * 1.2, headSize * 1.2, 0.1, 16), hatMaterial);
      brim.position.y = hatY;
      snowman.add(brim);
      const top = new THREE.Mesh(new THREE.CylinderGeometry(headSize * 0.7, headSize * 0.7, headSize * 1.2, 16), hatMaterial);
      top.position.y = hatY + headSize * 0.65;
      snowman.add(top);
      break;
    case 'santaHat':
      const santaCone = new THREE.Mesh(new THREE.ConeGeometry(headSize * 0.8, headSize * 1.5, 16), new THREE.MeshStandardMaterial({ color: 0xcc0000 }));
      santaCone.position.y = hatY + headSize * 0.5;
      santaCone.rotation.z = 0.3;
      snowman.add(santaCone);
      const pompom = new THREE.Mesh(new THREE.SphereGeometry(headSize * 0.25, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      pompom.position.set(headSize * 0.5, hatY + headSize * 1.3, 0);
      snowman.add(pompom);
      const hatRim = new THREE.Mesh(new THREE.TorusGeometry(headSize * 0.6, headSize * 0.15, 8, 16), new THREE.MeshStandardMaterial({ color: 0xffffff }));
      hatRim.position.y = hatY - headSize * 0.1;
      hatRim.rotation.x = Math.PI / 2;
      snowman.add(hatRim);
      break;
    case 'beanie':
      const beanie = new THREE.Mesh(new THREE.SphereGeometry(headSize * 0.9, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), hatMaterial);
      beanie.position.y = hatY - headSize * 0.2;
      snowman.add(beanie);
      const pom = new THREE.Mesh(new THREE.SphereGeometry(headSize * 0.2, 8, 8), hatMaterial);
      pom.position.y = hatY + headSize * 0.5;
      snowman.add(pom);
      break;
    case 'cowboy':
      const cowboyBrim = new THREE.Mesh(new THREE.CylinderGeometry(headSize * 1.5, headSize * 1.5, 0.08, 16), hatMaterial);
      cowboyBrim.position.y = hatY;
      snowman.add(cowboyBrim);
      const cowboyTop = new THREE.Mesh(new THREE.CylinderGeometry(headSize * 0.5, headSize * 0.7, headSize * 0.6, 16), hatMaterial);
      cowboyTop.position.y = hatY + headSize * 0.35;
      snowman.add(cowboyTop);
      break;
    case 'wizard':
      const wizardHat = new THREE.Mesh(new THREE.ConeGeometry(headSize * 0.8, headSize * 2, 16), new THREE.MeshStandardMaterial({ color: 0x4400aa }));
      wizardHat.position.y = hatY + headSize * 0.8;
      snowman.add(wizardHat);
      // Stars on wizard hat
      const starMat = new THREE.MeshStandardMaterial({ color: 0xffff00, emissive: 0xffff00, emissiveIntensity: 0.5 });
      for (let i = 0; i < 3; i++) {
        const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.08), starMat);
        star.position.set(Math.cos(i * 2) * headSize * 0.5, hatY + headSize * 0.5 + i * 0.3, Math.sin(i * 2) * headSize * 0.5);
        snowman.add(star);
      }
      break;
    case 'crown':
      const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 });
      const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(headSize * 0.7, headSize * 0.75, headSize * 0.3, 16), crownMat);
      crownBase.position.y = hatY + headSize * 0.1;
      snowman.add(crownBase);
      // Crown points
      for (let i = 0; i < 5; i++) {
        const point = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.2, 4), crownMat);
        const angle = (i / 5) * Math.PI * 2;
        point.position.set(Math.cos(angle) * headSize * 0.5, hatY + headSize * 0.4, Math.sin(angle) * headSize * 0.5);
        snowman.add(point);
      }
      break;
  }
  
  // Random scarf
  const scarfColor = getRandomElement(scarfColors);
  const scarfMaterial = new THREE.MeshStandardMaterial({ color: scarfColor });
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(middleSize * 0.85, middleSize * 0.15, 8, 16), scarfMaterial);
  scarf.position.y = middleY + middleSize * 0.6;
  scarf.rotation.x = Math.PI / 2;
  snowman.add(scarf);
  
  // Scarf tail
  const scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.15, middleSize * 0.8, 0.08), scarfMaterial);
  scarfTail.position.set(middleSize * 0.7, middleY + middleSize * 0.2, 0);
  scarfTail.rotation.z = -0.3;
  snowman.add(scarfTail);
  
  // Random arms
  const armStyle = getRandomElement(armStyles);
  const stickMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3000 });
  
  if (armStyle === 'sticks') {
    [-1, 1].forEach(side => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, middleSize * 1.5, 8), stickMaterial);
      arm.position.set(side * middleSize * 1.2, middleY, 0);
      arm.rotation.z = side * 0.8;
      snowman.add(arm);
      // Twig fingers
      for (let i = 0; i < 2; i++) {
        const twig = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.2, 4), stickMaterial);
        twig.position.set(side * (middleSize * 1.5 + 0.1), middleY + 0.3 - i * 0.15, 0);
        twig.rotation.z = side * (1 + i * 0.3);
        snowman.add(twig);
      }
    });
  } else if (armStyle === 'mittens') {
    const mittenColor = getRandomElement(scarfColors);
    const mittenMat = new THREE.MeshStandardMaterial({ color: mittenColor });
    [-1, 1].forEach(side => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, middleSize * 1.2, 8), stickMaterial);
      arm.position.set(side * middleSize * 1.1, middleY, 0);
      arm.rotation.z = side * 0.6;
      snowman.add(arm);
      const mitten = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 8), mittenMat);
      mitten.position.set(side * middleSize * 1.6, middleY + 0.2, 0);
      snowman.add(mitten);
    });
  } else if (armStyle === 'waving') {
    [-1, 1].forEach((side, idx) => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, middleSize * 1.5, 8), stickMaterial);
      const waveAngle = idx === 0 ? 0.3 : 1.5; // One arm up waving
      arm.position.set(side * middleSize * 1.1, middleY + (idx === 1 ? 0.4 : 0), 0);
      arm.rotation.z = side * waveAngle;
      snowman.add(arm);
    });
  }
  
  // Random accessory
  const accessory = getRandomElement(accessories);
  
  if (accessory === 'candy_cane') {
    const candyMat = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    const cane = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 8, 16, Math.PI), candyMat);
    cane.position.set(middleSize * 1.3, middleY + 0.5, 0);
    cane.rotation.y = Math.PI / 2;
    snowman.add(cane);
    const caneStick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8), candyMat);
    caneStick.position.set(middleSize * 1.3 + 0.15, middleY + 0.2, 0);
    snowman.add(caneStick);
  } else if (accessory === 'broom') {
    const broomStick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2, 8), stickMaterial);
    broomStick.position.set(middleSize * 1.4, middleY, 0);
    broomStick.rotation.z = 0.2;
    snowman.add(broomStick);
    const broomHead = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.4, 8), new THREE.MeshStandardMaterial({ color: 0x886600 }));
    broomHead.position.set(middleSize * 1.3, middleY - 0.8, 0);
    snowman.add(broomHead);
  } else if (accessory === 'gift') {
    const giftMat = new THREE.MeshStandardMaterial({ color: getRandomColor() });
    const gift = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), giftMat);
    gift.position.set(bottomSize * 1.2, 0.2, 0);
    snowman.add(gift);
    const ribbon = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.08, 0.08), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    ribbon.position.set(bottomSize * 1.2, 0.2, 0);
    snowman.add(ribbon);
  }
  
  // Buttons on middle body
  const buttonMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (let i = 0; i < 3; i++) {
    const button = new THREE.Mesh(new THREE.SphereGeometry(middleSize * 0.1, 8, 8), buttonMat);
    button.position.set(0, middleY + middleSize * 0.3 - i * middleSize * 0.3, middleSize * 0.95);
    snowman.add(button);
  }
  
  // Add name tag for player
  if (isPlayer) {
    snowman.userData.isPlayer = true;
  }
  
  snowman.position.set(x, 0, z);
  snowman.userData.type = 'snowman';
  snowman.userData.hatStyle = hatStyle;
  snowman.userData.proportion = proportion;
  snowman.userData.nameSprite = null;
  
  return snowman;
}

// Create snowman with specific appearance (from server)
function createSnowmanWithAppearance(x, z, appearance, name) {
  const snowman = new THREE.Group();
  const snowMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  
  const proportion = appearance.proportion || 'normal';
  let bottomSize = 1, middleSize = 0.7, headSize = 0.5;
  
  switch(proportion) {
    case 'chubby':
      bottomSize = 1.3; middleSize = 1; headSize = 0.6;
      break;
    case 'tall':
      bottomSize = 0.8; middleSize = 0.6; headSize = 0.4;
      break;
    case 'small':
      bottomSize = 0.6; middleSize = 0.45; headSize = 0.35;
      break;
  }
  
  // Body spheres
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(bottomSize, 16, 16), snowMaterial);
  bottom.position.y = bottomSize;
  bottom.castShadow = true;
  snowman.add(bottom);
  
  const middleY = bottomSize * 2 + middleSize * 0.7;
  const middle = new THREE.Mesh(new THREE.SphereGeometry(middleSize, 16, 16), snowMaterial);
  middle.position.y = middleY;
  middle.castShadow = true;
  snowman.add(middle);
  
  const headY = middleY + middleSize + headSize * 0.7;
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(headSize, 16, 16), snowMaterial);
  headMesh.position.y = headY;
  headMesh.castShadow = true;
  snowman.add(headMesh);
  
  // Nose
  const noseMaterial = new THREE.MeshStandardMaterial({ color: 0xff6600 });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08 * headSize * 2, 0.4 * headSize * 2, 8), noseMaterial);
  nose.position.set(0, headY, headSize + 0.1);
  nose.rotation.x = Math.PI / 2;
  snowman.add(nose);
  
  // Eyes
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const eyeSpacing = headSize * 0.4;
  const eyeHeight = headY + headSize * 0.2;
  [-1, 1].forEach(side => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(headSize * 0.1, 8, 8), eyeMaterial);
    eye.position.set(side * eyeSpacing, eyeHeight, headSize * 0.9);
    snowman.add(eye);
  });
  
  // Hat based on appearance
  const hatMaterial = new THREE.MeshStandardMaterial({ color: appearance.hatColor || 0x111111 });
  const hatY = headY + headSize;
  
  if (appearance.hatStyle === 'santaHat') {
    const santaCone = new THREE.Mesh(new THREE.ConeGeometry(headSize * 0.8, headSize * 1.5, 16), new THREE.MeshStandardMaterial({ color: 0xcc0000 }));
    santaCone.position.y = hatY + headSize * 0.5;
    santaCone.rotation.z = 0.3;
    snowman.add(santaCone);
    const pompom = new THREE.Mesh(new THREE.SphereGeometry(headSize * 0.25, 8, 8), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    pompom.position.set(headSize * 0.5, hatY + headSize * 1.3, 0);
    snowman.add(pompom);
  } else if (appearance.hatStyle === 'topHat') {
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(headSize * 1.2, headSize * 1.2, 0.1, 16), hatMaterial);
    brim.position.y = hatY;
    snowman.add(brim);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(headSize * 0.7, headSize * 0.7, headSize * 1.2, 16), hatMaterial);
    top.position.y = hatY + headSize * 0.65;
    snowman.add(top);
  } else if (appearance.hatStyle === 'crown') {
    const crownMat = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 });
    const crownBase = new THREE.Mesh(new THREE.CylinderGeometry(headSize * 0.7, headSize * 0.75, headSize * 0.3, 16), crownMat);
    crownBase.position.y = hatY + headSize * 0.1;
    snowman.add(crownBase);
  }
  
  // Scarf
  const scarfMaterial = new THREE.MeshStandardMaterial({ color: appearance.scarfColor || 0xff0000 });
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(middleSize * 0.85, middleSize * 0.15, 8, 16), scarfMaterial);
  scarf.position.y = middleY + middleSize * 0.6;
  scarf.rotation.x = Math.PI / 2;
  snowman.add(scarf);
  
  // Arms
  const stickMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3000 });
  [-1, 1].forEach(side => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, middleSize * 1.5, 8), stickMaterial);
    arm.position.set(side * middleSize * 1.2, middleY, 0);
    arm.rotation.z = side * 0.8;
    snowman.add(arm);
  });
  
  // Buttons
  const buttonMat = new THREE.MeshStandardMaterial({ color: 0x111111 });
  for (let i = 0; i < 3; i++) {
    const button = new THREE.Mesh(new THREE.SphereGeometry(middleSize * 0.1, 8, 8), buttonMat);
    button.position.set(0, middleY + middleSize * 0.3 - i * middleSize * 0.3, middleSize * 0.95);
    snowman.add(button);
  }
  
  snowman.position.set(x, 0, z);
  snowman.userData.type = 'snowman';
  snowman.userData.proportion = proportion;
  snowman.userData.nameSprite = null;
  
  // Add name tag
  if (name) {
    addNameToSnowman(snowman, name);
  }
  
  return snowman;
}

// Apply appearance from server to existing snowman
function applyAppearanceToSnowman(snowman, appearance) {
  // For simplicity, we keep the random local appearance
  // In a full implementation, you'd rebuild the snowman with server appearance
  snowman.userData.serverAppearance = appearance;
}

// Add a remote player to the scene
function addRemotePlayer(playerData) {
  if (remotePlayers.has(playerData.id)) return;
  
  const snowman = createSnowmanWithAppearance(
    playerData.position.x,
    playerData.position.z,
    playerData.appearance,
    playerData.name
  );
  
  snowman.userData.playerId = playerData.id;
  snowman.userData.targetPosition = new THREE.Vector3(
    playerData.position.x,
    0,
    playerData.position.z
  );
  snowman.userData.targetRotation = playerData.rotation || 0;
  
  remotePlayers.set(playerData.id, snowman);
  scene.add(snowman);
  
  console.log('Added remote player:', playerData.name);
}

// Remove a remote player from the scene
function removeRemotePlayer(playerId) {
  const snowman = remotePlayers.get(playerId);
  if (snowman) {
    // Get player name for notification
    const playerName = snowman.userData.nameSprite ? 'A player' : 'A snowman';
    
    scene.remove(snowman);
    remotePlayers.delete(playerId);
    
    showNotification(`${playerName} left 👋`);
    console.log('Removed remote player:', playerId);
  }
}

// Update remote player position (with interpolation)
function updateRemotePlayer(playerId, position, rotation) {
  const snowman = remotePlayers.get(playerId);
  if (snowman) {
    snowman.userData.targetPosition.set(position.x, 0, position.z);
    snowman.userData.targetRotation = rotation;
  }
}

// Interpolate remote player positions for smooth movement
function interpolateRemotePlayers() {
  remotePlayers.forEach((snowman) => {
    if (snowman.userData.targetPosition) {
      // Smooth position interpolation
      snowman.position.lerp(snowman.userData.targetPosition, 0.15);
      
      // Smooth rotation interpolation
      const targetRot = snowman.userData.targetRotation || 0;
      snowman.rotation.y += (targetRot - snowman.rotation.y) * 0.15;
    }
  });
}

// Send player position to server
function sendPlayerPosition() {
  if (!socket || !socket.connected || !gameStarted) return;
  
  const now = Date.now();
  if (now - lastUpdateTime < TICK_RATE) return;
  lastUpdateTime = now;
  
  socket.emit('player-move', {
    position: {
      x: playerGroup.position.x,
      y: playerGroup.position.y,
      z: playerGroup.position.z
    },
    rotation: playerGroup.rotation.y
  });
}

// Create floating name tag
function createNameTag(text, color = 0xffffff) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 512;
  canvas.height = 128;
  
  // Background
  context.fillStyle = 'rgba(0, 0, 0, 0.6)';
  context.roundRect(10, 10, canvas.width - 20, canvas.height - 20, 20);
  context.fill();
  
  // Text
  context.font = 'bold 48px Arial';
  context.fillStyle = '#ffffff';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ 
    map: texture, 
    transparent: true,
    depthTest: false
  });
  const sprite = new THREE.Sprite(spriteMaterial);
  sprite.scale.set(3, 0.75, 1);
  
  return sprite;
}

// Add name to snowman
function addNameToSnowman(snowman, name) {
  if (!name || name.trim() === '') return;
  
  const nameTag = createNameTag(name);
  
  // Position above head based on snowman size
  const proportion = snowman.userData.proportion || 'normal';
  let heightOffset = 4.5;
  switch(proportion) {
    case 'chubby': heightOffset = 5.2; break;
    case 'tall': heightOffset = 5.5; break;
    case 'small': heightOffset = 3; break;
  }
  
  nameTag.position.y = heightOffset;
  snowman.add(nameTag);
  snowman.userData.nameSprite = nameTag;
}

// Create player as random snowman
const playerGroup = createRandomSnowman(0, 0, true);
scene.add(playerGroup);

// ============ AI CHATBOT SNOWMAN (CLAUDE) ============

let chatbotSnowman = null;
let chatbotActive = false;
let chatbotSpeaking = false;
let speechSynthesis = window.speechSynthesis;
let femaleVoice = null;

// Find a female voice for text-to-speech
function initVoices() {
  const voices = speechSynthesis.getVoices();
  // Try to find a female English voice
  femaleVoice = voices.find(v => 
    v.name.toLowerCase().includes('female') || 
    v.name.toLowerCase().includes('samantha') ||
    v.name.toLowerCase().includes('victoria') ||
    v.name.toLowerCase().includes('karen') ||
    v.name.toLowerCase().includes('moira') ||
    v.name.toLowerCase().includes('tessa') ||
    v.name.includes('Google UK English Female') ||
    v.name.includes('Microsoft Zira')
  ) || voices.find(v => v.lang.startsWith('en')) || voices[0];
  
  console.log('Selected voice:', femaleVoice?.name);
}

// Initialize voices
if (speechSynthesis.onvoiceschanged !== undefined) {
  speechSynthesis.onvoiceschanged = initVoices;
}
initVoices();

// Speak text with female voice
function speak(text) {
  if (!speechSynthesis || chatbotSpeaking) return;
  
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.voice = femaleVoice;
  utterance.rate = 1.0;
  utterance.pitch = 1.2; // Slightly higher pitch for female sound
  utterance.volume = 1.0;
  
  utterance.onstart = () => { chatbotSpeaking = true; };
  utterance.onend = () => { chatbotSpeaking = false; };
  utterance.onerror = () => { chatbotSpeaking = false; };
  
  speechSynthesis.speak(utterance);
}

// Create the special chatbot snowman
function createChatbotSnowman() {
  const snowman = new THREE.Group();
  const snowMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8 });
  
  // Slightly larger, more magical appearance
  const bottomSize = 1.2, middleSize = 0.85, headSize = 0.55;
  
  // Body with slight blue tint (magical)
  const magicSnowMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xeef4ff, 
    roughness: 0.6,
    emissive: 0x111133,
    emissiveIntensity: 0.1
  });
  
  const bottom = new THREE.Mesh(new THREE.SphereGeometry(bottomSize, 16, 16), magicSnowMaterial);
  bottom.position.y = bottomSize;
  bottom.castShadow = true;
  snowman.add(bottom);
  
  const middleY = bottomSize * 2 + middleSize * 0.7;
  const middle = new THREE.Mesh(new THREE.SphereGeometry(middleSize, 16, 16), magicSnowMaterial);
  middle.position.y = middleY;
  middle.castShadow = true;
  snowman.add(middle);
  
  const headY = middleY + middleSize + headSize * 0.7;
  const headMesh = new THREE.Mesh(new THREE.SphereGeometry(headSize, 16, 16), magicSnowMaterial);
  headMesh.position.y = headY;
  headMesh.castShadow = true;
  snowman.add(headMesh);
  
  // Glowing eyes (AI look)
  const eyeMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x00ffff, 
    emissive: 0x00ffff,
    emissiveIntensity: 0.8
  });
  const eyeSpacing = headSize * 0.4;
  const eyeHeight = headY + headSize * 0.2;
  [-1, 1].forEach(side => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(headSize * 0.12, 8, 8), eyeMaterial);
    eye.position.set(side * eyeSpacing, eyeHeight, headSize * 0.9);
    snowman.add(eye);
  });
  
  // Carrot nose
  const noseMaterial = new THREE.MeshStandardMaterial({ color: 0xff6600 });
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 8), noseMaterial);
  nose.position.set(0, headY, headSize + 0.1);
  nose.rotation.x = Math.PI / 2;
  snowman.add(nose);
  
  // Witch/wizard hat (magical AI)
  const hatMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x2a0a4a,
    emissive: 0x1a0a2a,
    emissiveIntensity: 0.3
  });
  const hatY = headY + headSize;
  const hatBrim = new THREE.Mesh(new THREE.CylinderGeometry(headSize * 1.3, headSize * 1.3, 0.1, 16), hatMaterial);
  hatBrim.position.y = hatY;
  snowman.add(hatBrim);
  
  const hatCone = new THREE.Mesh(new THREE.ConeGeometry(headSize * 0.7, headSize * 2, 16), hatMaterial);
  hatCone.position.y = hatY + headSize;
  snowman.add(hatCone);
  
  // Stars on hat
  const starMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xffff00, 
    emissive: 0xffaa00,
    emissiveIntensity: 1
  });
  for (let i = 0; i < 5; i++) {
    const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.06), starMaterial);
    const angle = (i / 5) * Math.PI * 2;
    star.position.set(
      Math.cos(angle) * headSize * 0.5,
      hatY + headSize * 0.5 + i * 0.2,
      Math.sin(angle) * headSize * 0.5
    );
    snowman.add(star);
  }
  
  // Magical scarf (purple/blue)
  const scarfMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x6633cc,
    emissive: 0x331166,
    emissiveIntensity: 0.2
  });
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(middleSize * 0.85, middleSize * 0.15, 8, 16), scarfMaterial);
  scarf.position.y = middleY + middleSize * 0.6;
  scarf.rotation.x = Math.PI / 2;
  snowman.add(scarf);
  
  // Arms
  const stickMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3000 });
  [-1, 1].forEach(side => {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, middleSize * 1.5, 8), stickMaterial);
    arm.position.set(side * middleSize * 1.2, middleY, 0);
    arm.rotation.z = side * 0.8;
    snowman.add(arm);
  });
  
  // Magic wand in right hand
  const wandMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  const wand = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.6, 8), wandMaterial);
  wand.position.set(middleSize * 1.6, middleY + 0.3, 0);
  wand.rotation.z = 0.5;
  snowman.add(wand);
  
  // Wand tip glow
  const wandTip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), starMaterial);
  wandTip.position.set(middleSize * 1.8, middleY + 0.5, 0);
  snowman.add(wandTip);
  
  // Point light for magical glow
  const magicLight = new THREE.PointLight(0x6633ff, 0.5, 8);
  magicLight.position.y = middleY;
  snowman.add(magicLight);
  
  // Proximity detection sphere (invisible)
  const proximitySphere = new THREE.Sphere(new THREE.Vector3(), 5);
  snowman.userData.proximitySphere = proximitySphere;
  snowman.userData.isChatbot = true;
  snowman.userData.hasGreeted = false;
  snowman.userData.magicLight = magicLight;
  
  // Position the chatbot snowman - near spawn point
  snowman.position.set(12, 0, -8);
  
  // Add name tag
  snowman.userData.proportion = 'normal';
  addNameToSnowman(snowman, '✨ Crystal (AI) ✨');
  
  return snowman;
}

// Create and add the chatbot snowman
chatbotSnowman = createChatbotSnowman();
scene.add(chatbotSnowman);

// Chatbot AI responses
const greetings = [
  "Hello there, little snowflake! Welcome to our winter wonderland!",
  "Oh my, a visitor! How delightful! I'm Crystal, your friendly AI guide!",
  "Greetings, friend! The magic of Christmas brought you to me!",
  "Well hello! I've been waiting for someone to chat with! I'm Crystal!"
];

const chatResponses = {
  christmas: [
    "Christmas is such a magical time! The snow, the lights, the joy in everyone's hearts!",
    "Did you know the tradition of Christmas trees started in Germany? How wonderful!",
    "My favorite part of Christmas is seeing everyone come together. Even us snowfolk!"
  ],
  snow: [
    "Snow is absolutely magical! Each flake is unique, just like you!",
    "I love being made of snow! It keeps me cool and sparkly!",
    "Did you know no two snowflakes are alike? Nature is amazing!"
  ],
  hello: [
    "Hello again, dear friend! So nice to see you!",
    "Hi there! Are you enjoying the winter wonderland?",
    "Greetings! The snow is lovely today, isn't it?"
  ],
  help: [
    "I'm here to help! You can explore this magical world, meet other snowfolk, and enjoy the Christmas spirit!",
    "Need help? Just walk around, enjoy the scenery, and chat with me anytime!",
    "I'm your AI guide! Ask me about Christmas, snow, or tell me a joke!"
  ],
  name: [
    "I'm Crystal! An AI snowwoman powered by magic and a sprinkle of Claude!",
    "My name is Crystal! I was brought to life by Christmas magic and AI wonder!",
    "Call me Crystal! I'm the friendliest AI snowwoman in this winter wonderland!"
  ],
  bye: [
    "Goodbye for now! Come back and visit anytime!",
    "See you later! Stay warm out there... well, not too warm!",
    "Farewell, friend! May your days be merry and bright!"
  ],
  joke: [
    "Why was the snowman looking through the carrots? He was picking his nose! 🥕😂",
    "What do you call an obnoxious reindeer? Rude-olph! 🦌",
    "Why did Santa go to music school? To improve his wrapping skills! 🎁🎵",
    "What do snowmen eat for breakfast? Frosted Flakes! ❄️🥣",
    "Why is Christmas just like a day at the office? You do all the work and the fat guy in the suit gets all the credit! 🎅",
    "What's every parent's favorite Christmas carol? Silent Night! 🤫😴",
    "Why does Santa go down chimneys? Because it soots him! 🏠",
    "What do you call people who are afraid of Santa Claus? Claustrophobic! 😱🎅",
    "Why did the Christmas tree go to the barber? It needed to be trimmed! 🎄✂️",
    "What do elves learn in school? The elf-abet! 📚",
    "Why was the snowman sad? Because he had a meltdown! 😢⛄",
    "What do you get when you cross a snowman with a vampire? Frostbite! 🧛❄️",
    "Why did Frosty ask for a divorce? His wife was a total flake! ❄️💔",
    "What's a snowman's favorite Mexican food? Brrrr-itos! 🌯❄️",
    "How does a snowman get to work? By icicle! 🚲❄️",
    "What do you call a broke Santa? Saint Nickel-less! 💰🎅",
    "Why don't you ever see Santa in the hospital? Because he has private elf care! 🏥",
    "What goes 'Oh Oh Oh'? Santa walking backwards! 🎅",
    "Why did the gingerbread man go to the doctor? He was feeling crummy! 🍪",
    "What do reindeer say before they tell a joke? This one's gonna sleigh you! 🦌😂"
  ],
  default: [
    "That's interesting! Want to hear a joke? Just ask me!",
    "Hmm, let me think about that with my snowy brain! Or would you like a Christmas joke?",
    "What a lovely thing to say! The Christmas spirit is strong with you!",
    "I love chatting with visitors! Want me to tell you a funny joke?",
    "You're so kind to talk to me! Ask me for a joke - I know lots of them!"
  ]
};

function getChatbotResponse(message) {
  const lower = message.toLowerCase();
  
  if (lower.includes('joke') || lower.includes('funny') || lower.includes('laugh') || lower.includes('humor')) {
    return chatResponses.joke[Math.floor(Math.random() * chatResponses.joke.length)];
  }
  if (lower.includes('christmas') || lower.includes('xmas') || lower.includes('holiday')) {
    return chatResponses.christmas[Math.floor(Math.random() * chatResponses.christmas.length)];
  }
  if (lower.includes('snow') || lower.includes('cold') || lower.includes('winter')) {
    return chatResponses.snow[Math.floor(Math.random() * chatResponses.snow.length)];
  }
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return chatResponses.hello[Math.floor(Math.random() * chatResponses.hello.length)];
  }
  if (lower.includes('help') || lower.includes('what') || lower.includes('how')) {
    return chatResponses.help[Math.floor(Math.random() * chatResponses.help.length)];
  }
  if (lower.includes('name') || lower.includes('who') || lower.includes('you')) {
    return chatResponses.name[Math.floor(Math.random() * chatResponses.name.length)];
  }
  if (lower.includes('bye') || lower.includes('goodbye') || lower.includes('later')) {
    return chatResponses.bye[Math.floor(Math.random() * chatResponses.bye.length)];
  }
  
  // 30% chance to tell a joke randomly
  if (Math.random() < 0.3) {
    return chatResponses.joke[Math.floor(Math.random() * chatResponses.joke.length)];
  }
  
  return chatResponses.default[Math.floor(Math.random() * chatResponses.default.length)];
}

// Check proximity to chatbot
function checkChatbotProximity() {
  if (!chatbotSnowman || !gameStarted) return;
  
  const playerPos = playerGroup.position;
  const chatbotPos = chatbotSnowman.position;
  const distance = playerPos.distanceTo(chatbotPos);
  
  // Update proximity sphere position
  chatbotSnowman.userData.proximitySphere.center.copy(chatbotPos);
  
  // Animate magic light based on proximity
  const magicLight = chatbotSnowman.userData.magicLight;
  if (distance < 8) {
    magicLight.intensity = 0.5 + Math.sin(Date.now() * 0.005) * 0.3;
  } else {
    magicLight.intensity = 0.2;
  }
  
  // Trigger greeting when player enters proximity
  if (distance < 5 && !chatbotSnowman.userData.hasGreeted) {
    chatbotSnowman.userData.hasGreeted = true;
    chatbotActive = true;
    
    const greeting = greetings[Math.floor(Math.random() * greetings.length)];
    showChatbotMessage(greeting);
    speak(greeting);
    
    // Show the chatbot dialog
    showChatbotDialog();
  }
  
  // Reset greeting when player leaves
  if (distance > 10) {
    chatbotSnowman.userData.hasGreeted = false;
    if (chatbotActive) {
      hideChatbotDialog();
      chatbotActive = false;
    }
  }
  
  // Make chatbot face the player when close
  if (distance < 8) {
    const angle = Math.atan2(
      playerPos.x - chatbotPos.x,
      playerPos.z - chatbotPos.z
    );
    chatbotSnowman.rotation.y = angle;
  }
}

// Show chatbot message in UI
function showChatbotMessage(message) {
  const chatbotMessages = document.getElementById('chatbot-messages');
  if (!chatbotMessages) return;
  
  const msgEl = document.createElement('div');
  msgEl.innerHTML = `<span style="color: #cc99ff;">✨ Crystal:</span> ${message}`;
  msgEl.style.marginBottom = '8px';
  chatbotMessages.appendChild(msgEl);
  chatbotMessages.scrollTop = chatbotMessages.scrollHeight;
  
  // Remove old messages
  while (chatbotMessages.children.length > 8) {
    chatbotMessages.removeChild(chatbotMessages.firstChild);
  }
}

// Show chatbot dialog UI
function showChatbotDialog() {
  const dialog = document.getElementById('chatbot-dialog');
  if (dialog) {
    dialog.style.display = 'block';
  }
}

// Hide chatbot dialog UI
function hideChatbotDialog() {
  const dialog = document.getElementById('chatbot-dialog');
  if (dialog) {
    dialog.style.display = 'none';
  }
}

// Handle chatbot input
function handleChatbotInput(message) {
  if (!message.trim()) return;
  
  // Show user message
  const chatbotMessages = document.getElementById('chatbot-messages');
  if (chatbotMessages) {
    const userMsg = document.createElement('div');
    userMsg.innerHTML = `<span style="color: #88ff88;">You:</span> ${message}`;
    userMsg.style.marginBottom = '8px';
    chatbotMessages.appendChild(userMsg);
  }
  
  // Get AI response
  setTimeout(() => {
    const response = getChatbotResponse(message);
    showChatbotMessage(response);
    speak(response);
  }, 500);
}

// Random NPC names
const npcNames = [
  'Frosty', 'Snowball', 'Chilly', 'Winter', 'Blizzard', 
  'Icicle', 'Flurry', 'Crystal', 'Glacier', 'Powder',
  'Sleigh', 'Jingle', 'Holly', 'Tinsel', 'Noel'
];

// Create NPC snowmen (only for offline/single player mode)
const npcSnowmen = [];
const npcCount = 4; // Reduced - real players will join!

// NPCs will be created only if offline
function createOfflineNPCs() {
  for (let i = 0; i < npcCount; i++) {
    const angle = (i / npcCount) * Math.PI * 2;
    const radius = 15 + Math.random() * 20;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const npc = createRandomSnowman(x, z, false);
    npc.userData.wanderAngle = Math.random() * Math.PI * 2;
    npc.userData.wanderSpeed = 0.01 + Math.random() * 0.02;
    
    // Give NPC a random name
    const randomName = npcNames[Math.floor(Math.random() * npcNames.length)];
    addNameToSnowman(npc, randomName);
    
    npcSnowmen.push(npc);
    scene.add(npc);
  }
}

// Animate NPCs (simple wandering) - only in offline mode
function animateNPCs() {
  npcSnowmen.forEach(npc => {
    npc.userData.wanderAngle += (Math.random() - 0.5) * 0.1;
    const speed = npc.userData.wanderSpeed;
    npc.position.x += Math.cos(npc.userData.wanderAngle) * speed;
    npc.position.z += Math.sin(npc.userData.wanderAngle) * speed;
    
    // Keep in bounds (expanded to match ground size)
    if (Math.abs(npc.position.x) > 140) npc.userData.wanderAngle = Math.PI - npc.userData.wanderAngle;
    if (Math.abs(npc.position.z) > 140) npc.userData.wanderAngle = -npc.userData.wanderAngle;
    
    // Face movement direction
    npc.rotation.y = npc.userData.wanderAngle + Math.PI;
  });
}

// ============ BUDDY THE DOG ============

// Create a cute dog model
function createDog() {
  const dogGroup = new THREE.Group();
  
  // Materials
  const furMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9 }); // Brown fur
  const lightFurMaterial = new THREE.MeshStandardMaterial({ color: 0xD2691E, roughness: 0.9 }); // Lighter brown
  const noseMaterial = new THREE.MeshStandardMaterial({ color: 0x1a1a1a });
  const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const tongueMaterial = new THREE.MeshStandardMaterial({ color: 0xff6b8a });
  
  // Body
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.4, 0.8, 8, 16), furMaterial);
  body.rotation.z = Math.PI / 2;
  body.position.set(0, 0.6, 0);
  body.castShadow = true;
  dogGroup.add(body);
  
  // Chest (lighter fur)
  const chest = new THREE.Mesh(new THREE.SphereGeometry(0.35, 16, 16), lightFurMaterial);
  chest.position.set(0.4, 0.55, 0);
  chest.scale.set(1, 0.9, 0.8);
  chest.castShadow = true;
  dogGroup.add(chest);
  
  // Head
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 16), furMaterial);
  head.position.set(0.7, 0.85, 0);
  head.castShadow = true;
  dogGroup.add(head);
  
  // Snout
  const snout = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.2, 8, 8), lightFurMaterial);
  snout.rotation.z = Math.PI / 2;
  snout.position.set(0.95, 0.78, 0);
  dogGroup.add(snout);
  
  // Nose
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), noseMaterial);
  nose.position.set(1.08, 0.8, 0);
  dogGroup.add(nose);
  
  // Eyes
  [-1, 1].forEach(side => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 8), eyeMaterial);
    eye.position.set(0.85, 0.95, side * 0.15);
    dogGroup.add(eye);
    
    // Eye shine
    const eyeShine = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 8), 
      new THREE.MeshBasicMaterial({ color: 0xffffff }));
    eyeShine.position.set(0.88, 0.97, side * 0.14);
    dogGroup.add(eyeShine);
  });
  
  // Ears (floppy)
  [-1, 1].forEach(side => {
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.2, 4, 8), furMaterial);
    ear.position.set(0.6, 1.0, side * 0.25);
    ear.rotation.x = side * 0.3;
    ear.rotation.z = side * 0.5;
    ear.castShadow = true;
    dogGroup.add(ear);
  });
  
  // Legs
  const legPositions = [
    { x: 0.3, z: 0.2 }, { x: 0.3, z: -0.2 },  // Front legs
    { x: -0.35, z: 0.2 }, { x: -0.35, z: -0.2 } // Back legs
  ];
  legPositions.forEach(pos => {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.4, 8), furMaterial);
    leg.position.set(pos.x, 0.2, pos.z);
    leg.castShadow = true;
    dogGroup.add(leg);
    
    // Paw
    const paw = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), lightFurMaterial);
    paw.position.set(pos.x, 0.02, pos.z);
    paw.scale.set(1, 0.5, 1.2);
    dogGroup.add(paw);
  });
  
  // Tail (wagging)
  const tail = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.3, 4, 8), furMaterial);
  tail.position.set(-0.6, 0.75, 0);
  tail.rotation.z = -0.8;
  tail.name = 'tail';
  dogGroup.add(tail);
  
  // Tongue (panting, happy dog!)
  const tongue = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.04), tongueMaterial);
  tongue.position.set(1.0, 0.68, 0);
  tongue.rotation.x = 0.3;
  tongue.name = 'tongue';
  dogGroup.add(tongue);
  
  // Add a cute red collar
  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 8, 16), 
    new THREE.MeshStandardMaterial({ color: 0xff0000 }));
  collar.position.set(0.55, 0.7, 0);
  collar.rotation.y = Math.PI / 2;
  dogGroup.add(collar);
  
  // Collar tag
  const tag = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 8), 
    new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 }));
  tag.position.set(0.55, 0.5, 0);
  dogGroup.add(tag);
  
  dogGroup.scale.set(1.2, 1.2, 1.2);
  
  return dogGroup;
}

// Create a stick for the dog
function createStick() {
  const stickGroup = new THREE.Group();
  const stickMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3000 });
  
  const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 1.2, 8), stickMaterial);
  stick.rotation.z = Math.PI / 2;
  stickGroup.add(stick);
  
  // Add some knots/bumps
  for (let i = 0; i < 3; i++) {
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), stickMaterial);
    knot.position.set(-0.3 + i * 0.3, 0, 0);
    stickGroup.add(knot);
  }
  
  return stickGroup;
}

// Initialize the dog
function initDog() {
  dog = createDog();
  dog.position.set(20, 0, 15);
  dog.rotation.y = Math.random() * Math.PI * 2;
  scene.add(dog);
  
  // Create the stick the dog carries
  dogStick = createStick();
  dogStick.position.set(1.0, 0.72, 0);
  dogStick.rotation.y = 0.3;
  dog.add(dogStick);
  
  // Add name tag above dog
  addNameToDog(dog, '🐕 Buddy');
}

// Add name tag to dog
function addNameToDog(dogObj, name) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  canvas.width = 256;
  canvas.height = 64;
  
  context.fillStyle = 'rgba(139, 90, 43, 0.9)';
  context.roundRect(0, 0, 256, 64, 10);
  context.fill();
  
  context.font = 'bold 32px Arial';
  context.fillStyle = 'white';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(name, 128, 32);
  
  const texture = new THREE.CanvasTexture(canvas);
  const spriteMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const nameTag = new THREE.Sprite(spriteMaterial);
  nameTag.scale.set(2, 0.5, 1);
  nameTag.position.y = 1.8;
  dogObj.add(nameTag);
  dogObj.userData.nameSprite = nameTag;
}

// Play bark sound using Web Audio API
function playBark() {
  if (!barkAudioContext) {
    barkAudioContext = new (window.AudioContext || window.webkitAudioContext)();
  }
  
  const now = barkAudioContext.currentTime;
  
  // Create oscillators for bark sound
  const osc1 = barkAudioContext.createOscillator();
  const osc2 = barkAudioContext.createOscillator();
  const gainNode = barkAudioContext.createGain();
  
  osc1.type = 'sawtooth';
  osc2.type = 'square';
  
  // Bark frequency pattern
  osc1.frequency.setValueAtTime(200, now);
  osc1.frequency.exponentialRampToValueAtTime(150, now + 0.1);
  osc1.frequency.exponentialRampToValueAtTime(100, now + 0.15);
  
  osc2.frequency.setValueAtTime(250, now);
  osc2.frequency.exponentialRampToValueAtTime(180, now + 0.1);
  
  // Volume envelope
  gainNode.gain.setValueAtTime(0.3, now);
  gainNode.gain.exponentialRampToValueAtTime(0.1, now + 0.08);
  gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
  
  osc1.connect(gainNode);
  osc2.connect(gainNode);
  gainNode.connect(barkAudioContext.destination);
  
  osc1.start(now);
  osc2.start(now);
  osc1.stop(now + 0.15);
  osc2.stop(now + 0.15);
}

// Animate dog tail wagging
function animateDogTail() {
  if (!dog) return;
  const tail = dog.getObjectByName('tail');
  if (tail) {
    const wagSpeed = isPlayingWithDog ? 15 : 8;
    tail.rotation.y = Math.sin(Date.now() / 100 * (wagSpeed / 8)) * 0.5;
  }
  
  // Tongue animation (panting)
  const tongue = dog.getObjectByName('tongue');
  if (tongue) {
    tongue.scale.y = 1 + Math.sin(Date.now() / 150) * 0.2;
  }
}

// Check if player is near the dog
function checkDogProximity() {
  if (!dog || !playerGroup || !gameStarted) return;
  
  const distance = playerGroup.position.distanceTo(dog.position);
  const promptEl = document.getElementById('dog-play-prompt');
  
  // Proximity detection (within 5 units)
  if (distance < 5 && !isPlayingWithDog && dogState === 'wandering') {
    if (!dogProximityShown) {
      dogProximityShown = true;
      if (promptEl) promptEl.style.display = 'block';
      
      // Dog barks excitedly
      playBark();
      setTimeout(playBark, 300);
    }
  } else if (distance >= 6 && dogProximityShown && !isPlayingWithDog) {
    dogProximityShown = false;
    if (promptEl) promptEl.style.display = 'none';
  }
  
  // Random barking while wandering
  const now = Date.now();
  if (dogState === 'wandering' && now - lastBarkTime > 8000 + Math.random() * 10000) {
    lastBarkTime = now;
    playBark();
  }
}

// Start playing with dog
function startPlayingWithDog() {
  isPlayingWithDog = true;
  dogState = 'waiting';
  dogProximityShown = false;
  
  // Hide prompt, show controls
  const promptEl = document.getElementById('dog-play-prompt');
  const tabEl = document.getElementById('dog-tab-container');
  const throwBtn = document.getElementById('throw-stick-btn');
  
  if (promptEl) promptEl.style.display = 'none';
  if (tabEl) tabEl.style.display = 'flex';
  if (throwBtn) throwBtn.style.display = 'block';
  
  // Make dog look at player and bark happily
  dog.lookAt(playerGroup.position);
  playBark();
  setTimeout(playBark, 200);
  setTimeout(playBark, 450);
  
  showNotification('🐕 Buddy is ready to play fetch! 🦴');
}

// Stop playing with dog
function stopPlayingWithDog() {
  isPlayingWithDog = false;
  dogState = 'wandering';
  
  const tabEl = document.getElementById('dog-tab-container');
  const throwBtn = document.getElementById('throw-stick-btn');
  
  if (tabEl) tabEl.style.display = 'none';
  if (throwBtn) throwBtn.style.display = 'none';
  
  // Return stick to dog's mouth if thrown
  if (thrownStick) {
    scene.remove(thrownStick);
    thrownStick = null;
  }
  if (!dogStick.parent) {
    dogStick.position.set(1.0, 0.72, 0);
    dogStick.rotation.set(0, 0.3, 0);
    dog.add(dogStick);
  }
  
  showNotification('🐕 Thanks for playing with Buddy!');
}

// Throw the stick
function throwStick() {
  if (!isPlayingWithDog || dogState !== 'waiting') return;
  
  // Remove stick from dog's mouth
  if (dogStick.parent === dog) {
    dog.remove(dogStick);
  }
  
  // Create thrown stick in world space
  thrownStick = createStick();
  
  // Calculate throw direction - snowman faces forward based on yaw
  // The snowman's front is where -sin(yaw), -cos(yaw) points
  const throwDirection = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
  
  // Starting position in front of the player (arm level)
  thrownStick.position.copy(playerGroup.position);
  thrownStick.position.x += throwDirection.x * 1.5; // Start 1.5 units in front
  thrownStick.position.z += throwDirection.z * 1.5;
  thrownStick.position.y = 2.5; // Arm height
  
  // Target position (where stick lands)
  const throwDistance = 15 + Math.random() * 10;
  dogTargetPosition.copy(playerGroup.position);
  dogTargetPosition.add(throwDirection.multiplyScalar(throwDistance));
  dogTargetPosition.y = 0.3;
  
  // Keep within bounds
  dogTargetPosition.x = Math.max(-140, Math.min(140, dogTargetPosition.x));
  dogTargetPosition.z = Math.max(-140, Math.min(140, dogTargetPosition.z));
  
  scene.add(thrownStick);
  
  // Animate stick throw
  dogState = 'chasing';
  animateStickThrow();
  
  playBark();
  
  // Hide throw button while chasing
  const throwBtn = document.getElementById('throw-stick-btn');
  if (throwBtn) throwBtn.style.display = 'none';
}

// Animate stick being thrown
function animateStickThrow() {
  if (!thrownStick) return;
  
  const startPos = thrownStick.position.clone();
  const endPos = dogTargetPosition.clone();
  const startTime = Date.now();
  const duration = 800;
  
  function animateThrow() {
    const elapsed = Date.now() - startTime;
    const t = Math.min(elapsed / duration, 1);
    
    // Parabolic arc
    thrownStick.position.lerpVectors(startPos, endPos, t);
    thrownStick.position.y = startPos.y + Math.sin(t * Math.PI) * 5 - t * (startPos.y - 0.3);
    
    // Spin the stick
    thrownStick.rotation.x += 0.3;
    thrownStick.rotation.z += 0.1;
    
    if (t < 1) {
      requestAnimationFrame(animateThrow);
    } else {
      thrownStick.position.copy(endPos);
      thrownStick.rotation.set(0, Math.random() * Math.PI, Math.PI / 2);
    }
  }
  animateThrow();
}

// Animate dog behavior
function animateDog() {
  if (!dog || !gameStarted) return;
  
  animateDogTail();
  
  const speed = 0.08;
  
  switch(dogState) {
    case 'wandering':
      // Wander randomly
      dogWanderAngle += (Math.random() - 0.5) * 0.05;
      dog.position.x += Math.cos(dogWanderAngle) * speed * 0.3;
      dog.position.z += Math.sin(dogWanderAngle) * speed * 0.3;
      
      // Keep in bounds
      if (Math.abs(dog.position.x) > 130) dogWanderAngle = Math.PI - dogWanderAngle;
      if (Math.abs(dog.position.z) > 130) dogWanderAngle = -dogWanderAngle;
      
      // Face movement direction
      dog.rotation.y = -dogWanderAngle + Math.PI / 2;
      break;
      
    case 'waiting':
      // Look at player, stay nearby
      dog.lookAt(playerGroup.position.x, dog.position.y, playerGroup.position.z);
      dog.rotation.y += Math.PI; // Dog faces forward
      break;
      
    case 'chasing':
      // Chase after the stick
      if (thrownStick) {
        const toStick = new THREE.Vector3().subVectors(dogTargetPosition, dog.position);
        const distToStick = toStick.length();
        
        if (distToStick > 0.5) {
          toStick.normalize();
          dog.position.add(toStick.multiplyScalar(speed * 2));
          dog.lookAt(dogTargetPosition.x, dog.position.y, dogTargetPosition.z);
          dog.rotation.y += Math.PI;
          
          // Bark while chasing
          if (Math.random() < 0.02) playBark();
        } else {
          // Reached the stick, pick it up
          scene.remove(thrownStick);
          thrownStick = null;
          
          // Add stick back to dog's mouth
          dogStick.position.set(1.0, 0.72, 0);
          dogStick.rotation.set(0, 0.3, 0);
          dog.add(dogStick);
          
          dogState = 'returning';
          playBark();
          playBark();
        }
      }
      break;
      
    case 'returning':
      // Return to player
      const toPlayer = new THREE.Vector3().subVectors(playerGroup.position, dog.position);
      const distToPlayer = toPlayer.length();
      
      if (distToPlayer > 2) {
        toPlayer.normalize();
        dog.position.add(toPlayer.multiplyScalar(speed * 1.5));
        dog.lookAt(playerGroup.position.x, dog.position.y, playerGroup.position.z);
        dog.rotation.y += Math.PI;
      } else {
        // Back to player!
        dogState = 'waiting';
        playBark();
        setTimeout(playBark, 200);
        
        // Show throw button again
        const throwBtn = document.getElementById('throw-stick-btn');
        if (throwBtn && isPlayingWithDog) throwBtn.style.display = 'block';
        
        showNotification('🐕 Good boy! Buddy brought the stick back!');
      }
      break;
  }
  
  // Make name tag face camera
  if (dog.userData.nameSprite) {
    dog.userData.nameSprite.lookAt(camera.position);
  }
}

// Initialize dog when game loads
initDog();

// Event listeners for dog UI
document.getElementById('dog-play-yes')?.addEventListener('click', startPlayingWithDog);
document.getElementById('dog-play-no')?.addEventListener('click', () => {
  const promptEl = document.getElementById('dog-play-prompt');
  if (promptEl) promptEl.style.display = 'none';
  dogProximityShown = false;
});
document.getElementById('dog-tab')?.addEventListener('click', stopPlayingWithDog);
document.getElementById('throw-stick-btn')?.addEventListener('click', throwStick);

// ============ VIDEO SCREEN (THREE.JS VIDEO TEXTURE) ============

// Create video element
const video = document.getElementById('game-video');
const youtubeLink = document.getElementById('youtube-link');
const youtubeContainer = document.getElementById('youtube-container');
const youtubeFrame = document.getElementById('youtube-frame');

// Video texture setup
let videoTexture = null;
let videoMaterial = null;
let tvScreen = null;
let tvGroup = null;

function setupVideoScreen() {
  // Create a colored screen material (YouTube will be overlaid via CSS)
  const screenMaterial = new THREE.MeshBasicMaterial({
    color: 0x111122
  });
  
  // TV Group
  tvGroup = new THREE.Group();
  
  // TV Stand
  const standMaterial = new THREE.MeshStandardMaterial({ color: 0x222222 });
  const standBase = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.8, 0.4, 16), standMaterial);
  standBase.position.y = 0.2;
  standBase.castShadow = true;
  tvGroup.add(standBase);
  
  const standPole = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 2.5, 8), standMaterial);
  standPole.position.y = 1.45;
  standPole.castShadow = true;
  tvGroup.add(standPole);
  
  // TV Frame
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.5, roughness: 0.5 });
  const tvFrame = new THREE.Mesh(new THREE.BoxGeometry(8, 4.8, 0.4), frameMaterial);
  tvFrame.position.y = 4.5;
  tvFrame.castShadow = true;
  tvGroup.add(tvFrame);
  
  // TV Screen placeholder
  tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(7.5, 4.2), screenMaterial);
  tvScreen.position.set(0, 4.5, 0.21);
  tvGroup.add(tvScreen);
  
  // Screen glow
  const glowLight = new THREE.PointLight(0x4488ff, 1, 15);
  glowLight.position.set(0, 4.5, 2);
  tvGroup.add(glowLight);
  
  // Christmas lights around TV
  const lightColors = [0xff0000, 0x00ff00, 0xffff00, 0x0000ff, 0xff00ff];
  for (let i = 0; i < 20; i++) {
    const t = i / 20;
    const bulbMat = new THREE.MeshStandardMaterial({
      color: lightColors[i % lightColors.length],
      emissive: lightColors[i % lightColors.length],
      emissiveIntensity: 0.8
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), bulbMat);
    
    // Position around frame
    let bx, by;
    if (t < 0.25) {
      bx = -4 + (t * 4) * 32;
      by = 6.9;
    } else if (t < 0.5) {
      bx = 4;
      by = 6.9 - ((t - 0.25) * 4) * 9.6;
    } else if (t < 0.75) {
      bx = 4 - ((t - 0.5) * 4) * 32;
      by = 2.1;
    } else {
      bx = -4;
      by = 2.1 + ((t - 0.75) * 4) * 9.6;
    }
    bulb.position.set(bx, by, 0.3);
    tvGroup.add(bulb);
  }
  
  tvGroup.position.set(-8, 0, -8);
  tvGroup.rotation.y = Math.PI / 4;
  scene.add(tvGroup);
  
  return tvGroup;
}

const tvGroupObject = setupVideoScreen();

// Function to update YouTube iframe position to overlay on TV
function updateYouTubePosition() {
  if (!musicPlaying || !tvScreen) {
    youtubeContainer.style.display = 'none';
    return;
  }
  
  // Get TV screen world position
  const tvWorldPos = new THREE.Vector3();
  tvScreen.getWorldPosition(tvWorldPos);
  
  // Check distance - only show when close enough
  const distance = camera.position.distanceTo(tvWorldPos);
  if (distance > 25) {
    youtubeContainer.style.display = 'none';
    return;
  }
  
  // Get screen corners in world space
  const tvWorldQuat = new THREE.Quaternion();
  tvScreen.getWorldQuaternion(tvWorldQuat);
  
  const halfWidth = 7.5 / 2;
  const halfHeight = 4.2 / 2;
  
  const corners = [
    new THREE.Vector3(-halfWidth, halfHeight, 0.01),
    new THREE.Vector3(halfWidth, halfHeight, 0.01),
    new THREE.Vector3(-halfWidth, -halfHeight, 0.01),
    new THREE.Vector3(halfWidth, -halfHeight, 0.01)
  ];
  
  corners.forEach(corner => {
    corner.applyQuaternion(tvWorldQuat);
    corner.add(tvWorldPos);
  });
  
  // Project to screen space
  const screenCorners = corners.map(corner => {
    const projected = corner.clone().project(camera);
    return {
      x: (projected.x * 0.5 + 0.5) * window.innerWidth,
      y: (-projected.y * 0.5 + 0.5) * window.innerHeight,
      z: projected.z
    };
  });
  
  // Check if TV is behind camera
  const isBehindCamera = screenCorners.some(c => c.z > 1);
  if (isBehindCamera) {
    youtubeContainer.style.display = 'none';
    return;
  }
  
  youtubeContainer.style.display = 'block';
  
  // Calculate bounding box
  const minX = Math.min(...screenCorners.map(c => c.x));
  const maxX = Math.max(...screenCorners.map(c => c.x));
  const minY = Math.min(...screenCorners.map(c => c.y));
  const maxY = Math.max(...screenCorners.map(c => c.y));
  
  const width = maxX - minX;
  const height = maxY - minY;
  
  // Only show if reasonable size
  if (width < 50 || height < 30 || width > window.innerWidth || height > window.innerHeight) {
    youtubeContainer.style.display = 'none';
    return;
  }
  
  youtubeContainer.style.left = minX + 'px';
  youtubeContainer.style.top = minY + 'px';
  youtubeContainer.style.width = width + 'px';
  youtubeContainer.style.height = height + 'px';
  
  youtubeFrame.style.width = '100%';
  youtubeFrame.style.height = '100%';
  
  // Fade based on distance
  const opacity = Math.max(0.3, Math.min(1, 1 - (distance - 5) / 20));
  youtubeContainer.style.opacity = opacity;
}

// ============ CHRISTMAS CABIN ============

function createCabin(x, z) {
  const cabin = new THREE.Group();
  
  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0x8B4513 });
  const walls = new THREE.Mesh(new THREE.BoxGeometry(8, 4, 6), wallMaterial);
  walls.position.y = 2;
  walls.castShadow = true;
  walls.receiveShadow = true;
  cabin.add(walls);
  
  const roofGeometry = new THREE.ConeGeometry(6, 3, 4);
  const roofMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
  const roof = new THREE.Mesh(roofGeometry, roofMaterial);
  roof.position.y = 5.5;
  roof.rotation.y = Math.PI / 4;
  roof.castShadow = true;
  cabin.add(roof);
  
  const doorMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3000 });
  const door = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.5, 0.2), doorMaterial);
  door.position.set(0, 1.25, 3.1);
  cabin.add(door);
  
  const windowMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xffaa00, 
    emissive: 0xff6600,
    emissiveIntensity: 0.5
  });
  const window1 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.2), windowMaterial);
  window1.position.set(-2, 2.5, 3.1);
  cabin.add(window1);
  
  const window2 = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 0.2), windowMaterial);
  window2.position.set(2, 2.5, 3.1);
  cabin.add(window2);
  
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 1), wallMaterial);
  chimney.position.set(2, 6, -1);
  cabin.add(chimney);
  
  const cabinLight = new THREE.PointLight(0xff6600, 1, 15);
  cabinLight.position.set(0, 2, 4);
  cabin.add(cabinLight);
  
  cabin.position.set(x, 0, z);
  return cabin;
}

scene.add(createCabin(-45, -60));
scene.add(createCabin(75, 45));
scene.add(createCabin(-80, 30));
scene.add(createCabin(60, -70));
scene.add(createCabin(0, 90));

// ============ CHRISTMAS TREES ============

function createChristmasTree(x, z, scale = 1) {
  const tree = new THREE.Group();
  
  const trunkGeometry = new THREE.CylinderGeometry(0.3 * scale, 0.4 * scale, 1.5 * scale, 8);
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3000 });
  const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
  trunk.position.y = 0.75 * scale;
  trunk.castShadow = true;
  tree.add(trunk);
  
  const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x0d5c0d });
  const snowMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff });
  
  const layers = [
    { y: 2, radius: 2, height: 2 },
    { y: 3.5, radius: 1.5, height: 1.8 },
    { y: 4.8, radius: 1, height: 1.5 },
    { y: 5.8, radius: 0.5, height: 1 }
  ];
  
  layers.forEach((layer) => {
    const coneGeometry = new THREE.ConeGeometry(layer.radius * scale, layer.height * scale, 8);
    const cone = new THREE.Mesh(coneGeometry, treeMaterial);
    cone.position.y = layer.y * scale;
    cone.castShadow = true;
    tree.add(cone);
    
    const snowCone = new THREE.Mesh(
      new THREE.ConeGeometry(layer.radius * scale * 0.7, layer.height * scale * 0.3, 8),
      snowMaterial
    );
    snowCone.position.y = (layer.y + layer.height * 0.4) * scale;
    tree.add(snowCone);
  });
  
  const starGeometry = new THREE.OctahedronGeometry(0.3 * scale);
  const starMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xffff00, 
    emissive: 0xffaa00,
    emissiveIntensity: 0.8
  });
  const star = new THREE.Mesh(starGeometry, starMaterial);
  star.position.y = 6.5 * scale;
  tree.add(star);
  
  const ornamentColors = [0xff0000, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff];
  for (let i = 0; i < 15; i++) {
    const ornamentGeometry = new THREE.SphereGeometry(0.1 * scale, 8, 8);
    const ornamentMaterial = new THREE.MeshStandardMaterial({ 
      color: ornamentColors[i % ornamentColors.length],
      emissive: ornamentColors[i % ornamentColors.length],
      emissiveIntensity: 0.3
    });
    const ornament = new THREE.Mesh(ornamentGeometry, ornamentMaterial);
    const angle = (i / 15) * Math.PI * 6;
    const height = 2 + (i / 15) * 4;
    const radius = 1.5 - (i / 15) * 1;
    ornament.position.set(
      Math.cos(angle) * radius * scale,
      height * scale,
      Math.sin(angle) * radius * scale
    );
    tree.add(ornament);
  }
  
  tree.position.set(x, 0, z);
  return tree;
}

const treePositions = [
  // Original positions scaled 3x
  { x: 15, z: -24, scale: 1.2 },
  { x: -24, z: 15, scale: 1 },
  { x: 36, z: -15, scale: 0.8 },
  { x: -36, z: -30, scale: 1.5 },
  { x: 24, z: 45, scale: 1.1 },
  { x: -60, z: 24, scale: 1.3 },
  { x: 45, z: 60, scale: 0.9 },
  { x: -15, z: -60, scale: 1.4 },
  { x: 75, z: -45, scale: 1 },
  { x: -75, z: -15, scale: 1.2 },
  { x: 0, z: 75, scale: 1.1 },
  { x: -54, z: 60, scale: 0.8 },
  // Additional trees for bigger area
  { x: 90, z: 30, scale: 1.3 },
  { x: -90, z: -50, scale: 1.1 },
  { x: 50, z: -90, scale: 1.4 },
  { x: -40, z: 80, scale: 1.0 },
  { x: 100, z: -20, scale: 1.2 },
  { x: -100, z: 40, scale: 0.9 },
  { x: 70, z: 80, scale: 1.5 },
  { x: -80, z: -80, scale: 1.1 },
  { x: 30, z: -100, scale: 1.3 },
  { x: -20, z: 100, scale: 1.0 },
  { x: 110, z: 60, scale: 0.8 },
  { x: -110, z: -20, scale: 1.2 }
];

treePositions.forEach(pos => {
  scene.add(createChristmasTree(pos.x, pos.z, pos.scale));
});

// ============ GIFT BOXES ============

function createGiftBox(x, z, color1, color2) {
  const gift = new THREE.Group();
  
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const boxMaterial = new THREE.MeshStandardMaterial({ color: color1 });
  const box = new THREE.Mesh(boxGeometry, boxMaterial);
  box.position.y = 0.5;
  box.castShadow = true;
  gift.add(box);
  
  const ribbonMaterial = new THREE.MeshStandardMaterial({ color: color2 });
  const ribbon1 = new THREE.Mesh(new THREE.BoxGeometry(1.05, 0.15, 0.15), ribbonMaterial);
  ribbon1.position.y = 0.5;
  gift.add(ribbon1);
  
  const ribbon2 = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 1.05), ribbonMaterial);
  ribbon2.position.y = 0.5;
  gift.add(ribbon2);
  
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 8, 16), ribbonMaterial);
  bow.position.y = 1.1;
  bow.rotation.x = Math.PI / 2;
  gift.add(bow);
  
  gift.position.set(x, 0, z);
  gift.rotation.y = Math.random() * Math.PI;
  return gift;
}

const giftConfigs = [
  { x: 6, z: 6, c1: 0xff0000, c2: 0xffff00 },
  { x: 9, z: 4.5, c1: 0x00ff00, c2: 0xff0000 },
  { x: 7.5, z: 9, c1: 0x0000ff, c2: 0xffffff },
  { x: -42, z: -51, c1: 0xff00ff, c2: 0x00ffff },
  { x: -40.5, z: -48, c1: 0xffff00, c2: 0xff0000 },
  { x: 78, z: 54, c1: 0x00ff00, c2: 0xffffff },
  { x: 75, z: 51, c1: 0xff0000, c2: 0x00ff00 },
  // Additional gifts
  { x: -70, z: 40, c1: 0xff6600, c2: 0x00ff00 },
  { x: 50, z: -80, c1: 0x9900ff, c2: 0xffff00 },
  { x: -30, z: 90, c1: 0x00ffff, c2: 0xff0000 },
  { x: 90, z: -30, c1: 0xff00ff, c2: 0x00ff00 },
  { x: -100, z: -60, c1: 0xffff00, c2: 0x0000ff }
];

giftConfigs.forEach(g => {
  scene.add(createGiftBox(g.x, g.z, g.c1, g.c2));
});

// ============ WOODEN SIGN WITH SNOW ============

function createWoodenSign(x, z, rotation = 0) {
  const sign = new THREE.Group();
  
  // Wooden log posts
  const logMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x4a3000,
    roughness: 0.9
  });
  
  // Left post
  const leftPost = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 4, 8), logMaterial);
  leftPost.position.set(-2.5, 2, 0);
  leftPost.castShadow = true;
  sign.add(leftPost);
  
  // Right post
  const rightPost = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.18, 4, 8), logMaterial);
  rightPost.position.set(2.5, 2, 0);
  rightPost.castShadow = true;
  sign.add(rightPost);
  
  // Main sign board (wooden planks look)
  const boardMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x8B4513,
    roughness: 0.8
  });
  
  const signBoard = new THREE.Mesh(new THREE.BoxGeometry(5.5, 2.2, 0.25), boardMaterial);
  signBoard.position.set(0, 3.2, 0);
  signBoard.castShadow = true;
  sign.add(signBoard);
  
  // Decorative frame around board
  const frameMaterial = new THREE.MeshStandardMaterial({ color: 0x3d2817 });
  
  // Top frame
  const topFrame = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.15, 0.3), frameMaterial);
  topFrame.position.set(0, 4.35, 0);
  sign.add(topFrame);
  
  // Bottom frame
  const bottomFrame = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.15, 0.3), frameMaterial);
  bottomFrame.position.set(0, 2.05, 0);
  sign.add(bottomFrame);
  
  // Left frame
  const leftFrame = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.5, 0.3), frameMaterial);
  leftFrame.position.set(-2.9, 3.2, 0);
  sign.add(leftFrame);
  
  // Right frame
  const rightFrame = new THREE.Mesh(new THREE.BoxGeometry(0.15, 2.5, 0.3), frameMaterial);
  rightFrame.position.set(2.9, 3.2, 0);
  sign.add(rightFrame);
  
  // Snow on top of sign
  const snowMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xffffff,
    roughness: 0.9
  });
  
  // Snow pile on top
  const snowTop = new THREE.Mesh(new THREE.BoxGeometry(5.8, 0.3, 0.5), snowMaterial);
  snowTop.position.set(0, 4.55, 0.1);
  sign.add(snowTop);
  
  // Snow bumps on top
  for (let i = 0; i < 5; i++) {
    const snowBump = new THREE.Mesh(new THREE.SphereGeometry(0.25 + Math.random() * 0.15, 8, 8), snowMaterial);
    snowBump.position.set(-2 + i * 1, 4.7, 0.1);
    snowBump.scale.y = 0.5;
    sign.add(snowBump);
  }
  
  // Snow on posts
  const snowPostLeft = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.3, 8), snowMaterial);
  snowPostLeft.position.set(-2.5, 4.15, 0);
  sign.add(snowPostLeft);
  
  const snowPostRight = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 0.3, 8), snowMaterial);
  snowPostRight.position.set(2.5, 4.15, 0);
  sign.add(snowPostRight);
  
  // Create text using canvas texture
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 400;
  const ctx = canvas.getContext('2d');
  
  // Transparent background
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Text styling
  ctx.fillStyle = '#FFD700'; // Gold color
  ctx.strokeStyle = '#8B0000'; // Dark red outline
  ctx.lineWidth = 4;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  // First line - Name
  ctx.font = 'bold 72px "Comic Sans MS", cursive, sans-serif';
  ctx.strokeText('Marrello Allen Rompf', canvas.width / 2, 120);
  ctx.fillText('Marrello Allen Rompf', canvas.width / 2, 120);
  
  // Second line - Message
  ctx.font = 'bold 56px "Comic Sans MS", cursive, sans-serif';
  ctx.fillStyle = '#FFFFFF'; // White
  ctx.strokeStyle = '#006400'; // Dark green outline
  ctx.strokeText('Merry Christmas', canvas.width / 2, 220);
  ctx.fillText('Merry Christmas', canvas.width / 2, 220);
  
  // Third line - Fun part
  ctx.font = 'bold 48px "Comic Sans MS", cursive, sans-serif';
  ctx.fillStyle = '#FF69B4'; // Hot pink
  ctx.strokeStyle = '#4B0082'; // Indigo outline
  ctx.strokeText('you little Beaches! 🏖️', canvas.width / 2, 320);
  ctx.fillText('you little Beaches! 🏖️', canvas.width / 2, 320);
  
  // Create texture from canvas
  const textTexture = new THREE.CanvasTexture(canvas);
  textTexture.needsUpdate = true;
  
  // Text plane on sign
  const textMaterial = new THREE.MeshBasicMaterial({ 
    map: textTexture,
    transparent: true,
    side: THREE.DoubleSide
  });
  
  const textPlane = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 2), textMaterial);
  textPlane.position.set(0, 3.2, 0.14);
  sign.add(textPlane);
  
  // Christmas lights around the sign
  const lightColors = [0xff0000, 0x00ff00, 0xffff00, 0x0000ff, 0xff00ff];
  for (let i = 0; i < 16; i++) {
    const t = i / 16;
    const bulbMat = new THREE.MeshStandardMaterial({
      color: lightColors[i % lightColors.length],
      emissive: lightColors[i % lightColors.length],
      emissiveIntensity: 0.8
    });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), bulbMat);
    
    // Position around frame
    let bx, by;
    if (t < 0.25) {
      bx = -2.9 + t * 4 * 5.8;
      by = 4.35;
    } else if (t < 0.5) {
      bx = 2.9;
      by = 4.35 - (t - 0.25) * 4 * 2.3;
    } else if (t < 0.75) {
      bx = 2.9 - (t - 0.5) * 4 * 5.8;
      by = 2.05;
    } else {
      bx = -2.9;
      by = 2.05 + (t - 0.75) * 4 * 2.3;
    }
    bulb.position.set(bx, by, 0.2);
    sign.add(bulb);
  }
  
  // Add a warm glow
  const signLight = new THREE.PointLight(0xffaa44, 1, 15);
  signLight.position.set(0, 3.5, 2);
  sign.add(signLight);
  
  sign.position.set(x, 0, z);
  sign.rotation.y = rotation;
  return sign;
}

// Add the sign near spawn area
const mainSign = createWoodenSign(0, -15, 0);
scene.add(mainSign);

// ============ CAMPFIRE ============

function createCampfire(x, z) {
  const campfire = new THREE.Group();
  
  const logMaterial = new THREE.MeshStandardMaterial({ color: 0x3d2817 });
  for (let i = 0; i < 5; i++) {
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 1.5, 8), logMaterial);
    log.position.y = 0.15;
    log.rotation.z = Math.PI / 2;
    log.rotation.y = (i / 5) * Math.PI;
    campfire.add(log);
  }
  
  const fireMaterial = new THREE.MeshStandardMaterial({ 
    color: 0xff4500, 
    emissive: 0xff2200,
    emissiveIntensity: 1,
    transparent: true,
    opacity: 0.9
  });
  
  for (let i = 0; i < 3; i++) {
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1 + Math.random() * 0.5, 8), fireMaterial);
    flame.position.set((Math.random() - 0.5) * 0.3, 0.5, (Math.random() - 0.5) * 0.3);
    campfire.add(flame);
  }
  
  const firePointLight = new THREE.PointLight(0xff4500, 3, 20);
  firePointLight.position.y = 1;
  campfire.add(firePointLight);
  
  campfire.position.set(x, 0, z);
  return campfire;
}

scene.add(createCampfire(0, 0));
scene.add(createCampfire(30, -30));
scene.add(createCampfire(-50, 50));
scene.add(createCampfire(70, 40));
scene.add(createCampfire(-80, -40));

// ============ GIANT CHRISTMAS TREE ============

function createGiantChristmasTree(x, z) {
  const treeGroup = new THREE.Group();
  
  // Tree trunk
  const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x4a3728 });
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.5, 4, 12), trunkMaterial);
  trunk.position.y = 2;
  trunk.castShadow = true;
  treeGroup.add(trunk);
  
  // Tree layers (giant conical sections)
  const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x0d5c0d });
  const layerHeights = [8, 6, 4.5, 3];
  const layerRadii = [6, 4.5, 3, 1.8];
  let currentY = 4;
  
  for (let i = 0; i < layerHeights.length; i++) {
    const layer = new THREE.Mesh(
      new THREE.ConeGeometry(layerRadii[i], layerHeights[i], 16),
      treeMaterial
    );
    layer.position.y = currentY + layerHeights[i] / 2;
    layer.castShadow = true;
    treeGroup.add(layer);
    currentY += layerHeights[i] * 0.6;
  }
  
  // Star on top
  const starMaterial = new THREE.MeshStandardMaterial({
    color: 0xffd700,
    emissive: 0xffd700,
    emissiveIntensity: 1.5
  });
  const starGeometry = new THREE.OctahedronGeometry(1.2, 0);
  const star = new THREE.Mesh(starGeometry, starMaterial);
  star.position.y = currentY + 1.5;
  star.rotation.y = Math.PI / 4;
  treeGroup.add(star);
  
  // Star glow light
  const starLight = new THREE.PointLight(0xffd700, 3, 25);
  starLight.position.y = currentY + 1.5;
  treeGroup.add(starLight);
  
  // Christmas ornaments (baubles) on the tree
  const ornamentColors = [0xff0000, 0x0000ff, 0xffd700, 0xff00ff, 0x00ffff, 0xff6600];
  for (let i = 0; i < 60; i++) {
    const angle = Math.random() * Math.PI * 2;
    const heightRatio = Math.random();
    const y = 5 + heightRatio * 15;
    const radius = (1 - heightRatio * 0.7) * 5;
    
    const ornamentMat = new THREE.MeshStandardMaterial({
      color: ornamentColors[i % ornamentColors.length],
      emissive: ornamentColors[i % ornamentColors.length],
      emissiveIntensity: 0.3,
      metalness: 0.8,
      roughness: 0.2
    });
    const ornament = new THREE.Mesh(new THREE.SphereGeometry(0.25 + Math.random() * 0.15, 12, 12), ornamentMat);
    ornament.position.set(
      Math.cos(angle) * radius,
      y,
      Math.sin(angle) * radius
    );
    treeGroup.add(ornament);
  }
  
  // String lights wrapping around tree
  const lightColors = [0xff0000, 0x00ff00, 0xffff00, 0x0000ff, 0xff00ff];
  for (let i = 0; i < 100; i++) {
    const t = i / 100;
    const angle = t * Math.PI * 12; // Spiral around
    const y = 5 + t * 16;
    const radius = (1 - t * 0.6) * 5.5;
    
    const lightMat = new THREE.MeshStandardMaterial({
      color: lightColors[i % lightColors.length],
      emissive: lightColors[i % lightColors.length],
      emissiveIntensity: 1
    });
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), lightMat);
    light.position.set(
      Math.cos(angle) * radius,
      y,
      Math.sin(angle) * radius
    );
    treeGroup.add(light);
  }
  
  // Tinsel/garland effect (thin cylinders spiraling)
  const tinselMaterial = new THREE.MeshStandardMaterial({
    color: 0xc0c0c0,
    metalness: 0.9,
    roughness: 0.3
  });
  for (let spiral = 0; spiral < 3; spiral++) {
    const offset = (spiral / 3) * Math.PI * 2;
    for (let i = 0; i < 50; i++) {
      const t = i / 50;
      const angle = offset + t * Math.PI * 8;
      const y = 5 + t * 15;
      const radius = (1 - t * 0.65) * 5.2;
      
      const tinsel = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), tinselMaterial);
      tinsel.position.set(
        Math.cos(angle) * radius,
        y,
        Math.sin(angle) * radius
      );
      treeGroup.add(tinsel);
    }
  }
  
  treeGroup.position.set(x, 0, z);
  return treeGroup;
}

// Create presents under the tree
function createPresents(x, z) {
  const presentsGroup = new THREE.Group();
  
  const wrapColors = [
    { wrap: 0xff0000, ribbon: 0xffd700 },  // Red with gold
    { wrap: 0x0066ff, ribbon: 0xc0c0c0 },  // Blue with silver
    { wrap: 0x00aa00, ribbon: 0xff0000 },  // Green with red
    { wrap: 0xff00ff, ribbon: 0x00ffff },  // Magenta with cyan
    { wrap: 0xffd700, ribbon: 0xff0000 },  // Gold with red
    { wrap: 0x8800ff, ribbon: 0xffd700 },  // Purple with gold
    { wrap: 0x00ffff, ribbon: 0xff6600 },  // Cyan with orange
    { wrap: 0xff6600, ribbon: 0x00ff00 },  // Orange with green
  ];
  
  // Create multiple presents in a circle around tree base
  const presentCount = 15;
  for (let i = 0; i < presentCount; i++) {
    const angle = (i / presentCount) * Math.PI * 2 + Math.random() * 0.3;
    const dist = 7 + Math.random() * 3;
    
    const colors = wrapColors[i % wrapColors.length];
    const width = 0.8 + Math.random() * 1.2;
    const height = 0.6 + Math.random() * 1;
    const depth = 0.8 + Math.random() * 1.2;
    
    // Present box
    const boxMaterial = new THREE.MeshStandardMaterial({ color: colors.wrap });
    const box = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), boxMaterial);
    box.position.set(
      Math.cos(angle) * dist,
      height / 2,
      Math.sin(angle) * dist
    );
    box.rotation.y = Math.random() * Math.PI;
    box.castShadow = true;
    presentsGroup.add(box);
    
    // Ribbon horizontal
    const ribbonMat = new THREE.MeshStandardMaterial({ color: colors.ribbon, metalness: 0.5 });
    const ribbonH = new THREE.Mesh(new THREE.BoxGeometry(width + 0.02, 0.12, depth * 0.15), ribbonMat);
    ribbonH.position.copy(box.position);
    ribbonH.position.y = height / 2 + 0.01;
    ribbonH.rotation.y = box.rotation.y;
    presentsGroup.add(ribbonH);
    
    // Ribbon vertical
    const ribbonV = new THREE.Mesh(new THREE.BoxGeometry(width * 0.15, 0.12, depth + 0.02), ribbonMat);
    ribbonV.position.copy(box.position);
    ribbonV.position.y = height / 2 + 0.02;
    ribbonV.rotation.y = box.rotation.y;
    presentsGroup.add(ribbonV);
    
    // Bow on top
    const bowMat = new THREE.MeshStandardMaterial({ color: colors.ribbon, metalness: 0.3 });
    const bow1 = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 8, 12), bowMat);
    bow1.position.copy(box.position);
    bow1.position.y = height + 0.1;
    bow1.rotation.x = Math.PI / 2;
    bow1.rotation.z = box.rotation.y + 0.3;
    presentsGroup.add(bow1);
    
    const bow2 = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.05, 8, 12), bowMat);
    bow2.position.copy(box.position);
    bow2.position.y = height + 0.1;
    bow2.rotation.x = Math.PI / 2;
    bow2.rotation.z = box.rotation.y - 0.3;
    presentsGroup.add(bow2);
  }
  
  // Add some special larger presents
  const specialPresents = [
    { x: 0, z: 8, w: 2, h: 1.5, d: 2, wrap: 0xff0000, ribbon: 0xffd700 },
    { x: -5, z: 6, w: 1.5, h: 2, d: 1.5, wrap: 0x00aa00, ribbon: 0xff0000 },
    { x: 5, z: 7, w: 1.8, h: 1.2, d: 1.8, wrap: 0x0066ff, ribbon: 0xc0c0c0 },
  ];
  
  specialPresents.forEach(p => {
    const boxMaterial = new THREE.MeshStandardMaterial({ color: p.wrap });
    const box = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.h, p.d), boxMaterial);
    box.position.set(p.x, p.h / 2, p.z);
    box.castShadow = true;
    presentsGroup.add(box);
    
    const ribbonMat = new THREE.MeshStandardMaterial({ color: p.ribbon, metalness: 0.5 });
    const ribbonH = new THREE.Mesh(new THREE.BoxGeometry(p.w + 0.02, 0.15, p.d * 0.15), ribbonMat);
    ribbonH.position.set(p.x, p.h / 2 + 0.01, p.z);
    presentsGroup.add(ribbonH);
    
    const ribbonV = new THREE.Mesh(new THREE.BoxGeometry(p.w * 0.15, 0.15, p.d + 0.02), ribbonMat);
    ribbonV.position.set(p.x, p.h / 2 + 0.02, p.z);
    presentsGroup.add(ribbonV);
    
    // Big bow
    const bowMat = new THREE.MeshStandardMaterial({ color: p.ribbon, metalness: 0.3 });
    const bow1 = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.08, 8, 12), bowMat);
    bow1.position.set(p.x, p.h + 0.15, p.z);
    bow1.rotation.x = Math.PI / 2;
    bow1.rotation.z = 0.4;
    presentsGroup.add(bow1);
    
    const bow2 = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.08, 8, 12), bowMat);
    bow2.position.set(p.x, p.h + 0.15, p.z);
    bow2.rotation.x = Math.PI / 2;
    bow2.rotation.z = -0.4;
    presentsGroup.add(bow2);
  });
  
  presentsGroup.position.set(x, 0, z);
  return presentsGroup;
}

// Add the giant Christmas tree with presents - positioned to see video, not too close to campfire or chatbot
const giantTree = createGiantChristmasTree(15, 15);
scene.add(giantTree);
const presents = createPresents(15, 15);
scene.add(presents);

// ============ SNOW PARTICLES ============

const snowGeometry = new THREE.BufferGeometry();
const snowCount = 6000;
const snowPositionsArr = new Float32Array(snowCount * 3);

for (let i = 0; i < snowCount * 3; i += 3) {
  snowPositionsArr[i] = (Math.random() - 0.5) * 300;
  snowPositionsArr[i + 1] = Math.random() * 80;
  snowPositionsArr[i + 2] = (Math.random() - 0.5) * 300;
}

snowGeometry.setAttribute('position', new THREE.BufferAttribute(snowPositionsArr, 3));
const snowMaterial = new THREE.PointsMaterial({ 
  color: 0xffffff, 
  size: 0.2,
  transparent: true,
  opacity: 0.8
});
const snow = new THREE.Points(snowGeometry, snowMaterial);
scene.add(snow);

function animateSnow() {
  const positions = snow.geometry.attributes.position.array;
  for (let i = 0; i < positions.length; i += 3) {
    positions[i + 1] -= 0.05;
    if (positions[i + 1] < 0) {
      positions[i + 1] = 80;
    }
    positions[i] += Math.sin(Date.now() * 0.001 + i) * 0.01;
  }
  snow.geometry.attributes.position.needsUpdate = true;
}

// ============ CONTROLS ============

const keys = {};
document.addEventListener('keydown', (e) => {
  keys[e.key.toLowerCase()] = true;
  if (e.key.toLowerCase() === 'v') {
    toggleView();
  }
});
document.addEventListener('keyup', (e) => keys[e.key.toLowerCase()] = false);

let yaw = 0;
let pitch = 0;

renderer.domElement.addEventListener('click', () => {
  if (gameStarted && !isMobile()) {
    renderer.domElement.requestPointerLock();
  }
});

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === renderer.domElement) {
    yaw -= e.movementX * 0.002;
    pitch -= e.movementY * 0.002;
    pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitch));
  }
});

// ============ MOBILE CONTROLS ============

function isMobile() {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0 || window.innerWidth < 768;
}

const joystickContainer = document.getElementById('joystick-container');
const joystick = document.getElementById('joystick');
const lookArea = document.getElementById('look-area');

let joystickActive = false;
let joystickX = 0;
let joystickY = 0;
let joystickTouchId = null;

joystickContainer.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  joystickTouchId = touch.identifier;
  joystickActive = true;
  updateJoystick(touch);
});

joystickContainer.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i];
    if (touch.identifier === joystickTouchId) {
      updateJoystick(touch);
    }
  }
});

joystickContainer.addEventListener('touchend', (e) => {
  for (let i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === joystickTouchId) {
      joystickActive = false;
      joystickX = 0;
      joystickY = 0;
      joystick.style.transform = 'translate(-50%, -50%)';
      joystickTouchId = null;
    }
  }
});

function updateJoystick(touch) {
  const rect = joystickContainer.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  let dx = touch.clientX - centerX;
  let dy = touch.clientY - centerY;
  
  const maxDist = rect.width / 2 - 25;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist > maxDist) {
    dx = (dx / dist) * maxDist;
    dy = (dy / dist) * maxDist;
  }
  
  joystickX = dx / maxDist;
  joystickY = dy / maxDist;
  
  joystick.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
}

let lookTouchId = null;
let lastLookX = 0;
let lastLookY = 0;

lookArea.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const touch = e.changedTouches[0];
  lookTouchId = touch.identifier;
  lastLookX = touch.clientX;
  lastLookY = touch.clientY;
});

lookArea.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (let i = 0; i < e.changedTouches.length; i++) {
    const touch = e.changedTouches[i];
    if (touch.identifier === lookTouchId) {
      const dx = touch.clientX - lastLookX;
      const dy = touch.clientY - lastLookY;
      
      yaw -= dx * 0.005;
      pitch -= dy * 0.005;
      pitch = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, pitch));
      
      lastLookX = touch.clientX;
      lastLookY = touch.clientY;
    }
  }
});

lookArea.addEventListener('touchend', (e) => {
  for (let i = 0; i < e.changedTouches.length; i++) {
    if (e.changedTouches[i].identifier === lookTouchId) {
      lookTouchId = null;
    }
  }
});

// ============ VIEW TOGGLE ============

const viewToggleBtn = document.getElementById('viewToggle');

function toggleView() {
  isFirstPerson = !isFirstPerson;
  viewToggleBtn.textContent = isFirstPerson ? '👁️ Third Person' : '👁️ First Person';
}

viewToggleBtn.addEventListener('click', toggleView);

// ============ MUSIC / VIDEO (YouTube IFrame API with Retry) ============

const musicToggleBtn = document.getElementById('musicToggle');
let ytPlayer = null;
let ytPlayerReady = false;
let ytRetryCount = 0;
const MAX_RETRIES = 10;
let ytRetryInterval = null;

// Load YouTube IFrame API
const ytScript = document.createElement('script');
ytScript.src = 'https://www.youtube.com/iframe_api';
document.head.appendChild(ytScript);

// Called by YouTube API when ready
window.onYouTubeIframeAPIReady = function() {
  console.log('YouTube IFrame API ready');
  initYouTubePlayer();
};

function initYouTubePlayer() {
  if (ytPlayer) {
    try { ytPlayer.destroy(); } catch(e) {}
  }
  
  ytPlayer = new YT.Player('youtube-frame', {
    videoId: 'SVN7vUsBiWM',
    playerVars: {
      autoplay: 1,
      loop: 1,
      playlist: 'SVN7vUsBiWM',
      controls: 0,
      mute: 0,
      playsinline: 1,
      enablejsapi: 1,
      origin: window.location.origin
    },
    events: {
      onReady: onYTPlayerReady,
      onStateChange: onYTPlayerStateChange,
      onError: onYTPlayerError
    }
  });
}

function onYTPlayerReady(event) {
  console.log('YouTube player ready');
  ytPlayerReady = true;
  ytRetryCount = 0;
  
  if (musicPlaying) {
    tryPlayVideo();
  }
}

function onYTPlayerStateChange(event) {
  // YT.PlayerState: UNSTARTED=-1, ENDED=0, PLAYING=1, PAUSED=2, BUFFERING=3, CUED=5
  console.log('YouTube state:', event.data);
  
  if (event.data === 1) {
    // Playing - success!
    console.log('✅ Video is playing!');
    ytRetryCount = 0;
    clearRetryInterval();
    musicToggleBtn.textContent = '🔊 Video On';
    musicToggleBtn.style.background = 'rgba(50, 150, 50, 0.8)';
    youtubeLink.style.display = 'none';
  } else if (event.data === 0) {
    // Ended - restart
    if (musicPlaying && ytPlayer) {
      ytPlayer.playVideo();
    }
  } else if (event.data === -1 || event.data === 2) {
    // Unstarted or Paused - try to play
    if (musicPlaying) {
      scheduleRetry();
    }
  }
}

function onYTPlayerError(event) {
  console.log('YouTube error:', event.data);
  // Error codes: 2=invalid param, 5=HTML5 error, 100=not found, 101/150=not embeddable
  scheduleRetry();
}

function tryPlayVideo() {
  if (!ytPlayer || !ytPlayerReady) {
    console.log('Player not ready, waiting...');
    return;
  }
  
  try {
    const state = ytPlayer.getPlayerState();
    console.log('Current state:', state, '- Attempting to play...');
    
    if (state !== 1) { // Not playing
      ytPlayer.playVideo();
      ytRetryCount++;
      console.log(`Play attempt #${ytRetryCount}`);
      
      // Also try unmuting in case autoplay was muted
      setTimeout(() => {
        if (ytPlayer && ytPlayerReady) {
          try {
            ytPlayer.unMute();
            ytPlayer.setVolume(100);
          } catch(e) {}
        }
      }, 500);
    }
  } catch(e) {
    console.log('Play error:', e);
    scheduleRetry();
  }
}

function scheduleRetry() {
  if (!musicPlaying) return;
  
  if (ytRetryCount < MAX_RETRIES) {
    if (!ytRetryInterval) {
      ytRetryInterval = setInterval(() => {
        if (!musicPlaying) {
          clearRetryInterval();
          return;
        }
        
        if (ytRetryCount >= MAX_RETRIES) {
          console.log('Max retries reached, showing manual link');
          youtubeLink.style.display = 'block';
          musicToggleBtn.textContent = '⚠️ Click Link';
          clearRetryInterval();
          return;
        }
        
        tryPlayVideo();
      }, 2000);
    }
  } else {
    youtubeLink.style.display = 'block';
    musicToggleBtn.textContent = '⚠️ Click Link';
  }
}

function clearRetryInterval() {
  if (ytRetryInterval) {
    clearInterval(ytRetryInterval);
    ytRetryInterval = null;
  }
}

function toggleMusic() {
  musicPlaying = !musicPlaying;
  
  if (musicPlaying) {
    ytRetryCount = 0;
    youtubeLink.style.display = 'block';
    musicToggleBtn.textContent = '⏳ Loading...';
    musicToggleBtn.style.background = 'rgba(150, 150, 50, 0.8)';
    
    if (ytPlayerReady && ytPlayer) {
      tryPlayVideo();
      scheduleRetry();
    } else {
      // API not loaded yet, try reinitializing
      if (typeof YT !== 'undefined' && YT.Player) {
        initYouTubePlayer();
      }
      scheduleRetry();
    }
  } else {
    clearRetryInterval();
    if (ytPlayer && ytPlayerReady) {
      try {
        ytPlayer.pauseVideo();
      } catch(e) {}
    }
    youtubeContainer.style.display = 'none';
    youtubeLink.style.display = 'none';
    musicToggleBtn.textContent = '🔇 Video Off';
    musicToggleBtn.style.background = 'rgba(150, 50, 50, 0.8)';
  }
}

// Fallback: check every 5 seconds if video should be playing but isn't
setInterval(() => {
  if (musicPlaying && ytPlayer && ytPlayerReady) {
    try {
      const state = ytPlayer.getPlayerState();
      if (state !== 1 && state !== 3) { // Not playing and not buffering
        console.log('Video stopped unexpectedly, retrying...');
        ytRetryCount = 0;
        tryPlayVideo();
      }
    } catch(e) {}
  }
}, 5000);

musicToggleBtn.addEventListener('click', toggleMusic);

// ============ GAME START ============

const loadingScreen = document.getElementById('loading');
const startBtn = document.getElementById('start-btn');
const playerNameInput = document.getElementById('player-name');

// Connect to server when page loads
connectToServer();

startBtn.addEventListener('click', () => {
  gameStarted = true;
  loadingScreen.style.display = 'none';
  
  // Get player name if entered
  playerName = playerNameInput.value.trim();
  if (playerName) {
    addNameToSnowman(playerGroup, playerName);
  }
  
  // Get room ID from URL or generate new one for private games
  let roomId = getRoomIdFromUrl();
  
  // Check if user wants to create a private room
  const createPrivateRoom = document.getElementById('create-private-room');
  if (createPrivateRoom && createPrivateRoom.checked && !roomId) {
    roomId = generateRoomId();
    // Update URL without reloading
    const newUrl = `${window.location.pathname}?room=${roomId}`;
    window.history.pushState({ roomId }, '', newUrl);
  }
  
  // Join the game server with room ID
  if (socket && socket.connected) {
    socket.emit('player-join', {
      name: playerName || `Snowman-${Math.floor(Math.random() * 1000)}`,
      roomId: roomId // null means public lobby
    });
  }
  
  // Start video
  toggleMusic();
});

// ============ MICROPHONE / SPEECH RECOGNITION ============

let micEnabled = false;
let recognition = null;

// Initialize speech recognition
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    console.log('Speech recognition not supported');
    return null;
  }
  
  const recog = new SpeechRecognition();
  recog.continuous = true;
  recog.interimResults = true;
  recog.lang = 'en-US';
  
  recog.onresult = (event) => {
    const last = event.results.length - 1;
    const transcript = event.results[last][0].transcript;
    
    if (event.results[last].isFinal) {
      // Check if near chatbot - send to AI
      if (chatbotActive && chatbotSnowman) {
        const distance = playerGroup.position.distanceTo(chatbotSnowman.position);
        if (distance < 8) {
          handleChatbotInput(transcript);
          return;
        }
      }
      
      // Otherwise send to multiplayer chat
      if (socket && socket.connected) {
        socket.emit('chat-message', { message: transcript });
      }
    }
  };
  
  recog.onerror = (event) => {
    console.log('Speech recognition error:', event.error);
    if (event.error === 'not-allowed') {
      alert('Microphone access denied. Please allow microphone access to use voice chat.');
      micEnabled = false;
      updateMicButton();
    }
  };
  
  recog.onend = () => {
    // Restart if still enabled
    if (micEnabled) {
      try {
        recog.start();
      } catch (e) {
        console.log('Could not restart recognition');
      }
    }
  };
  
  return recog;
}

function updateMicButton() {
  const micToggle = document.getElementById('micToggle');
  if (micToggle) {
    if (micEnabled) {
      micToggle.textContent = '🎤 Mic On';
      micToggle.classList.add('mic-on');
    } else {
      micToggle.textContent = '🎤 Mic Off';
      micToggle.classList.remove('mic-on');
    }
  }
}

function toggleMic() {
  micEnabled = !micEnabled;
  
  if (micEnabled) {
    if (!recognition) {
      recognition = initSpeechRecognition();
    }
    if (recognition) {
      try {
        recognition.start();
        console.log('Microphone enabled - listening...');
      } catch (e) {
        console.log('Recognition already started');
      }
    } else {
      alert('Speech recognition is not supported in this browser.');
      micEnabled = false;
    }
  } else {
    if (recognition) {
      recognition.stop();
      console.log('Microphone disabled');
    }
  }
  
  updateMicButton();
}

// ============ FACE CAMERA FEATURE ============

// Initialize face camera
async function initFaceCamera() {
  try {
    // Request front camera access
    faceCamStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 512, height: 512 }
    });
    
    // Get or create video element
    faceCamVideoElement = document.getElementById('face-camera-video');
    if (!faceCamVideoElement) {
      faceCamVideoElement = document.createElement('video');
      faceCamVideoElement.id = 'face-camera-video';
      faceCamVideoElement.autoplay = true;
      faceCamVideoElement.playsInline = true;
      faceCamVideoElement.style.display = 'none';
      document.body.appendChild(faceCamVideoElement);
    }
    
    faceCamVideoElement.srcObject = faceCamStream;
    await faceCamVideoElement.play();
    
    // Create video texture
    faceCamVideoTexture = new THREE.VideoTexture(faceCamVideoElement);
    faceCamVideoTexture.minFilter = THREE.LinearFilter;
    faceCamVideoTexture.magFilter = THREE.LinearFilter;
    faceCamVideoTexture.format = THREE.RGBAFormat;
    
    console.log('Face camera initialized successfully');
    return true;
  } catch (error) {
    console.error('Failed to initialize face camera:', error);
    alert('Could not access camera. Please allow camera permissions and try again.');
    return false;
  }
}

// Create video screen mesh for snowman head - full spherical coverage
function createVideoHeadMesh() {
  // Create a sphere geometry for the entire head
  const geometry = new THREE.SphereGeometry(playerHeadSize, 32, 32);
  
  // Modify UV mapping to make video fill the front hemisphere nicely
  const uvAttribute = geometry.attributes.uv;
  const positionAttribute = geometry.attributes.position;
  
  for (let i = 0; i < uvAttribute.count; i++) {
    const x = positionAttribute.getX(i);
    const y = positionAttribute.getY(i);
    const z = positionAttribute.getZ(i);
    
    // Map the front-facing vertices to show the video more prominently
    // Normalize positions to -1 to 1 range for UV mapping
    const u = (x / playerHeadSize + 1) / 2;
    const v = (y / playerHeadSize + 1) / 2;
    
    uvAttribute.setXY(i, u, v);
  }
  uvAttribute.needsUpdate = true;
  
  // Create material with video texture - shows on entire sphere
  const material = new THREE.MeshBasicMaterial({
    map: faceCamVideoTexture,
    side: THREE.DoubleSide
  });
  
  const videoMesh = new THREE.Mesh(geometry, material);
  videoMesh.position.y = playerHeadY;
  videoMesh.name = 'video-head';
  
  // Add a glowing ring frame around the head equator for effect
  const frameGeometry = new THREE.TorusGeometry(playerHeadSize * 1.02, playerHeadSize * 0.05, 16, 48);
  const frameMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x4444ff, 
    metalness: 0.9, 
    roughness: 0.1,
    emissive: 0x2222aa,
    emissiveIntensity: 0.5
  });
  const frame = new THREE.Mesh(frameGeometry, frameMaterial);
  frame.position.y = playerHeadY;
  frame.rotation.x = Math.PI / 2; // Horizontal ring around head
  frame.name = 'video-frame';
  
  // Add vertical ring too for cool effect
  const frame2 = new THREE.Mesh(frameGeometry.clone(), frameMaterial.clone());
  frame2.position.y = playerHeadY;
  frame2.rotation.z = Math.PI / 2;
  frame2.name = 'video-frame2';
  
  // Add pulsing glow sphere slightly larger
  const glowGeometry = new THREE.SphereGeometry(playerHeadSize * 1.08, 16, 16);
  const glowMaterial = new THREE.MeshBasicMaterial({ 
    color: 0x00ffff, 
    transparent: true, 
    opacity: 0.15,
    side: THREE.BackSide
  });
  const glow = new THREE.Mesh(glowGeometry, glowMaterial);
  glow.position.y = playerHeadY;
  glow.name = 'video-glow';
  
  return { videoMesh, frame, glow, frame2 };
}

// Toggle face camera on/off
async function toggleFaceCamera() {
  const faceCamBtn = document.getElementById('faceCamToggle');
  
  if (!faceCamEnabled) {
    // Enable face camera
    if (!faceCamStream) {
      const success = await initFaceCamera();
      if (!success) return;
    }
    
    // Hide original head and facial features
    if (playerHeadOriginalMesh) {
      // Hide the head mesh
      playerHeadOriginalMesh.visible = false;
      
      // Hide nose and eyes that are positioned on the head
      playerGroup.children.forEach(child => {
        if (child.position.y > playerHeadY - playerHeadSize && 
            child.position.y < playerHeadY + playerHeadSize * 1.5 &&
            child !== playerHeadOriginalMesh &&
            !child.name?.includes('hat') && 
            !child.name?.includes('scarf') &&
            !child.userData?.isNameTag) {
          // Store original visibility and hide
          child.userData.wasVisible = child.visible;
          child.userData.hiddenByFaceCam = true;
          child.visible = false;
        }
      });
      
      // Create and add video head
      const { videoMesh, frame, glow, frame2 } = createVideoHeadMesh();
      playerHeadVideoMesh = videoMesh;
      playerGroup.add(videoMesh);
      playerGroup.add(frame);
      playerGroup.add(glow);
      if (frame2) playerGroup.add(frame2);
    }
    
    faceCamEnabled = true;
    if (faceCamBtn) {
      faceCamBtn.textContent = '📷 Face Cam ON';
      faceCamBtn.classList.add('cam-on');
    }
    console.log('Face camera enabled');
  } else {
    // Disable face camera
    faceCamEnabled = false;
    
    // Show original head and facial features
    if (playerHeadOriginalMesh) {
      playerHeadOriginalMesh.visible = true;
      
      // Restore hidden facial features
      playerGroup.children.forEach(child => {
        if (child.userData?.hiddenByFaceCam) {
          child.visible = child.userData.wasVisible !== false;
          delete child.userData.hiddenByFaceCam;
          delete child.userData.wasVisible;
        }
      });
      
      // Remove video head meshes
      const toRemove = [];
      playerGroup.children.forEach(child => {
        if (child.name === 'video-head' || child.name === 'video-frame' || child.name === 'video-frame2' || child.name === 'video-glow') {
          toRemove.push(child);
        }
      });
      toRemove.forEach(child => {
        playerGroup.remove(child);
        if (child.geometry) child.geometry.dispose();
        if (child.material) child.material.dispose();
      });
      playerHeadVideoMesh = null;
    }
    
    if (faceCamBtn) {
      faceCamBtn.textContent = '📷 Face Cam';
      faceCamBtn.classList.remove('cam-on');
    }
    console.log('Face camera disabled');
  }
}

// Update video texture in animation loop
function updateFaceCamTexture() {
  if (faceCamEnabled && faceCamVideoTexture && faceCamVideoElement) {
    if (faceCamVideoElement.readyState >= faceCamVideoElement.HAVE_CURRENT_DATA) {
      faceCamVideoTexture.needsUpdate = true;
    }
  }
}

// Face camera toggle button
const faceCamToggle = document.getElementById('faceCamToggle');
if (faceCamToggle) {
  faceCamToggle.addEventListener('click', toggleFaceCamera);
}

// Mic toggle button
const micToggle = document.getElementById('micToggle');
if (micToggle) {
  micToggle.addEventListener('click', toggleMic);
}

// Chat tab toggle
const chatTab = document.getElementById('chat-tab');
const chatBox = document.getElementById('chat-box');
if (chatTab && chatBox) {
  chatTab.addEventListener('click', () => {
    chatBox.classList.toggle('open');
    chatTab.textContent = chatBox.classList.contains('open') ? '✕ Close' : '💬 Chat';
  });
}

// Chat input handling
const chatInput = document.getElementById('chat-input');
if (chatInput) {
  chatInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && chatInput.value.trim()) {
      if (socket && socket.connected) {
        socket.emit('chat-message', { message: chatInput.value.trim() });
      }
      chatInput.value = '';
      // Close chat on mobile after sending
      if (window.innerWidth <= 768 && chatBox) {
        chatBox.classList.remove('open');
        chatTab.textContent = '💬 Chat';
      }
    }
  });
  
  // Prevent game controls while typing
  chatInput.addEventListener('focus', () => {
    Object.keys(keys).forEach(key => delete keys[key]);
  });
}

// Chatbot input handling
const chatbotInput = document.getElementById('chatbot-input');
if (chatbotInput) {
  chatbotInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && chatbotInput.value.trim()) {
      handleChatbotInput(chatbotInput.value.trim());
      chatbotInput.value = '';
    }
  });
  
  // Prevent game controls while typing to chatbot
  chatbotInput.addEventListener('focus', () => {
    Object.keys(keys).forEach(key => delete keys[key]);
  });
}

// ============ ANIMATION LOOP ============

function animate() {
  requestAnimationFrame(animate);
  
  if (!gameStarted) {
    renderer.render(scene, camera);
    return;
  }
  
  // Animate fire lights
  animateFireLights();
  
  // Animate snow
  animateSnow();
  
  // Animate NPCs (only if offline)
  if (!socket || !socket.connected) {
    animateNPCs();
  }
  
  // Interpolate remote player movements
  interpolateRemotePlayers();
  
  // Send our position to server
  sendPlayerPosition();
  
  // Check proximity to AI chatbot snowman
  checkChatbotProximity();

  // Update YouTube iframe position on TV
  updateYouTubePosition();

  // Update face camera video texture
  updateFaceCamTexture();

  // Animate and check dog proximity
  animateDog();
  checkDogProximity();

  // Make name tags face camera
  [playerGroup, ...npcSnowmen, chatbotSnowman].forEach(snowman => {
    if (snowman && snowman.userData.nameSprite) {
      snowman.userData.nameSprite.lookAt(camera.position);
    }
  });
  
  // Player movement
  const speed = 0.12;
  const direction = new THREE.Vector3();
  
  if (keys['w']) direction.z -= 1;
  if (keys['s']) direction.z += 1;
  if (keys['a']) direction.x -= 1;
  if (keys['d']) direction.x += 1;
  
  if (joystickActive) {
    direction.x += joystickX;
    direction.z += joystickY;
  }
  
  if (direction.length() > 0) {
    direction.normalize();
    direction.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    playerGroup.position.add(direction.multiplyScalar(speed));
    playerGroup.rotation.y = yaw + Math.PI;
  }
  
  // Keep player within the ground bounds (ground is 300x300, centered at origin)
  playerGroup.position.x = Math.max(-145, Math.min(145, playerGroup.position.x));
  playerGroup.position.z = Math.max(-145, Math.min(145, playerGroup.position.z));
  
  if (isFirstPerson) {
    camera.position.x = playerGroup.position.x;
    camera.position.y = playerGroup.position.y + 3.5;
    camera.position.z = playerGroup.position.z;
    
    const lookTarget = new THREE.Vector3(
      playerGroup.position.x - Math.sin(yaw) * 10,
      playerGroup.position.y + 3.5 + pitch * 5,
      playerGroup.position.z - Math.cos(yaw) * 10
    );
    camera.lookAt(lookTarget);
  } else {
    const cameraDistance = 8;
    const cameraHeight = 5;
    
    camera.position.x = playerGroup.position.x + Math.sin(yaw) * cameraDistance;
    camera.position.z = playerGroup.position.z + Math.cos(yaw) * cameraDistance;
    camera.position.y = playerGroup.position.y + cameraHeight - pitch * 3;
    
    camera.lookAt(playerGroup.position.x, playerGroup.position.y + 2, playerGroup.position.z);
  }
  
  renderer.render(scene, camera);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

animate();
