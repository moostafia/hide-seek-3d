/**
 * Controls - Handles desktop and mobile input controls
 */
class Controls {
  constructor(camera, player) {
    this.camera = camera;
    this.player = player;
    
    // Input state
    this.keys = {};
    this.mouseDown = false;
    this.mouseDelta = { x: 0, y: 0 };
    
    // Mobile controls
    this.joystickActive = false;
    this.joystickPosition = { x: 0, y: 0 };
    this.joystickCenter = { x: 0, y: 0 };
    this.touchLookStart = { x: 0, y: 0 };
    this.touchLookCurrent = { x: 0, y: 0 };
    
    // Camera angles
    this.cameraAngle = { horizontal: 0, vertical: 0 };
    this.cameraDistance = 5;
    this.cameraHeight = 2;
    
    // Detect if mobile
    this.isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    this.setupEventListeners();
    
    if (this.isMobile) {
      this.setupMobileControls();
    }
  }

  setupEventListeners() {
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
      this.keys[e.key.toLowerCase()] = true;
    });

    document.addEventListener('keyup', (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });

    // Mouse controls for desktop
    if (!this.isMobile) {
      document.addEventListener('mousedown', (e) => {
        if (e.target.id === 'gameCanvas') {
          this.mouseDown = true;
        }
      });

      document.addEventListener('mouseup', () => {
        this.mouseDown = false;
      });

      document.addEventListener('mousemove', (e) => {
        if (this.mouseDown) {
          this.mouseDelta.x = e.movementX || 0;
          this.mouseDelta.y = e.movementY || 0;
        }
      });

      // Request pointer lock for better control
      const canvas = document.getElementById('gameCanvas');
      canvas.addEventListener('click', () => {
        canvas.requestPointerLock = canvas.requestPointerLock ||
                                     canvas.mozRequestPointerLock ||
                                     canvas.webkitRequestPointerLock;
        if (canvas.requestPointerLock) {
          canvas.requestPointerLock();
        }
      });

      document.addEventListener('pointerlockchange', () => {
        this.mouseDown = document.pointerLockElement === canvas;
      });
    }
  }

  setupMobileControls() {
    const joystickZone = document.getElementById('joystickZone');
    const joystick = document.getElementById('joystick');
    const joystickKnob = joystick.querySelector('.joystick-knob');
    const actionBtn = document.getElementById('actionBtn');

    if (!joystickZone) return;

    // Joystick for movement
    joystickZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const touch = e.touches[0];
      const rect = joystickZone.getBoundingClientRect();
      
      this.joystickCenter.x = rect.left + rect.width / 2;
      this.joystickCenter.y = rect.top + rect.height / 2;
      this.joystickActive = true;
      
      this.updateJoystick(touch.clientX, touch.clientY, joystickKnob);
    });

    joystickZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (this.joystickActive) {
        const touch = e.touches[0];
        this.updateJoystick(touch.clientX, touch.clientY, joystickKnob);
      }
    });

    joystickZone.addEventListener('touchend', (e) => {
      e.preventDefault();
      this.joystickActive = false;
      this.joystickPosition = { x: 0, y: 0 };
      joystickKnob.style.transform = 'translate(-50%, -50%)';
    });

    // Touch for camera rotation (right side of screen)
    const canvas = document.getElementById('gameCanvas');
    let touchLookId = null;

    canvas.addEventListener('touchstart', (e) => {
      for (let touch of e.touches) {
        const rect = canvas.getBoundingClientRect();
        const x = touch.clientX - rect.left;
        
        // Right half of screen for camera
        if (x > rect.width / 2) {
          touchLookId = touch.identifier;
          this.touchLookStart.x = touch.clientX;
          this.touchLookStart.y = touch.clientY;
          this.touchLookCurrent.x = touch.clientX;
          this.touchLookCurrent.y = touch.clientY;
        }
      }
    });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (let touch of e.touches) {
        if (touch.identifier === touchLookId) {
          this.touchLookCurrent.x = touch.clientX;
          this.touchLookCurrent.y = touch.clientY;
        }
      }
    });

    canvas.addEventListener('touchend', (e) => {
      for (let touch of e.changedTouches) {
        if (touch.identifier === touchLookId) {
          touchLookId = null;
          this.touchLookStart = { x: 0, y: 0 };
          this.touchLookCurrent = { x: 0, y: 0 };
        }
      }
    });

    // Action button
    if (actionBtn) {
      actionBtn.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.onAction();
      });
    }
  }

  updateJoystick(touchX, touchY, knob) {
    const dx = touchX - this.joystickCenter.x;
    const dy = touchY - this.joystickCenter.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const maxDistance = 45; // Max joystick movement radius

    if (distance > maxDistance) {
      this.joystickPosition.x = (dx / distance) * maxDistance;
      this.joystickPosition.y = (dy / distance) * maxDistance;
    } else {
      this.joystickPosition.x = dx;
      this.joystickPosition.y = dy;
    }

    // Normalize to -1 to 1
    this.joystickPosition.x = this.joystickPosition.x / maxDistance;
    this.joystickPosition.y = this.joystickPosition.y / maxDistance;

    // Update knob position
    knob.style.transform = `translate(-50%, -50%) translate(${this.joystickPosition.x * maxDistance}px, ${this.joystickPosition.y * maxDistance}px)`;
  }

  update(delta) {
    if (!this.player) return;

    const moveSpeed = this.player.speed * delta;
    const rotateSpeed = this.player.rotationSpeed * delta;

    // Movement direction
    let moveX = 0;
    let moveZ = 0;

    if (this.isMobile) {
      // Mobile joystick movement
      if (this.joystickActive) {
        moveX = this.joystickPosition.x;
        moveZ = this.joystickPosition.y;
      }

      // Mobile camera rotation
      if (this.touchLookCurrent.x !== 0 || this.touchLookCurrent.y !== 0) {
        const deltaX = (this.touchLookCurrent.x - this.touchLookStart.x) * 0.01;
        const deltaY = (this.touchLookCurrent.y - this.touchLookStart.y) * 0.01;
        
        this.cameraAngle.horizontal -= deltaX;
        this.cameraAngle.vertical = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.cameraAngle.vertical - deltaY));
        
        this.touchLookStart.x = this.touchLookCurrent.x;
        this.touchLookStart.y = this.touchLookCurrent.y;
      }
    } else {
      // Desktop WASD movement
      if (this.keys['w']) moveZ -= 1;
      if (this.keys['s']) moveZ += 1;
      if (this.keys['a']) moveX -= 1;
      if (this.keys['d']) moveX += 1;

      // Desktop mouse camera rotation
      if (this.mouseDown) {
        this.cameraAngle.horizontal -= this.mouseDelta.x * 0.005;
        this.cameraAngle.vertical = Math.max(-Math.PI / 3, Math.min(Math.PI / 3, this.cameraAngle.vertical - this.mouseDelta.y * 0.005));
        this.mouseDelta.x = 0;
        this.mouseDelta.y = 0;
      }
    }

    // Apply movement relative to camera direction
    if (moveX !== 0 || moveZ !== 0) {
      const angle = this.cameraAngle.horizontal;
      const forward = new THREE.Vector3(
        Math.sin(angle) * moveZ - Math.cos(angle) * moveX,
        0,
        Math.cos(angle) * moveZ + Math.sin(angle) * moveX
      ).normalize();

      this.player.position.x += forward.x * moveSpeed;
      this.player.position.z += forward.z * moveSpeed;

      // Update player rotation to face movement direction
      if (forward.length() > 0) {
        this.player.rotation.y = Math.atan2(forward.x, forward.z);
      }

      // Clamp to environment bounds
      this.player.position.x = Math.max(-28, Math.min(28, this.player.position.x));
      this.player.position.z = Math.max(-28, Math.min(28, this.player.position.z));
    }

    // Update camera position (third-person)
    this.updateCamera();
  }

  updateCamera() {
    if (!this.player || !this.camera) return;

    const horizontal = this.cameraAngle.horizontal;
    const vertical = this.cameraAngle.vertical;

    const offsetX = Math.sin(horizontal) * this.cameraDistance * Math.cos(vertical);
    const offsetY = this.cameraHeight + Math.sin(vertical) * this.cameraDistance;
    const offsetZ = Math.cos(horizontal) * this.cameraDistance * Math.cos(vertical);

    this.camera.position.x = this.player.position.x + offsetX;
    this.camera.position.y = this.player.position.y + offsetY;
    this.camera.position.z = this.player.position.z + offsetZ;

    this.camera.lookAt(
      this.player.position.x,
      this.player.position.y + 1,
      this.player.position.z
    );
  }

  onAction() {
    // Handle tag action
    if (window.game && window.game.onTagAction) {
      window.game.onTagAction();
    }
  }
}
