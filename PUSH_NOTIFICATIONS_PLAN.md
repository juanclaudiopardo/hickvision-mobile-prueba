# Plan: llamadas entrantes con app cerrada (VoIP Push + CallKit)

Objetivo: que cuando entre una llamada del portero, el celular muestre la UI nativa de "llamada entrante" (tipo WhatsApp), incluso si la app está **matada** o el dispositivo en lockscreen.

Hoy las llamadas solo funcionan con la app abierta porque el único canal de señalización al cliente es Socket.IO, que se desconecta cuando la app se mata o entra en suspensión profunda.

---

## Pre-requisitos (bloqueantes)

| Item | Necesario para | Estado |
|---|---|---|
| Apple Developer Program (USD 99/año) | PushKit en iOS | ⬜ |
| Proyecto Firebase / FCM (gratis) | Push en Android | ⬜ |
| iPhone físico para testing | PushKit no anda en simulador | ⬜ |
| EAS configurado | Builds del dev client | ✅ (`eas.json` ya lo tiene) |

---

## Arquitectura objetivo

**Hoy:**
```
Hikvision → Asterisk/api-server → Socket.IO(call:incoming) → app foreground
```

**Después:**
```
Hikvision → Asterisk/api-server → VoIP push (APNs/FCM) → SO despierta el celular → CallKit/ConnectionService UI nativa
                                ↓ (en paralelo, si la app está viva)
                                 Socket.IO sigue funcionando para todo lo demás
```

**Idea clave:** el push solo despierta el dispositivo y dispara la UI nativa de llamada. Una vez que el usuario aprieta "Contestar", la app abre Socket.IO + SIP-WS normalmente y sigue el flujo de hoy (`/api/isup/calls/:id/accept` para ISUP, `call:answer` por Socket.IO para SIP).

---

## FASE 1 — Backend (`hikvision_cam_sip`)

Responsable: Lucas.

### 1.1 Tabla en Postgres

Modelo `device_tokens`:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | text | por ahora un usuario fijo, después multi-user |
| `platform` | enum `ios` / `android` | |
| `token` | text unique | VoIP token (iOS) o FCM token (Android) |
| `bundle_id` | text | bundle de la app (necesario para iOS) |
| `created_at`, `updated_at` | timestamp | |

### 1.2 Endpoints REST nuevos

- `POST /api/devices/register` — body `{ platform, token, bundleId }` → upsert por token
- `DELETE /api/devices/:token` — al desloguearse o al rotar token
- `POST /api/devices/test-push` — para debuggear sin tener que tocar el portero

### 1.3 Servicios de push en api-server

**APNs (iOS PushKit):**
- Lib: `@parse/node-apn` o `apns2`
- Auth key `.p8` generada en Apple Developer (Keys → "Apple Push Notifications service (APNs)")
- **OJO:** el push tiene que ser tipo `voip` (`pushType: 'voip'`, topic = `bundleId.voip`). Es un canal aparte del APNs común.

**FCM (Android):**
- Lib: `firebase-admin`
- Service account JSON descargado de Firebase console.

**Variables de entorno nuevas en `.env` y `docker-compose.yml`:**
```
APNS_KEY_PATH=/app/secrets/apns-voip.p8
APNS_KEY_ID=XXXXXXXXXX
APNS_TEAM_ID=YYYYYYYYYY
APNS_BUNDLE_ID=com.tuempresa.hikvision
FCM_SERVICE_ACCOUNT_PATH=/app/secrets/fcm-service-account.json
```

Y un volume nuevo: `./secrets:/app/secrets:ro`.

### 1.4 Trigger del push

Donde hoy api-server emite `call:incoming` por Socket.IO (tanto en flow ISUP como SIP), agregar **antes** del emit:

```js
await pushService.sendIncomingCallPush({
  callId,
  source,        // 'isup' | 'sip'
  callerName,    // 'Portero'
  callerNumber,  // '200'
});
```

**Payloads:**
- iOS (VoIP): `{ aps: { 'content-available': 1 }, callId, callerName, source }`
- Android (FCM data, **sin bloque `notification`**): `{ data: { callId, callerName, source, type: 'incoming_call' }, priority: 'high' }`

**Importante iOS:** la app **debe** llamar `CallKit.reportNewIncomingCall` dentro de los ~30s de recibir el push, **siempre**. Si no lo hace, Apple banea el cert. Esto es responsabilidad del front, pero el backend tiene que mandar el push **rápido** (sin retries con delay largo).

### 1.5 Tiempo de vida de la llamada

Confirmar/agregar:
- Timeout del INVITE entrante de la Hikvision (típicamente 30-60s)
- Si nadie contesta → CANCEL/timeout limpio + emitir `call:ended`
- La UI nativa de CallKit/ConnectionService respeta su propio timeout, pero el backend tiene que ser coherente.

---

## FASE 2 — Frontend: dependencias y rebuild del dev client

### 2.1 Instalar libs nativas

```bash
npm install @notifee/react-native @react-native-firebase/app @react-native-firebase/messaging
# iOS (cuando se sume) tambien:
# npm install react-native-callkeep react-native-voip-push-notification
```

| Lib | Plataforma | Para qué |
|---|---|---|
| `@notifee/react-native` | Android (y iOS basico) | UI de llamada entrante con full-screen intent. Reemplaza a `react-native-callkeep` en Android porque soporta New Architecture. |
| `@react-native-firebase/messaging` | Android | FCM (Firebase Cloud Messaging) |
| `@react-native-firebase/app` | Android | core de RNFirebase |
| `react-native-callkeep` | iOS (futuro) | CallKit. **NO usar en Android con New Arch** — tiene un bug de overloads en TurboModule. |
| `react-native-voip-push-notification` | iOS (futuro) | PushKit / VoIP push |

### 2.2 Config nativa (Expo plugins en `app.json` / `app.config.js`)

`react-native-callkeep` no tiene plugin oficial. Usar `expo-build-properties` + un config plugin custom (`withInfoPlist`, `withAndroidManifest`).

**iOS `Info.plist`:**
- `UIBackgroundModes`: `voip`, `audio`, `remote-notification`
- VoIP capability se setea en el provisioning profile (Apple Developer)

**Android `Manifest`:**
- `<service ... android:foregroundServiceType="phoneCall">`
- Permisos: `USE_FULL_SCREEN_INTENT`, `FOREGROUND_SERVICE_PHONE_CALL` (Android 14+)
- `BIND_TELECOM_CONNECTION_SERVICE`

### 2.3 Rebuild del dev client

```bash
eas build --profile development --platform ios
eas build --profile development --platform android
```

Hay que reinstalar el dev client en el celular después de esto.

---

## FASE 3 — Frontend: VoIP push handlers

Crear `src/services/voipPush.ts`:

- **iOS:**
  - `VoipPushNotification.addEventListener('register', token => POST /api/devices/register)`
  - `VoipPushNotification.addEventListener('notification', payload => RNCallKeep.displayIncomingCall(...))`
- **Android:**
  - `messaging().onMessage` y `setBackgroundMessageHandler` → `RNCallKeep.displayIncomingCall(...)`

Inicializarlo en `app/_layout.tsx` (al lado del `WebRTCProvider`).

**Punto crítico iOS:** el handler de PushKit corre **antes** de que la JS bundle esté lista a veces. Apple exige que `reportNewIncomingCall` se llame ya. `react-native-voip-push-notification` ofrece hooks (`onVoipNotificationCallerNameChanged`, etc.) para parchear el llamado nativo. Se configura una vez en `AppDelegate` (vía expo plugin) y después JS solo tiene que setear callbacks.

---

## FASE 4 — Frontend: integración con el flow existente

Crear `src/services/callKeep.ts` con listeners de CallKeep:

- `onAnswerCallAction`:
  - Navegar a `app/call.tsx`
  - Si Socket.IO no está conectado, esperar a que conecte (timeout 8s)
  - Disparar el accept (REST para ISUP, Socket.IO `call:answer` para SIP) — **misma lógica que `useSIP.acceptCall`**
- `onEndCallAction`: lo mismo con `call:end` o REST reject
- `onIncomingCallDisplayed`: empezar el ringtone (hoy lo hace `app/call.tsx`, mover a un servicio)

**Refactor en `useSIP.ts`:** extraer `acceptCall` / `endCall` a un servicio puro que se pueda llamar desde `callKeep.ts` también, no solo desde el componente.

**Punto sutil:** el `WebRTCContext` solo registra SIP cuando la app monta. Si vienen del CallKit con la app fría:
1. App monta normalmente → `WebRTCProvider` se inicia → JsSIP registra
2. En paralelo CallKit ya está mostrando "Llamada entrante"
3. Si el usuario aprieta contestar **antes** de que SIP registre, el callback tiene que esperar al `registered` event

Solución: agregar una promesa "SIP listo" en `WebRTCContext` que `callKeep.ts` pueda `await`.

---

## FASE 5 — Testing

Orden de pruebas (cada una valida una capa):

1. **Push tokens registrados:** abrir app, ver en `device_tokens` que aparezca un row.
2. **Push de prueba:** `POST /api/devices/test-push` → CallKit/ConnectionService aparece sin tocar el portero.
3. **App en background, no killed:** apretar botón portero → push llega → UI nativa → contestar → audio + video funciona.
4. **App killed:** matar app desde recientes → apretar portero → push despierta → contestar → app fría arranca y conecta SIP a tiempo.
5. **Modo no molestar / lockscreen:** validar que el push pasa por encima en iOS (PushKit lo hace) y por full-screen-intent en Android.
6. **Reject:** declinar desde la UI nativa → backend recibe `call:end` → Asterisk corta el INVITE.

---

## Resumen ejecutivo

### A Lucas (backend)

1. Tabla `device_tokens` + endpoints `POST /api/devices/register` y `DELETE /api/devices/:token`
2. Servicio APNs VoIP + FCM con credenciales por env vars
3. Disparar push en cada `call:incoming` (antes del emit Socket.IO)
4. Endpoint `POST /api/devices/test-push` para debug
5. Confirmar/configurar timeout del INVITE entrante en Asterisk

### Frontend

1. Instalar 4 libs nativas + plugins Expo
2. Rebuild dev client iOS + Android
3. Servicio `voipPush.ts` (registro + handler de push entrante)
4. Servicio `callKeep.ts` (UI nativa + answer/reject delegando al flow actual)
5. Refactor en `useSIP.ts` para extraer accept/end como funciones reusables
6. Promesa "SIP ready" en `WebRTCContext`

### Tiempos estimados

(Asumiendo cuenta Apple ya lista)

| Fase | Estimación |
|---|---|
| Backend (Fase 1) | 1 día |
| Frontend (Fases 2-4) | 1.5 días |
| Testing end-to-end (Fase 5) | 0.5 día |

Mucho del tiempo en frontend se va en builds EAS y debug nativo en device físico.

---

## Notas y referencias

- **Apple PushKit docs:** https://developer.apple.com/documentation/pushkit
- **CallKit docs:** https://developer.apple.com/documentation/callkit
- **Android ConnectionService:** https://developer.android.com/reference/android/telecom/ConnectionService
- **react-native-callkeep:** https://github.com/react-native-webrtc/react-native-callkeep
- **react-native-voip-push-notification:** https://github.com/react-native-webrtc/react-native-voip-push-notification
- **Banneo de Apple por no llamar `reportNewIncomingCall`:** desde iOS 13, si recibís un VoIP push y no reportás la llamada al sistema, Apple suspende el envío de futuros pushes a ese cert. Es estricto.
- **Android Doze mode:** FCM con `priority: high` rompe Doze para el mensaje, pero hay que mostrar el call screen rápido o el sistema te corta.
