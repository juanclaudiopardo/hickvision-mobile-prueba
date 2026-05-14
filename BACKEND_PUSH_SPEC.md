# Spec backend: VoIP Push (Android / FCM) — Fase 1

> Para: Lucas
> Repo: `hikvision_cam_sip`
> Alcance: solo Android. iOS (PushKit/APNs) viene en una segunda fase.
> Objetivo: que cuando entre una llamada del portero, api-server dispare un push FCM al/los celular(es) registrado(s), aunque la app esté matada.

---

## Contexto

Hoy `api-server` emite `call:incoming` por Socket.IO cuando:
1. ISUP recibe el evento de la Hikvision (`source: 'isup'`)
2. SIP-INVITE entrante de Asterisk (`source: 'sip'`)

El cliente móvil solo recibe ese evento si Socket.IO está conectado, y solo lo está mientras la app está abierta. Para llamadas con la app cerrada, necesitamos un push del SO (FCM en Android) que despierte el celular y dispare la UI nativa de llamada (ConnectionService vía `react-native-callkeep`).

**El front se encarga** de: registrar el token, levantar la UI nativa al recibir el push, conectar Socket.IO/SIP cuando el usuario contesta, y disparar el accept normal del flow actual.

**El backend se encarga** (esta spec) de: guardar tokens, mandar el push FCM al detectar llamada entrante.

---

## 1. Dependencias

```bash
cd server
npm install firebase-admin
```

---

## 2. Credenciales y env vars

**Archivo de credenciales:** `secrets/fcm-service-account.json` (ya está en el repo, en `.gitignore`).

**Volume en `docker-compose.yml`** (servicio `api-server`):
```yaml
volumes:
  - ./server:/app
  - /app/node_modules
  - api_logs:/app/logs
  - ./secrets:/app/secrets:ro   # ← agregar
```

**Env vars nuevas en `docker-compose.yml`** (servicio `api-server`, dentro de `environment`):
```yaml
- FCM_SERVICE_ACCOUNT_PATH=/app/secrets/fcm-service-account.json
- FCM_ENABLED=true
```

Y replicar las mismas en `.env` (local dev sin Docker, opcional).

---

## 3. Modelo / tabla Postgres

Migración nueva (Sequelize, Knex, lo que use el repo — ya hay otros modelos como referencia):

```sql
CREATE TABLE device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL DEFAULT 'default',         -- por ahora un usuario único; multi-user después
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  token TEXT NOT NULL UNIQUE,
  package_name TEXT NOT NULL,                      -- bundle ID / applicationId
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_device_tokens_platform ON device_tokens(platform);
CREATE INDEX idx_device_tokens_user_id ON device_tokens(user_id);
```

---

## 4. Endpoints REST

### 4.1 `POST /api/devices/register`

Registrar (o actualizar) un token de un dispositivo.

**Request body:**
```json
{
  "platform": "android",
  "token": "fcm-registration-token-aqui",
  "packageName": "com.simplesolutions.hikvision.test"
}
```

**Comportamiento:** upsert por `token` (si ya existe, actualizar `updated_at` y `package_name`). Si no, insertar.

**Response 200:**
```json
{ "ok": true, "id": "uuid-del-row" }
```

### 4.2 `DELETE /api/devices/:token`

Borrar token (al desloguear o cuando FCM nos avisa que es inválido).

**Response 200:** `{ "ok": true }`

### 4.3 `POST /api/devices/test-push`

Endpoint **de debug** para mandar un push fake sin tener que tocar el portero. Útil mientras se desarrolla.

**Request body (opcional):**
```json
{ "callerName": "Test Portero" }
```

**Comportamiento:** llamar a `pushService.sendIncomingCallPush({ callId: 'test-' + Date.now(), source: 'test', callerName: req.body.callerName || 'Test', callerNumber: '999' })`.

**Response 200:** `{ "ok": true, "sentTo": <count> }`

---

## 5. Servicio de push (`server/src/services/pushService.ts`)

Estructura sugerida:

```typescript
import * as admin from 'firebase-admin';
import { DeviceTokenModel } from '../models/deviceToken';

let initialized = false;

function initFirebaseAdmin() {
  if (initialized) return;
  if (process.env.FCM_ENABLED !== 'true') return;

  const serviceAccount = require(process.env.FCM_SERVICE_ACCOUNT_PATH!);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
  initialized = true;
}

export async function sendIncomingCallPush(payload: {
  callId: string;
  source: 'isup' | 'sip' | 'test';
  callerName: string;
  callerNumber: string;
}) {
  initFirebaseAdmin();
  if (!initialized) return { sent: 0, errors: [] };

  // Por ahora, mandar a TODOS los Android tokens (single-user)
  const tokens = await DeviceTokenModel.findAll({ where: { platform: 'android' } });
  if (tokens.length === 0) return { sent: 0, errors: [] };

  const message: admin.messaging.MulticastMessage = {
    tokens: tokens.map(t => t.token),
    data: {
      type: 'incoming_call',
      callId: payload.callId,
      source: payload.source,
      callerName: payload.callerName,
      callerNumber: payload.callerNumber,
      timestamp: String(Date.now()),
    },
    android: {
      priority: 'high',          // CRÍTICO: bypassa Doze, entrega inmediata
      ttl: 30 * 1000,            // 30s. Si no llega en 30s, no sirve más.
    },
  };

  const result = await admin.messaging().sendEachForMulticast(message);

  // Limpiar tokens inválidos
  const invalidTokens: string[] = [];
  result.responses.forEach((res, idx) => {
    if (!res.success) {
      const code = res.error?.code;
      if (code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-argument') {
        invalidTokens.push(tokens[idx].token);
      }
    }
  });
  if (invalidTokens.length) {
    await DeviceTokenModel.destroy({ where: { token: invalidTokens } });
  }

  return { sent: result.successCount, errors: invalidTokens };
}
```

**Detalles que IMPORTAN:**

1. **`data` only, sin `notification`.** Si mandás bloque `notification`, FCM lo trata como notificación visible y la app NO recibe el handler en background. Solo `data` permite que `react-native-firebase/messaging` invoque `setBackgroundMessageHandler` con la app cerrada.

2. **`priority: 'high'`.** Sin esto, Android Doze puede demorar el mensaje horas. Para llamadas es obligatorio.

3. **`ttl: 30000`.** Si la red se cae 30s, no tiene sentido entregar la llamada después.

4. **Limpieza de tokens inválidos.** Cuando un usuario desinstala la app o reinstala, FCM devuelve `registration-token-not-registered` → borrar el row.

5. **Multi-cast.** `sendEachForMulticast` permite mandar a varios tokens en una request (un usuario con varios dispositivos, o varios usuarios después).

---

## 6. Integración con el flow existente

Donde hoy `api-server` emite `call:incoming` por Socket.IO, agregar **antes** del emit:

```typescript
import { sendIncomingCallPush } from './services/pushService';

// ... cuando llega ISUP event o SIP INVITE ...
await sendIncomingCallPush({
  callId,
  source: 'isup',           // o 'sip'
  callerName: 'Portero',
  callerNumber: '200',
}).catch(err => logger.error('FCM push failed', err));

io.emit('call:incoming', { ... });   // emit existente
```

**Importante:** el push y el emit van en paralelo, no es uno o el otro. Si la app está abierta, recibe el Socket.IO igual y la UI normal funciona; si está cerrada, solo le llega el push.

**Tampoco bloquees el flow si FCM falla.** El `.catch` es a propósito.

---

## 7. Aceptación / rechazo desde la UI nativa

**No hay endpoints nuevos.** El front, cuando el usuario aprete "Contestar" en la UI nativa de llamada:

1. Si la app estaba matada, arranca y conecta Socket.IO + SIP-WS normalmente.
2. Una vez conectado, dispara el accept usando los endpoints YA EXISTENTES:
   - ISUP → `POST /api/isup/calls/:id/accept`
   - SIP → `socket.emit('call:answer', { callId })`

Lo único que el backend tiene que asegurar: **que el call siga vivo en Asterisk durante el tiempo que tarda el celular en abrir la app y conectar SIP** (puede ser 5-10 segundos en cold start).

Hoy el INVITE de la Hikvision tiene timeout default ~32s, lo cual da margen. Verificar que ese timeout sea suficiente. Si fuera corto, ajustar en el dialplan.

---

## 8. Testing del backend (sin app)

Para verificar que el push se manda OK antes de tener la app andando:

```bash
# 1. Arrancar el stack
docker compose up -d

# 2. Registrar un token fake (desde curl)
curl -X POST http://localhost:3000/api/devices/register \
  -H "Content-Type: application/json" \
  -d '{"platform":"android","token":"fake-token-de-test","packageName":"com.simplesolutions.hikvision.test"}'

# 3. Mandar un test push
curl -X POST http://localhost:3000/api/devices/test-push \
  -H "Content-Type: application/json" \
  -d '{"callerName":"Test"}'

# Esperado: response { ok: true, sentTo: 1 } y luego en logs el error de "registration-token-not-registered" (porque el token es fake) → el row se borra de la tabla.
```

Cuando el front tenga el FCM token real, el test push debería llegar al celular.

---

## 9. Checklist de entregables

- [ ] `firebase-admin` agregado a `server/package.json`
- [ ] `secrets/fcm-service-account.json` montado como volume en `docker-compose.yml`
- [ ] Env vars `FCM_SERVICE_ACCOUNT_PATH` y `FCM_ENABLED` en `docker-compose.yml`
- [ ] Migración para tabla `device_tokens`
- [ ] Modelo / repo del lado del ORM
- [ ] Endpoint `POST /api/devices/register`
- [ ] Endpoint `DELETE /api/devices/:token`
- [ ] Endpoint `POST /api/devices/test-push`
- [ ] Servicio `pushService.sendIncomingCallPush(...)`
- [ ] Integración: llamada al servicio antes de cada `call:incoming` (ISUP y SIP)
- [ ] Limpieza de tokens inválidos en respuesta de FCM
- [ ] Probado con el curl de test push (logs muestran intento + cleanup)

---

## 10. Lo que NO entra en esta fase

- iOS / APNs / PushKit (viene después, requiere `.p8` del Apple Developer)
- Multi-usuario (por ahora `user_id = 'default'`)
- Auth en los endpoints `/api/devices/*` (LAN-only, igual que el resto del proyecto)
- Persistencia del estado de la llamada para "ringback" si la app se conecta tarde (asumimos que el INVITE de Asterisk tiene tiempo suficiente)
