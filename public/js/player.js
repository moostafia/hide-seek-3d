/**
 * Player - Represents a player character in the 3D world
 */
class Player {
  constructor(id, name, scene, isLocalPlayer = false) {
    this.id = id;
    this.name = name;
    this.scene = scene;
    this.isLocalPlayer = isLocalPlayer;
    this.role = null;
    this.isFound = false;

    // Create player mesh
    this.createPlayerMesh();

    // Create name label
    this.createNameLabel();

    // Position
    this.position = new THREE.Vector3(0, 1, 0);
    this.rotation = new THREE.Euler(0, 0, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);

    // Movement
    this.speed = 5;
    this.rotationSpeed = 2;
  }

  createPlayerMesh() {
    // Create a simple humanoid shape
    this.group = new THREE.Group();

    // Body
    const bodyGeometry = new THREE.CapsuleGeometry(0.3, 1, 8, 16);
    const bodyMaterial = new THREE.MeshStandardMaterial({
      color: this.getRandomColor(),
      roughness: 0.5
    });
    this.body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    this.body.castShadow = true;
    this.body.receiveShadow = true;
    this.group.add(this.body);

    // Head
    const headGeometry = new THREE.SphereGeometry(0.25, 16, 16);
    const headMaterial = new THREE.MeshStandardMaterial({
      color: 0xFFDBAC,
      roughness: 0.7
    });
    this.head = new THREE.Mesh(headGeometry, headMaterial);
    this.head.position.y = 0.9;
    this.head.castShadow = true;
    this.group.add(this.head);

    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.05, 8, 8);
    const eyeMaterial = new THREE.MeshStandardMaterial({ color: 0x000000 });
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.1, 1, 0.2);
    this.group.add(leftEye);

    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.1, 1, 0.2);
    this.group.add(rightEye);

    // Add to scene
    this.scene.add(this.group);
  }

  createNameLabel() {
    // Create canvas for name label
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;

    // Draw text
    context.fillStyle = 'rgba(0, 0, 0, 0.7)';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.font = 'bold 24px Arial';
    context.fillStyle = 'white';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(this.name, canvas.width / 2, canvas.height / 2);

    // Create texture and sprite
    const texture = new THREE.CanvasTexture(canvas);
    const material = new THREE.SpriteMaterial({ map: texture });
    this.nameLabel = new THREE.Sprite(material);
    this.nameLabel.scale.set(2, 0.5, 1);
    this.nameLabel.position.y = 2;

    this.group.add(this.nameLabel);
  }

  getRandomColor() {
    const colors = [
      0x3498db, // Blue
      0xe74c3c, // Red
      0x2ecc71, // Green
      0xf39c12, // Orange
      0x9b59b6, // Purple
      0x1abc9c, // Turquoise
      0xe67e22, // Carrot
      0x34495e  // Gray-blue
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  setRole(role) {
    this.role = role;
    
    // Change color based on role
    if (role === 'seeker') {
      this.body.material.color.setHex(0xe74c3c); // Red for seekers
    } else if (role === 'hider') {
      this.body.material.color.setHex(0x3498db); // Blue for hiders
    }
  }

  setFound(found) {
    this.isFound = found;
    if (found) {
      // Make player semi-transparent when found
      this.body.material.opacity = 0.5;
      this.body.material.transparent = true;
      this.head.material.opacity = 0.5;
      this.head.material.transparent = true;
    }
  }

  setPosition(x, y, z) {
    this.position.set(x, y, z);
    this.group.position.copy(this.position);
  }

  setRotation(x, y, z) {
    this.rotation.set(x, y, z);
    this.group.rotation.copy(this.rotation);
  }

  update(delta) {
    if (this.isLocalPlayer) {
      // Local player movement is handled by controls
      this.group.position.copy(this.position);
      this.group.rotation.copy(this.rotation);
    }
    
    // Make name label always face camera
    if (this.nameLabel && window.game && window.game.camera) {
      this.nameLabel.quaternion.copy(window.game.camera.quaternion);
    }
  }

  getDistanceTo(otherPlayer) {
    if (!otherPlayer || !otherPlayer.position) return Infinity;
    return this.position.distanceTo(otherPlayer.position);
  }

  remove() {
    if (this.group) {
      this.scene.remove(this.group);
    }
  }
}
