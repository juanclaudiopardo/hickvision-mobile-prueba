# Especificacion Mobile App - React Native (Expo SDK 54)

Replicar el frontend web del proyecto Hikvision SIP en una app mobile React Native.

---

## Paquetes a instalar

```bash
npx expo install expo-dev-client
npm install @stream-io/react-native-webrtc@137.1.2
npx expo install @config-plugins/react-native-webrtc
npm install jssip
npm install socket.io-client
npx expo install expo-audio
npx expo install react-native-webview
```

---

## Pantallas a replicar

### 1. Login (SKIP en desarrollo)

- NO implementar login por ahora
- La app arranca directo en el Dashboard
- Usuario hardcoded: `{ username: 'admin', name: 'Admin' }`
- TODO futuro: agregar pantalla de login con AsyncStorage

### 2. Dashboard (pantalla principal)

Tarjetas de acciones principales:

| Tarjeta           | Accion                                             |
| ----------------- | -------------------------------------------------- |
| Llamar al Portero | Abre modal de llamada (tipo voz)                   |
| Videollamada      | Abre modal de llamada (tipo video)                 |
| Conexion Directa  | Conecta RTSP para ver camara                       |
| Historial         | Muestra historial de llamadas (estatico por ahora) |
| Configuracion     | Placeholder, sin implementar                       |
| Control de Puerta | Botones abrir/cerrar puerta                        |

Secciones adicionales:

- **Llamadas entrantes**: Lista de llamadas incoming con botones contestar/rechazar
- **Estado del sistema**: Badges de conexion (SIP, WebRTC, Intercomunicador)
- **Monitor ISUP**: Estado del dispositivo Hikvision, eventos recientes (polling cada 5 seg)
- **Player RTSP**: Se muestra cuando hay conexion RTSP o llamada ISUP activa

### 3. CallScreen (durante llamada activa)

- Header: nombre del destino, tipo de llamada, duracion (MM:SS)
- Video: stream remoto (grande) + stream local (miniatura esquina)
- Si es solo voz: icono grande de telefono
- Controles:
  - Mute/Unmute audio
  - Activar/Desactivar video (solo en videollamadas)
  - Speaker (toggle visual)
  - Colgar (termina llamada, vuelve a Dashboard)

---

## Hooks a portar

### useSIP (señalizacion SIP via Socket.IO)

**Conexion**: Socket.IO a `http://[SERVER_IP]:3000`

**Estado**:

```
isConnected: boolean
currentCall: Call | null
incomingCalls: Call[]
```

**Tipo Call**:

```
{
  id: string
  target: string
  from?: string
  type: 'voice' | 'video'
  status: 'initiating' | 'ringing' | 'connected' | 'ended'
  source?: string
  startTime?: Date
  endTime?: Date
}
```

**Eventos Socket.IO que ESCUCHA**:

- `connect` → isConnected = true
- `disconnect` → isConnected = false
- `call:incoming` → agrega a incomingCalls
- `call:answered` → setea currentCall como connected, saca de incomingCalls
- `call:ended` → limpia currentCall
- `call:status` → actualiza status de currentCall
- `call:error` → log error

**Eventos Socket.IO que EMITE**:

- `call` → iniciar llamada: `{ from: 'mobile_user', to: target, context: 'mobile', type: 'voice'|'video', callId }`
- `call:answer` → contestar: `{ callId }`
- `call:end` → colgar: `{ callId }`

**Funciones**:

1. `initiateCall(target, isVideo)`:
   - Crea objeto Call con status='initiating'
   - Emite evento `call`
   - Timeout de 25 segundos si no se conecta
   - Si es video: POST `/api/rtsp/start` (falla silenciosamente si no hay RTSP)

2. `answerCall(callId)`:
   - Si es ISUP (source='isup' o id empieza con 'isup-'): POST `/api/isup/calls/{callId}/accept`
   - Si es SIP: emite `call:answer`
   - Setea currentCall status='connected'

3. `endCall(callId)`:
   - Emite `call:end`
   - Limpia currentCall despues de 1 segundo

### useWebRTC (audio/video via JsSIP + WebRTC)

**Configuracion JsSIP**:

- WebSocket: `ws://[SERVER_IP]:8088/ws`
- URI: `sip:webrtc@[SERVER_IP]`
- Password: `webrtc123`
- STUN: `stun:stun.l.google.com:19302`

**Estado**:

```
localStream: MediaStream | null
remoteStream: MediaStream | null
isVideoEnabled: boolean
isAudioEnabled: boolean
isConnected: boolean
isRegistered: boolean
```

**Diferencias con web**:

- En web usa `navigator.mediaDevices.getUserMedia()` → en RN usar API de `@stream-io/react-native-webrtc`
- En web usa `<video>` elements → en RN usar `<RTCView>` component
- Registrar globals WebRTC al inicio de la app:
  ```javascript
  import { registerGlobals } from '@stream-io/react-native-webrtc';
  registerGlobals();
  ```

**Funciones**:

1. `startCall(target, withVideo)`:
   - getUserMedia({ audio: true, video: withVideo })
   - Crea llamada via `ua.call('sip:{target}@{SERVER_IP}', options)`
   - Maneja eventos de session (progress, accepted, confirmed, ended, failed)
   - En `peerconnection` → setea ontrack para recibir stream remoto

2. `endCall()`:
   - session.terminate()
   - Detiene tracks de localStream y remoteStream

3. `toggleVideo()`:
   - localStream.getVideoTracks()[0].enabled = !enabled

4. `toggleAudio()`:
   - localStream.getAudioTracks()[0].enabled = !enabled

### useRTSP (video de camara Hikvision)

**Approach mobile**: WebView + JSMpeg (NO VLC ni player nativo)

**Flujo**:

1. POST `/api/rtsp/start` con `{ rtspUrl: "rtsp://admin:German9876@192.168.1.36:554/Streaming/Channels/101" }`
2. Recibe `{ wsUrl: "ws://[SERVER_IP]:9999/stream" }`
3. Renderiza un `<WebView>` con HTML inline que carga JSMpeg
4. JSMpeg se conecta al wsUrl y renderiza video en canvas

**Estado**:

```
isConnected: boolean
streamUrl: string
```

---

## Componentes a crear

### Header

- Logo + titulo "HIKVISION SIP"
- Si hay llamada activa: indicador verde/amarillo + "Llamada conectada con X" + boton colgar
- Info de usuario + boton logout

### CallModal

- Modal con seleccion de destino:
  - Presets: "1#1#1" (Piso 1 Videoportero 1), "200" (Extension Intercomunicador)
  - Input manual
- Selector tipo llamada: voz / video
- Botones: Cancelar, Llamar

### IncomingCallModal

- Modal centrado con icono de llamada
- Muestra: caller ID, tipo de llamada
- Botones: Rechazar (rojo), Contestar (verde)

### RTSPPlayer

- WebView con JSMpeg embebido
- Barra inferior: indicador conexion, URL, botones llamar/colgar
- Auto-muestra cuando hay llamada ISUP

### CallHistory

- Lista estatica de llamadas de ejemplo (no conectada al backend por ahora)
- Icono tipo llamada, destino, hora, duracion, estado

---

## API REST que consume la app

Servidor: `http://[SERVER_IP]:3000`

### Llamadas SIP

| Metodo | Endpoint                    | Body                            | Uso               |
| ------ | --------------------------- | ------------------------------- | ----------------- |
| POST   | `/api/calls/initiate`       | `{ from, to, context, callId }` | Iniciar llamada   |
| POST   | `/api/calls/:callId/hangup` | `{}`                            | Colgar llamada    |
| GET    | `/api/calls/:callId/status` | -                               | Estado de llamada |
| GET    | `/api/calls/active`         | -                               | Llamadas activas  |

### ISUP (Hikvision)

| Metodo | Endpoint                          | Body                     | Uso                                |
| ------ | --------------------------------- | ------------------------ | ---------------------------------- |
| GET    | `/api/isup/device/status`         | -                        | Estado dispositivo (polling 5 seg) |
| GET    | `/api/isup/events/recent?limit=8` | -                        | Eventos recientes                  |
| POST   | `/api/isup/calls/:callId/accept`  | `{ source: 'frontend' }` | Aceptar llamada ISUP               |
| POST   | `/api/isup/calls/:callId/hangup`  | `{}`                     | Colgar llamada ISUP                |

### RTSP

| Metodo | Endpoint           | Body          | Uso                    |
| ------ | ------------------ | ------------- | ---------------------- |
| POST   | `/api/rtsp/start`  | `{ rtspUrl }` | Iniciar stream         |
| GET    | `/api/rtsp/stream` | -             | Info del stream activo |
| POST   | `/api/rtsp/stop`   | `{}`          | Detener stream         |

### Puerta

| Metodo | Endpoint          | Body | Uso           |
| ------ | ----------------- | ---- | ------------- |
| POST   | `/api/door/open`  | `{}` | Abrir puerta  |
| POST   | `/api/door/close` | `{}` | Cerrar puerta |

### WebRTC Signaling (si se usa REST en vez de JsSIP directo)

| Metodo | Endpoint             | Body                       | Uso                  |
| ------ | -------------------- | -------------------------- | -------------------- |
| POST   | `/api/webrtc/offer`  | `{ sessionId, offer }`     | Enviar SDP offer     |
| POST   | `/api/webrtc/answer` | `{ sessionId, answer }`    | Enviar SDP answer    |
| POST   | `/api/webrtc/ice`    | `{ sessionId, candidate }` | Enviar ICE candidate |
| POST   | `/api/webrtc/hangup` | `{ sessionId }`            | Terminar sesion      |

### Estado general

| Metodo | Endpoint          | Uso                  |
| ------ | ----------------- | -------------------- |
| GET    | `/health`         | Salud del sistema    |
| GET    | `/api/sip/status` | Estado endpoints SIP |
| GET    | `/api/sip/peers`  | Peers registrados    |

---

## Eventos Socket.IO completos

### La app ESCUCHA estos eventos:

```
connect                    → Conexion establecida
disconnect                 → Conexion perdida
call:incoming              → Llamada entrante { id, from, target, type, status, source }
call:answered              → Llamada contestada { id, status, from, target, source }
call:ended                 → Llamada terminada (callId)
call:status                → Cambio de estado { id, status, channel }
call:error                 → Error { callId, action, error }
call:stateChanged          → Estado cambio { callId, state, channel }
sip:peerStatusChanged      → Peer SIP cambio { peer, status, isRegistered }
sip:registrationChanged    → Registro SIP cambio { username, status }
isup:status                → Estado ISUP cambio { enabled, mode, connected, activeCalls }
webrtc:offerProcessed      → Offer procesado { sessionId }
webrtc:answerProcessed     → Answer procesado { sessionId }
webrtc:sessionTerminated   → Sesion terminada { sessionId }
```

### La app EMITE estos eventos:

```
call                       → Iniciar llamada { from, to, context, type, callId }
call:answer                → Contestar llamada { callId }
call:end                   → Terminar llamada { callId }
```

---

## Mapeo Web → Mobile

| Web (browser)                           | Mobile (React Native)                               |
| --------------------------------------- | --------------------------------------------------- |
| `localStorage`                          | `AsyncStorage` o `expo-secure-store`                |
| `navigator.mediaDevices.getUserMedia()` | `@stream-io/react-native-webrtc` mediaDevices       |
| `<video>` element                       | `<RTCView>` component                               |
| JSMpeg en `<canvas>`                    | `<WebView>` con JSMpeg embebido                     |
| `react-router-dom`                      | `@react-navigation/native` + stack navigator        |
| `react-toastify`                        | `react-native-toast-message` o `expo-notifications` |
| Tailwind CSS                            | `StyleSheet.create()` o `nativewind`                |
| `axios`                                 | `axios` (funciona igual) o `fetch` nativo           |
| `lucide-react`                          | `lucide-react-native`                               |
| `simple-peer`                           | No se usa, JsSIP maneja WebRTC directo              |

---

## Estructura de archivos sugerida

```
mobile/
├── app.json                          # Config Expo con plugins
├── App.tsx                           # Entry point + Navigation
├── src/
│   ├── navigation/
│   │   └── AppNavigator.tsx          # Stack: Login → Dashboard → CallScreen
│   ├── screens/
│   │   ├── LoginScreen.tsx
│   │   ├── DashboardScreen.tsx
│   │   └── CallScreen.tsx
│   ├── components/
│   │   ├── Header.tsx
│   │   ├── CallModal.tsx
│   │   ├── IncomingCallModal.tsx
│   │   ├── RTSPPlayer.tsx            # WebView + JSMpeg
│   │   ├── CallHistory.tsx
│   │   └── DoorControl.tsx
│   ├── hooks/
│   │   ├── useSIP.ts                 # Socket.IO signaling
│   │   ├── useWebRTC.ts             # JsSIP + @stream-io/react-native-webrtc
│   │   └── useRTSP.ts              # WebView stream management
│   ├── services/
│   │   ├── api.ts                    # Axios instance con base URL
│   │   └── socket.ts                # Socket.IO singleton
│   ├── config/
│   │   └── constants.ts             # SERVER_IP, RTSP_URL, SIP config
│   └── types/
│       └── index.ts                  # Call, ISUPDeviceStatus, etc.
```

---

## Configuracion app.json

```json
{
  "expo": {
    "name": "Hikvision SIP",
    "slug": "hikvision-sip",
    "version": "1.0.0",
    "sdkVersion": "54.0.0",
    "platforms": ["ios", "android"],
    "plugins": [
      [
        "@config-plugins/react-native-webrtc",
        {
          "cameraPermission": "Permitir acceso a la camara para videollamadas.",
          "microphonePermission": "Permitir acceso al microfono para llamadas."
        }
      ],
      [
        "expo-audio",
        {
          "microphonePermission": "Permitir acceso al microfono para llamadas."
        }
      ]
    ],
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["audio", "voip"]
      }
    },
    "android": {
      "permissions": [
        "CAMERA",
        "RECORD_AUDIO",
        "INTERNET",
        "ACCESS_NETWORK_STATE"
      ]
    }
  }
}
```

---

## Constantes de conexion

```typescript
// config/constants.ts
export const SERVER_IP = '192.168.1.XX'; // IP del servidor backend
export const API_BASE_URL = `http://${SERVER_IP}:3000`;
export const SOCKET_URL = `http://${SERVER_IP}:3000`;
export const SIP_WS_URL = `ws://${SERVER_IP}:8088/ws`;
export const SIP_URI = `sip:webrtc@${SERVER_IP}`;
export const SIP_PASSWORD = 'webrtc123';
export const STUN_SERVER = 'stun:stun.l.google.com:19302';
export const RTSP_URL = `rtsp://admin:German9876@192.168.1.36:554/Streaming/Channels/101`;
```

---

## Orden de implementacion sugerido

1. Scaffold proyecto Expo + instalar dependencias + config plugins
2. Navegacion (Dashboard → CallScreen, sin login)
3. services/api.ts + services/socket.ts (conexion con backend)
4. Hook useSIP (Socket.IO signaling)
5. DashboardScreen basico (tarjetas + estado conexion)
6. IncomingCallModal + contestar/rechazar
7. CallModal + iniciar llamada
8. Hook useWebRTC (JsSIP + WebRTC nativo)
9. CallScreen (audio/video + controles)
10. RTSPPlayer (WebView + JSMpeg)
11. Control de puerta (abrir/cerrar)
12. Monitor ISUP (polling status + eventos)
13. Header con estado de llamada
14. CallHistory (estatico)
15. expo-audio (ringtones llamada entrante)
16. Testeo completo con Hikvision real

---

## Cosas que NO se replican (placeholders en web)

- Settings/Configuracion: no implementado en web
- Speaker toggle: solo visual en web, no cambia audio
- Call quality: hardcoded "Excelente" en web
- Call history real: datos estaticos en web
- Call recording: no implementado
- Screen sharing: no implementado
