# Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLIENT SIDE                          │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   Three.js   │    │  Socket.IO   │    │   WebRTC     │  │
│  │   Renderer   │    │    Client    │    │  SimplePeer  │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                    │                    │          │
│         └────────────────────┼────────────────────┘          │
│                              │                               │
│                    ┌─────────▼─────────┐                     │
│                    │   Game Manager    │                     │
│                    │  (game.js + ui.js)│                     │
│                    └─────────┬─────────┘                     │
│                              │                               │
│         ┌────────────────────┼────────────────────┐          │
│         │                    │                    │          │
│    ┌────▼────┐        ┌─────▼─────┐       ┌─────▼─────┐    │
│    │ Player  │        │ Controls  │       │   Voice   │    │
│    │ System  │        │  Handler  │       │   Chat    │    │
│    └─────────┘        └───────────┘       └───────────┘    │
│                                                               │
└───────────────────────────┬───────────────────────────────┘
                            │
                            │ WebSocket (Socket.IO)
                            │ WebRTC Data Channels
                            │
┌───────────────────────────▼───────────────────────────────┐
│                         SERVER SIDE                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Express.js HTTP Server                   │  │
│  │              Serving Static Files                     │  │
│  └──────────────────────────────────────────────────────┘  │
│                              │                               │
│                    ┌─────────▼─────────┐                     │
│                    │    Socket.IO      │                     │
│                    │  Event Handler    │                     │
│                    └─────────┬─────────┘                     │
│                              │                               │
│                    ┌─────────▼─────────┐                     │
│                    │   GameManager     │                     │
│                    │  - Room System    │                     │
│                    │  - Game Logic     │                     │
│                    │  - Player State   │                     │
│                    └───────────────────┘                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Component Breakdown

### Server Components

#### 1. Express Server (`server/index.js`)
- Serves static files from `public/`
- Creates HTTP server for Socket.IO
- Handles client connections

#### 2. Game Manager (`server/gameManager.js`)
- **Room Management:**
  - Generate unique 6-character room codes
  - Create/join/leave rooms
  - Track players per room (max 8)
  
- **Game State:**
  - Lobby → Hiding → Seeking → Game Over
  - Assign roles (hiders/seekers)
  - Track game timers
  
- **Game Logic:**
  - Validate tagging distance
  - Check win conditions
  - Handle player disconnects

### Client Components

#### 3. Main Entry (`public/js/main.js`)
- Initialize network connection
- Create game instance
- Set up voice chat
- Initialize UI

#### 4. Three.js Game (`public/js/game.js`)
- **Scene Management:**
  - Create Three.js scene, camera, renderer
  - Handle window resize
  - Manage game loop
  
- **Game Flow:**
  - Start game with role assignment
  - Phase transitions (hiding → seeking)
  - Update timers
  - Handle game over
  
- **Player Management:**
  - Create local player
  - Manage remote players
  - Sync positions
  - Handle tagging

#### 5. Environment (`public/js/environment.js`)
- **3D World:**
  - Create indoor house structure
  - Add walls, ceiling, floor
  - Place furniture (tables, boxes, pillars)
  
- **Lighting:**
  - Ambient light
  - Directional light (sun)
  - Point lights in rooms
  - Shadow mapping

#### 6. Player System (`public/js/player.js`)
- **Character Model:**
  - Capsule body
  - Sphere head with eyes
  - Name label (sprite)
  
- **Properties:**
  - Position, rotation
  - Role (hider/seeker)
  - Found state
  - Movement speed

#### 7. Controls (`public/js/controls.js`)
- **Desktop:**
  - WASD for movement
  - Mouse for camera rotation
  - Space for tagging
  - M for mute
  - Pointer lock support
  
- **Mobile:**
  - Virtual joystick (left side)
  - Touch camera control (right side)
  - TAG button
  - Auto-detect mobile devices

#### 8. Network (`public/js/network.js`)
- **Socket.IO Events:**
  - `createRoom` / `joinRoom`
  - `playerReady` / `startGame`
  - `playerMove` (position sync)
  - `tagPlayer`
  - `signal` (WebRTC)

#### 9. Voice Chat (`public/js/voiceChat.js`)
- **WebRTC Setup:**
  - Request microphone access
  - Create SimplePeer connections
  - Handle signaling via Socket.IO
  
- **Features:**
  - Peer-to-peer audio
  - Audio level monitoring
  - Speaking indicators
  - Mute/unmute control

#### 10. UI Manager (`public/js/ui.js`)
- **Screens:**
  - Main menu
  - Lobby
  - Game screen
  - Game over
  
- **HUD Elements:**
  - Timer
  - Role badge
  - Player count
  - Phase messages

## Data Flow

### Room Creation Flow
```
Client → createRoom(name) → Server
Server → Generate room code
Server → Create room in GameManager
Server → Send roomCode back to Client
Server → Broadcast roomUpdate to room
```

### Game Start Flow
```
Host → startGame() → Server
Server → Validate (all ready, min players)
Server → Assign roles randomly
Server → Start hiding phase timer
Server → Broadcast gameStart to all
Clients → Create players in 3D scene
Clients → Initialize controls
Clients → Connect voice chat peers
Server → After 30s → Phase change to seeking
Server → Broadcast phaseChange
```

### Position Sync Flow
```
Client → Update local player position (60fps)
Client → Throttle network updates (20fps)
Client → Send playerMove to Server
Server → Forward to other players in room
Clients → Update remote player positions
```

### Tagging Flow
```
Seeker → Press TAG/Space
Client → Find closest hider within 5 units
Client → Send tagPlayer(hiderId) to Server
Server → Validate distance and role
Server → Mark hider as found
Server → Broadcast playerTagged
Server → Check if all hiders found
Server → If yes, broadcast gameOver
```

### Voice Chat Flow
```
Client A → Request mic access
Client A → Create local stream
Client A → Connect to peers via signaling
Client A → Send WebRTC signal → Server
Server → Forward signal → Client B
Client B → Receive signal
Client B → Create peer connection
Client B → Exchange ICE candidates
Clients → Establish P2P audio stream
```

## Performance Optimizations

1. **Position Updates:** Throttled to 20 updates/second
2. **Shadow Maps:** 2048x2048 resolution
3. **Pixel Ratio:** Capped at 2x for mobile
4. **Network:** Only send position when changed
5. **Three.js:** Frustum culling enabled
6. **WebRTC:** Echo cancellation and noise suppression

## Security Considerations

1. **No authentication:** For demo purposes only
2. **Room codes:** Not cryptographically secure
3. **Voice chat:** P2P, no recording server-side
4. **HTTPS required:** For WebRTC on mobile in production
5. **Input validation:** Basic checks on server

## Scalability

Current design supports:
- **Rooms:** Unlimited (memory-bound)
- **Players per room:** 8 (configurable)
- **Concurrent players:** Limited by server resources
- **Voice chat:** P2P, no server relay needed

For production:
- Add Redis for room state
- Use TURN server for WebRTC relay
- Implement rate limiting
- Add user authentication
- Use CDN for static assets

## Testing

Tested on:
- ✅ Chrome 120+ (Desktop/Android)
- ✅ Firefox 120+ (Desktop/Android)
- ✅ Safari 17+ (Desktop/iOS)
- ✅ Edge 120+ (Desktop)

Known limitations:
- WebRTC requires HTTPS in production
- Some ad blockers may block CDN libraries
- Mobile browsers may limit microphone access

## Future Enhancements

Possible additions:
- [ ] Spatial audio (volume based on distance)
- [ ] More complex 3D environments
- [ ] Character customization
- [ ] Power-ups and special abilities
- [ ] Spectator mode
- [ ] Replay system
- [ ] Leaderboards
- [ ] Multiple game modes
