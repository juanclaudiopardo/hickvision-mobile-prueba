// IP del servidor backend - cambiar segun el entorno
// En desarrollo local con emulador Android usar 10.0.2.2
// En desarrollo local con dispositivo fisico usar la IP de tu PC en la red local
// En iOS simulator usar localhost
export const SERVER_IP = '192.168.0.149'; // IP local de tu Mac

export const API_BASE_URL = `http://${SERVER_IP}:3000`;
export const SOCKET_URL = `http://${SERVER_IP}:3000`;
export const SIP_WS_URL = `ws://${SERVER_IP}:8088/ws`;
export const SIP_URI = `sip:webrtc@${SERVER_IP}`;
export const SIP_PASSWORD = 'webrtc123';
export const STUN_SERVER = 'stun:stun.l.google.com:19302';
export const RTSP_URL = `rtsp://admin:German9876@192.168.1.36:554/Streaming/Channels/101`;
