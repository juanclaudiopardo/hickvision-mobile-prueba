# Dependencias Mobile - React Native / Expo

## Paquetes instalados

| Paquete | Version instalada | Tipo | Repo |
|---|---|---|---|
| `@stream-io/react-native-webrtc` | 137.1.2 | Fork WebRTC (soporta New Arch) | https://github.com/nickolasg/react-native-webrtc (repo de Stream) |
| `@config-plugins/react-native-webrtc` | 13.0.0 | Config plugin para Expo | https://github.com/expo/config-plugins/tree/main/packages/react-native-webrtc |
| `jssip` | 3.13.6 | SIP sobre WebSocket (JS puro) | https://github.com/nickolasg/jssip |
| `socket.io-client` | 4.8.3 | WebSocket con backend (JS puro) | https://github.com/socketio/socket.io-client |
| `expo-audio` | (version de SDK 54) | Audio: ringtones, tonos | https://github.com/expo/expo/tree/main/packages/expo-audio |
| `react-native-webview` | (version de SDK 54) | WebView para video RTSP/JSMpeg | https://github.com/nickolasg/react-native-webview |
| `expo-dev-client` | (version de SDK 54) | Build nativo (reemplaza Expo Go) | https://github.com/expo/expo/tree/main/packages/expo-dev-client |

---

## Guia de actualizacion cuando Expo sube de SDK

Cada 4-6 meses Expo lanza un nuevo SDK. Cuando actualices (ej: SDK 54 -> 55 -> 56), segui estos pasos:

### 1. Paquetes Expo (se actualizan solos)

Estos se actualizan automaticamente con `npx expo install --fix`:

```bash
npx expo install --fix
```

Esto actualiza: `expo-audio`, `expo-dev-client`, `react-native-webview`

### 2. @stream-io/react-native-webrtc (REVISAR MANUAL)

Este es el paquete critico. No se actualiza con `expo install --fix`.

**Donde buscar la version compatible:**
- npm: https://www.npmjs.com/package/@stream-io/react-native-webrtc
- GitHub releases: https://github.com/nickolasg/react-native-webrtc/releases
- Changelog de Stream: https://getstream.io/video/docs/react-native/setup/installation/

**Que buscar en Google:**
```
@stream-io/react-native-webrtc expo sdk [NUMERO_DE_SDK] compatibility
```
```
@stream-io/react-native-webrtc react native [VERSION_RN] support
```

**Tabla de referencia Expo SDK -> React Native:**

| Expo SDK | React Native |
|---|---|
| 54 | 0.81 |
| 55 | 0.83 (New Arch obligatoria, no se puede desactivar) |

**IMPORTANTE SDK 55+:** A partir de SDK 55, New Architecture es OBLIGATORIA. El fork de Stream ya lo soporta, pero siempre verificar que la version que instales siga siendo compatible.

### 3. @config-plugins/react-native-webrtc (REVISAR MANUAL)

Debe coincidir con la version de Expo SDK.

**Tabla de versiones conocidas:**

| Expo SDK | Config Plugin Version |
|---|---|
| 53 | 12.0.0 |
| 54 | 13.0.0 |
| 55 | 14.0.0 |

**Donde buscar:**
- https://github.com/expo/config-plugins/tree/main/packages/react-native-webrtc
- https://www.npmjs.com/package/@config-plugins/react-native-webrtc

### 4. jssip (JS puro, bajo riesgo)

```bash
npm info jssip version
npm update jssip
```

No depende de la version de Expo/RN. Actualizar libremente.

### 5. socket.io-client (JS puro, bajo riesgo)

```bash
npm info socket.io-client version
npm update socket.io-client
```

No depende de la version de Expo/RN. Solo asegurar que la version major coincida con la del servidor (`socket.io` en el backend).

---

## Checklist de upgrade

Cuando actualices Expo SDK, seguir en este orden:

- [ ] Leer el changelog de Expo para el nuevo SDK
- [ ] `npx expo install --fix` (actualiza paquetes Expo)
- [ ] Buscar version compatible de `@stream-io/react-native-webrtc`
- [ ] Buscar version compatible de `@config-plugins/react-native-webrtc`
- [ ] `npm update jssip socket.io-client`
- [ ] `npx expo prebuild --clean`
- [ ] Testear videollamada SIP
- [ ] Testear video RTSP (WebView + JSMpeg)
- [ ] Testear audio (ringtones)

---

## Alternativa: si @stream-io/react-native-webrtc deja de mantenerse

Verificar primero si el **original** ya soporta New Architecture:
- https://github.com/react-native-webrtc/react-native-webrtc/issues/1557

Si el issue esta cerrado y merged, podes volver al original:
```bash
npm uninstall @stream-io/react-native-webrtc
npm install react-native-webrtc
```

La API es identica, solo cambia el nombre del paquete.

---

## Arquitectura del video RTSP en mobile

```
Hikvision Camera
    |
    | RTSP (rtsp://admin:xxx@192.168.1.36:554/Streaming/Channels/101)
    v
Backend Node.js (rtsp-server.js)
    |
    | ffmpeg transcodea RTSP -> MPEG-TS
    v
WebSocket (ws://servidor:9999/stream)
    |
    v
React Native WebView
    |
    | JSMpeg (JavaScript MPEG decoder)
    v
Canvas (video renderizado)
```

No depende de ningun modulo nativo de video. Si el WebView funciona, el video funciona.
