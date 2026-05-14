import { getApp } from '@react-native-firebase/app';
import {
  AuthorizationStatus,
  FirebaseMessagingTypes,
  getMessaging,
  getToken,
  onMessage,
  onTokenRefresh,
  requestPermission,
  setBackgroundMessageHandler,
} from '@react-native-firebase/messaging';
import { Platform, PermissionsAndroid } from 'react-native';
import { displayIncomingCall, endIncomingCall } from './callKeep';
import { registerDevice } from './devices';

const PACKAGE_NAME = 'com.simplesolutions.hikvision.test';

let initialized = false;
let cachedToken: string | null = null;

const messaging = () => getMessaging(getApp());

export function getCachedFcmToken() {
  return cachedToken;
}

async function ensurePermissions() {
  if (Platform.OS !== 'android') return true;

  // Android 13+ runtime permission for notifications
  if (Platform.Version >= 33) {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
    );
    if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
      console.warn('[FCM] POST_NOTIFICATIONS denied');
      return false;
    }
  }

  // Modular API: requestPermission(messaging)
  const status = await requestPermission(messaging());
  return (
    status === AuthorizationStatus.AUTHORIZED ||
    status === AuthorizationStatus.PROVISIONAL
  );
}

function handleIncomingCallMessage(
  message: FirebaseMessagingTypes.RemoteMessage
) {
  const data = message?.data ?? {};
  if (data.type !== 'incoming_call') return;

  const callId = String(data.callId ?? '');
  if (!callId) return;

  const callerName = String(data.callerName ?? 'Llamada entrante');
  const callerNumber = String(data.callerNumber ?? '');

  console.log('[FCM] incoming_call', { callId, callerName });
  displayIncomingCall(callId, callerName, callerNumber);
}

function handleEndCallMessage(
  message: FirebaseMessagingTypes.RemoteMessage
) {
  const data = message?.data ?? {};
  if (data.type !== 'end_call') return;
  const callId = String(data.callId ?? '');
  if (!callId) return;
  console.log('[FCM] end_call', { callId });
  endIncomingCall(callId);
}

export async function initVoipPush() {
  if (initialized) return;
  if (Platform.OS !== 'android') return; // por ahora solo Android
  initialized = true;

  const ok = await ensurePermissions();
  if (!ok) return;

  try {
    const token = await getToken(messaging());
    cachedToken = token;
    console.log('[FCM] token:', token);

    try {
      await registerDevice({
        platform: 'android',
        token,
        packageName: PACKAGE_NAME,
      });
      console.log('[FCM] token registrado en backend');
    } catch (err) {
      console.warn('[FCM] no se pudo registrar token (backend listo?):', err);
    }
  } catch (err) {
    console.error('[FCM] error obteniendo token:', err);
  }

  onTokenRefresh(messaging(), async (newToken) => {
    cachedToken = newToken;
    console.log('[FCM] token refrescado');
    try {
      await registerDevice({
        platform: 'android',
        token: newToken,
        packageName: PACKAGE_NAME,
      });
    } catch (err) {
      console.warn('[FCM] error registrando token refrescado:', err);
    }
  });

  onMessage(messaging(), async (message) => {
    console.log('[FCM] foreground message:', message?.data);
    handleIncomingCallMessage(message);
    handleEndCallMessage(message);
  });
}

// Background/quit handler — DEBE registrarse a nivel de modulo, fuera de
// cualquier componente React. Se llama desde app/_layout.tsx (top-level).
export function registerBackgroundMessageHandler() {
  setBackgroundMessageHandler(messaging(), async (message) => {
    console.log('[FCM] background message:', message?.data);
    handleIncomingCallMessage(message);
    handleEndCallMessage(message);
  });
}
