# Hikvision SIP - Mobile App

App mobile React Native (Expo SDK 54) para controlar intercomunicadores Hikvision via SIP/WebRTC.

## Requisitos

- Node.js 18+
- Expo CLI
- Docker Desktop (para el backend)
- Dispositivo Android/iOS con dev client (NO funciona con Expo Go)

## Paquetes instalados

```bash
# Build nativo (necesario por react-native-webrtc)
npx expo install expo-dev-client

# WebRTC - fork de Stream (soporta New Architecture)
npm install @stream-io/react-native-webrtc@137.1.2
npx expo install @config-plugins/react-native-webrtc

# SIP sobre WebSocket
npm install jssip

# Conexion con backend
npm install socket.io-client

# Audio (ringtones, tonos)
npx expo install expo-audio

# Video RTSP - WebView + JSMpeg
npx expo install react-native-webview

# Audio routing para llamadas (speaker/earpiece)
npm install react-native-incall-manager
```

**Nota:** `react-native-incall-manager` y `@stream-io/react-native-webrtc` son nativos, requieren rebuild del dev client despues de instalar.

## Levantar el proyecto

### 1. Backend (Docker)

```bash
cd /Users/juanpardo/Desktop/hikvision_cam_sip
docker compose up -d postgres redis asterisk sdk-bridge api-server
```

Verificar: `curl http://localhost:3000/health`

### 2. Configurar IP

Editar `src/config/constants.ts` y poner la IP de tu Mac en la red:

```typescript
export const SERVER_IP = '192.168.0.163'; // cambiar segun tu red
```

### 3. App mobile

```bash
npx expo start
```

Escanear QR con el dev client instalado en el celular.

## Estructura

```
src/
  config/constants.ts     - IPs, URLs, credenciales SIP
  types/index.ts          - Tipos TypeScript
  services/api.ts         - Cliente REST para el backend
  services/socket.ts      - Socket.IO singleton
  hooks/useSIP.ts         - Senalizacion SIP via Socket.IO
  hooks/useWebRTC.ts      - Audio/video via JsSIP + WebRTC nativo
  hooks/useRTSP.ts        - Stream RTSP via WebView
  components/CallModal.tsx       - Modal para iniciar llamada
  components/IncomingCallModal.tsx - Modal llamada entrante
  components/RTSPPlayer.tsx      - Player video RTSP
  components/CallHistory.tsx     - Historial estatico
  context/WebRTCContext.tsx      - Context global WebRTC (un solo UA)
app/
  _layout.tsx             - Layout raiz + WebRTCProvider
  index.tsx               - Dashboard principal
  call.tsx                - Pantalla de llamada activa
```

## Apagar backend

```bash
docker compose -f /Users/juanpardo/Desktop/hikvision_cam_sip/docker-compose.yml down
```
