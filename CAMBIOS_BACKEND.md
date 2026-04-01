# Cambios realizados en el Backend (hikvision_cam_sip)

Documento con todos los cambios que se hicieron en la configuracion del backend para que funcione con el dispositivo Hikvision real en la oficina.

## Datos del dispositivo

- **IP Hikvision:** `192.168.0.243`
- **IP Mac (backend):** `192.168.0.163`
- **Credenciales dispositivo:** `admin` / `German987`
- **El dispositivo se registra como usuario SIP:** `200`

---

## 1. docker-compose.yml

Cambios en el servicio `api-server`:

```yaml
- INTERCOM_IP=192.168.0.243    # antes: 192.168.1.36
- INTERCOM_PASSWORD=German987   # antes: German9876
```

## 2. .env

```
INTERCOM_IP=192.168.0.243      # antes: 192.168.0.103
INTERCOM_PASSWORD=German987     # antes: German9876
```

## 3. config/asterisk-pjsip.conf

### Transportes - NAT fix para Docker

Todos los transportes (udp, tcp, ws, wss) necesitan `external_media_address` para que Asterisk ponga la IP correcta en el SDP cuando esta dentro de Docker:

```ini
[transport-udp]
type=transport
protocol=udp
bind=0.0.0.0:5060
external_media_address=192.168.0.163    # IP del Mac en la red
external_signaling_address=192.168.0.163
local_net=172.25.0.0/16                 # red interna Docker

[transport-tcp]
; idem

[transport-ws]
; idem con local_net=172.25.0.0/16 y 192.168.65.0/24

[transport-wss]
; idem
```

**IMPORTANTE:** En `transport-udp` NO poner `192.168.65.0/24` en `local_net` porque el Hikvision llega por esa IP (Docker gateway) y Asterisk no aplicaria el `external_media_address`. Sin esto, el audio del Hikvision al celular NO funciona.

### Endpoint hikvision (existente, modificado)

```ini
[hikvision]
type=endpoint
transport=transport-udp
context=intercom
aors=hikvision,200              # agregado ",200"
auth=hikvision                  # agregado (antes no tenia)
from_user=admin
; ... resto igual

[hikvision]
type=auth
auth_type=userpass
password=German987               # antes: German9876
username=200                     # antes: hikvision (el dispositivo se registra como 200)

[hikvision]
type=aor
contact=sip:hikvision@192.168.0.243:5060    # antes: 192.168.1.36
max_contacts=5                   # agregado (antes no tenia, era 0)
remove_existing=yes              # agregado
qualify_frequency=60

[hikvision]
type=identify
endpoint=hikvision
match=192.168.0.243              # antes: 192.168.1.36
match=192.168.65.1               # agregado (Docker gateway IP)
match=172.64.66.1
```

### Endpoint 200 (NUEVO)

El Hikvision se registra como usuario `200`, necesita su propio endpoint:

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

## 4. config/asterisk-extensions.conf

### Variables globales

```ini
[globals]
INTERCOM_IP=192.168.0.243       # antes: 192.168.1.36
SERVER_IP=192.168.0.243          # antes: 192.168.1.36
```

### Contexto mobile - extension 200 (simplificado)

Antes tenia 30 lineas con multiples intentos de destino. Ahora:

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

**Nota:** Se quito el `Answer()` antes del `Dial()` porque el Hikvision debe contestar, no Asterisk.

---

## Configuracion del dispositivo Hikvision

En la web del Hikvision (`http://192.168.0.243`), ir a:
**System Configuration > Network > Device Access > VoIP**

| Campo | Valor |
|-------|-------|
| Enable VoIP Gateway | ON |
| Register User Name | `200` |
| Registration Password | `German987` |
| Server IP Address | `192.168.0.163` (IP del Mac) |
| Server Port | `5060` |
| Number | `200` |
| Display User Name | `Portero` |
| Center No. | `200` |

Despues de guardar, el Registration Status debe decir **Registered**.

---

## Resumen de IPs a cambiar si se mueve de red

Si cambia la red (otra oficina, otra IP), hay que actualizar:

1. `docker-compose.yml` -> `INTERCOM_IP`
2. `.env` -> `INTERCOM_IP`
3. `config/asterisk-extensions.conf` -> `[globals]` INTERCOM_IP y SERVER_IP
4. `config/asterisk-pjsip.conf` -> `external_media_address` y `external_signaling_address` en todos los transportes
5. `config/asterisk-pjsip.conf` -> contact del AOR hikvision, match del identify
6. En la app mobile -> `src/config/constants.ts` -> SERVER_IP
7. En el Hikvision -> VoIP -> Server IP Address

Despues de cambiar, reiniciar Asterisk: `docker compose restart asterisk`
