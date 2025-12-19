/**
 * Environment - Creates the 3D game environment with rooms and hiding spots
 */
class Environment {
  constructor(scene) {
    this.scene = scene;
    this.setupLighting();
    this.createEnvironment();
  }

  setupLighting() {
    // Ambient light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    // Directional light (sun)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.6);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    directionalLight.shadow.camera.left = -100;
    directionalLight.shadow.camera.right = 100;
    directionalLight.shadow.camera.top = 100;
    directionalLight.shadow.camera.bottom = -100;
    this.scene.add(directionalLight);

    // Point lights for rooms
    this.addPointLight(0, 5, 0, 0xffffff, 1.0);
    this.addPointLight(20, 5, 20, 0xffffff, 1.0);
    this.addPointLight(-20, 5, 20, 0xffffff, 1.0);
    this.addPointLight(20, 5, -20, 0xffffff, 1.0);
    this.addPointLight(-20, 5, -20, 0xffffff, 1.0);
  }

  addPointLight(x, y, z, color, intensity) {
    const light = new THREE.PointLight(color, intensity, 50);
    light.position.set(x, y, z);
    light.castShadow = true;
    this.scene.add(light);
  }

  createEnvironment() {
    // Ground
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B7355,
      roughness: 0.8,
      metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Create a simple house structure
    this.createHouse();
    
    // Add furniture and hiding spots
    this.createFurniture();

    // Add spawn points
    this.spawnPoints = [
      { x: 0, y: 1, z: 0 },
      { x: 5, y: 1, z: 5 },
      { x: -5, y: 1, z: 5 },
      { x: 5, y: 1, z: -5 },
      { x: -5, y: 1, z: -5 },
      { x: 15, y: 1, z: 15 },
      { x: -15, y: 1, z: 15 },
      { x: 15, y: 1, z: -15 }
    ];
  }

  createHouse() {
    const wallMaterial = new THREE.MeshStandardMaterial({
      color: 0xD3D3D3,
      roughness: 0.7
    });

    // Outer walls
    this.createWall(-30, 5, 0, 60, 10, 1, wallMaterial); // Back
    this.createWall(30, 5, 0, 60, 10, 1, wallMaterial);  // Front
    this.createWall(0, 5, -30, 1, 10, 60, wallMaterial); // Left
    this.createWall(0, 5, 30, 1, 10, 60, wallMaterial);  // Right

    // Inner walls to create rooms
    this.createWall(0, 5, 0, 60, 10, 1, wallMaterial);   // Middle horizontal
    this.createWall(0, 5, 0, 1, 10, 60, wallMaterial);   // Middle vertical

    // Doorways (created by not filling certain sections)
    this.createDoorway(0, 0, -5);
    this.createDoorway(0, 0, 5);
    this.createDoorway(-5, 0, 0);
    this.createDoorway(5, 0, 0);

    // Ceiling
    const ceilingGeometry = new THREE.PlaneGeometry(60, 60);
    const ceilingMaterial = new THREE.MeshStandardMaterial({
      color: 0xEEEEEE,
      side: THREE.DoubleSide
    });
    const ceiling = new THREE.Mesh(ceilingGeometry, ceilingMaterial);
    ceiling.position.y = 10;
    ceiling.rotation.x = Math.PI / 2;
    ceiling.receiveShadow = true;
    this.scene.add(ceiling);
  }

  createWall(x, y, z, width, height, depth, material) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const wall = new THREE.Mesh(geometry, material);
    wall.position.set(x, y, z);
    wall.castShadow = true;
    wall.receiveShadow = true;
    this.scene.add(wall);
    return wall;
  }

  createDoorway(x, y, z) {
    // Visual marker for doorway (optional)
    const doorGeometry = new THREE.BoxGeometry(3, 6, 0.5);
    const doorMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      roughness: 0.8
    });
    const door = new THREE.Mesh(doorGeometry, doorMaterial);
    door.position.set(x, y + 3, z);
    door.castShadow = true;
    this.scene.add(door);
  }

  createFurniture() {
    // Boxes/Crates for hiding
    this.createBox(15, 1, 15, 2, 2, 2, 0x8B4513);
    this.createBox(-15, 1, 15, 2, 2, 2, 0x8B4513);
    this.createBox(15, 1, -15, 2, 2, 2, 0x8B4513);
    this.createBox(-15, 1, -15, 2, 2, 2, 0x8B4513);
    
    // Tables
    this.createTable(10, 0, 10);
    this.createTable(-10, 0, 10);
    this.createTable(10, 0, -10);
    this.createTable(-10, 0, -10);

    // Pillars
    this.createPillar(20, 0, 20);
    this.createPillar(-20, 0, 20);
    this.createPillar(20, 0, -20);
    this.createPillar(-20, 0, -20);

    // Large containers
    this.createBox(0, 2, 20, 4, 4, 4, 0x4A4A4A);
    this.createBox(0, 2, -20, 4, 4, 4, 0x4A4A4A);
    this.createBox(20, 2, 0, 4, 4, 4, 0x4A4A4A);
    this.createBox(-20, 2, 0, 4, 4, 4, 0x4A4A4A);
  }

  createBox(x, y, z, width, height, depth, color) {
    const geometry = new THREE.BoxGeometry(width, height, depth);
    const material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.7
    });
    const box = new THREE.Mesh(geometry, material);
    box.position.set(x, y + height / 2, z);
    box.castShadow = true;
    box.receiveShadow = true;
    this.scene.add(box);
    return box;
  }

  createTable(x, y, z) {
    // Table top
    const topGeometry = new THREE.BoxGeometry(4, 0.2, 4);
    const tableMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513,
      roughness: 0.6
    });
    const top = new THREE.Mesh(topGeometry, tableMaterial);
    top.position.set(x, y + 2, z);
    top.castShadow = true;
    top.receiveShadow = true;
    this.scene.add(top);

    // Table legs
    const legGeometry = new THREE.CylinderGeometry(0.1, 0.1, 2, 8);
    const legPositions = [
      [x - 1.5, y + 1, z - 1.5],
      [x + 1.5, y + 1, z - 1.5],
      [x - 1.5, y + 1, z + 1.5],
      [x + 1.5, y + 1, z + 1.5]
    ];

    legPositions.forEach(pos => {
      const leg = new THREE.Mesh(legGeometry, tableMaterial);
      leg.position.set(...pos);
      leg.castShadow = true;
      this.scene.add(leg);
    });
  }

  createPillar(x, y, z) {
    const geometry = new THREE.CylinderGeometry(0.5, 0.5, 10, 12);
    const material = new THREE.MeshStandardMaterial({
      color: 0xCCCCCC,
      roughness: 0.5
    });
    const pillar = new THREE.Mesh(geometry, material);
    pillar.position.set(x, y + 5, z);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    this.scene.add(pillar);
  }

  getSpawnPoint(index) {
    return this.spawnPoints[index % this.spawnPoints.length];
  }

  getRandomSpawnPoint() {
    return this.spawnPoints[Math.floor(Math.random() * this.spawnPoints.length)];
  }
}
