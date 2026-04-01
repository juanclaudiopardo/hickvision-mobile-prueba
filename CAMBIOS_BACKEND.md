# Cambios realizados en el Backend (hikvision_cam_sip)

Todos los cambios hechos en la config del backend para que funcione con el Hikvision real.

## Datos del dispositivo

- **IP Hikvision:** `192.168.0.243`
- **IP Mac (backend):** `192.168.0.163`
- **Credenciales dispositivo:** `admin` / `German987` (NO German9876)
- **El dispositivo se registra como usuario SIP:** `200`

---

## 1. docker-compose.yml

Cambios en el servicio `api-server`:

```yaml
- INTERCOM_IP=192.168.0.243    # antes: 192.168.1.36
- INTERCOM_PASSWORD=German987   # antes: German9876
- ASTERISK_HOST=asterisk        # sin cambios
```

Asterisk mantiene configuracion normal con ports y networks (NO usar network_mode: host en Mac).

## 2. .env

```
INTERCOM_IP=192.168.0.243      # antes: 192.168.0.103
INTERCOM_PASSWORD=German987     # antes: German9876
```

## 3. config/asterisk-pjsip.conf

### Transportes - NAT fix para Docker

Solo el transporte UDP necesita external_media_address (para que el audio del Hikvision llegue al celular):

```ini
[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5060
external_media_address=192.168.0.163    # IP del Mac en la red
external_signaling_address=192.168.0.163
local_net=172.25.0.0/16                 # red interna Docker SOLAMENTE
```

**IMPORTANTE:** En transport-udp NO poner `192.168.65.0/24` en `local_net`. Si se pone, Asterisk no aplica external_media_address para el Hikvision y el audio de vuelta no funciona.

Los transportes TCP, WS y WSS NO tienen external_media_address ni local_net (se limpiaron).

### Endpoint hikvision (existente, modificado)

```ini
[hikvision]
type=endpoint
transport=transport-udp
context=intercom
aors=hikvision,200              # agregado ",200"
auth=hikvision                  # agregado
from_user=admin
; ... resto igual

[hikvision]
type=auth
auth_type=userpass
password=German987               # antes: German9876
username=200                     # antes: hikvision

[hikvision]
type=aor
contact=sip:hikvision@192.168.0.243:5060    # antes: 192.168.1.36
max_contacts=5                   # agregado
remove_existing=yes              # agregado
qualify_frequency=60

[hikvision]
type=identify
endpoint=hikvision
match=192.168.0.243              # antes: 192.168.1.36
match=192.168.65.1               # agregado (Docker gateway)
match=172.64.66.1
```

### Endpoint 200 (NUEVO - necesario para registro SIP del Hikvision)

```ini
[200]
type=endpoint
transport=transport-udp
context=intercom
aors=200
auth=200
disallow=all
allow=ulaw
allow=alaw
allow=g722
allow=opus
direct_media=no
force_rport=yes
rewrite_contact=yes
rtp_symmetric=yes
use_avpf=no
ice_support=no
dtmf_mode=rfc4733
timers=no

[200]
type=auth
auth_type=userpass
password=German987
username=200

[200]
type=aor
max_contacts=5
remove_existing=yes
qualify_frequency=60
```

### Endpoint webrtc (sin cambios significativos)

Se probo agregar `media_address=192.168.0.163` pero se removio. No tiene external_media_address.

## 4. config/asterisk-extensions.conf

### Variables globales

```ini
[globals]
INTERCOM_IP=192.168.0.243       # antes: 192.168.1.36
SERVER_IP=192.168.0.243          # antes: 192.168.1.36
```

### Contexto intercom - extension 300 (NUEVA)

Para recibir llamadas entrantes del portero cuando aprietan el boton:

```ini
exten => 300,1,NoOp(Llamada entrante desde portero)
exten => 300,n,Dial(PJSIP/webrtc,30)
exten => 300,n,Hangup()
```

### Contexto mobile - extension 200 (simplificado)

Antes tenia 30 lineas con multiples intentos. Ahora:

```ini
exten => 200,1,NoOp(Llamada al portero Hikvision - usando contact registrado)
exten => 200,n,Set(CALLERID(name)=ManageCenter)
exten => 200,n,Set(CALLERID(num)=admin)
exten => 200,n,Dial(PJSIP/200,30)
exten => 200,n,Hangup()
```

### Contexto webrtc - extension 200 (simplificado)

Antes:
```ini
exten => 200,1,Answer()
exten => 200,n,Dial(PJSIP/hikvision/sip:hikvision@192.168.1.36:5060,30)
```

Ahora:
```ini
exten => 200,1,Dial(PJSIP/200,30)
exten => 200,n,Hangup()
```

**Nota:** Se quito el `Answer()` antes del `Dial()`. El Hikvision debe contestar, no Asterisk.

---

## Configuracion del dispositivo Hikvision

### VoIP (System Configuration > Network > Device Access > VoIP)

| Campo | Valor |
|-------|-------|
| Enable VoIP Gateway | ON |
| Register User Name | `200` |
| Registration Password | `German987` |
| Server IP Address | `192.168.0.163` (IP del Mac) |
| Server Port | `5060` |
| Number | `200` |
| Display User Name | `Portero` |
| Center No. | `300` |

### Video Intercom > Press Button to Call

| Campo | Valor |
|-------|-------|
| Call | **Call Center** (no Call Room) |
| Call Center | **Call VoIP Center** (no Call Management Center) |

---

## Estado actual de las llamadas

### Funciona:
- **Llamada saliente (app -> portero):** Audio bidireccional completo
- **Control de puerta:** Abrir/cerrar via ISAPI HTTP
- **Notificacion de llamada entrante:** Cuando aprietan el boton del portero, la app muestra el aviso

### No funciona (limitacion de Docker en Mac):
- **Contestar llamada entrante via WebRTC:** Asterisk manda INVITE al endpoint webrtc pero JsSIP no lo recibe porque el SDP contiene IPs internas de Docker (172.25.0.5). Esto NO se puede resolver en Docker Desktop para Mac.
- **Solucion en produccion:** En un servidor Linux, usar `network_mode: host` en el container de Asterisk. O instalar Asterisk nativamente (sin Docker).

---

## IPs a cambiar si se mueve de red

1. `docker-compose.yml` -> `INTERCOM_IP`
2. `.env` -> `INTERCOM_IP`
3. `config/asterisk-extensions.conf` -> `[globals]` INTERCOM_IP y SERVER_IP
4. `config/asterisk-pjsip.conf` -> `external_media_address` y `external_signaling_address` en transport-udp
5. `config/asterisk-pjsip.conf` -> contact del AOR hikvision, match del identify
6. App mobile -> `src/config/constants.ts` -> SERVER_IP
7. Hikvision web -> VoIP -> Server IP Address

Despues de cambiar, reiniciar: `docker compose restart asterisk` y Save+Refresh en el Hikvision VoIP.
