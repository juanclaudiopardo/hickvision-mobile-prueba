import { registerGlobals } from '@stream-io/react-native-webrtc';
import { Stack, router } from 'expo-router';
import { useEffect } from 'react';
import { WebRTCProvider } from '../src/context/WebRTCContext';
import {
  setupCallKeep,
  setCallKeepHandlers,
  endIncomingCall,
  registerBackgroundEventHandler,
} from '../src/services/callKeep';
import {
  initVoipPush,
  registerBackgroundMessageHandler,
} from '../src/services/voipPush';

// Registrar APIs WebRTC globalmente para que JsSIP las encuentre
registerGlobals();

// Background/quit handlers — DEBEN estar a nivel de modulo (fuera de cualquier
// componente). Asi RN los encuentra cuando despierta la app desde un push con
// la app matada, o cuando el usuario toca un boton de la notificacion estando
// la app en background.
registerBackgroundMessageHandler();
registerBackgroundEventHandler();

export default function RootLayout() {
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await setupCallKeep();
        if (cancelled) return;
        await initVoipPush();
      } catch (err) {
        console.error('[Layout] init push/callkeep failed:', err);
      }
    })();

    setCallKeepHandlers({
      onAnswer: (callId) => {
        // El usuario apreto Contestar en la UI nativa.
        // Navegamos a /call con el callId; la pantalla de llamada hace el accept
        // contra Socket.IO/REST cuando este lista.
        router.push({ pathname: '/call', params: { callId, autoAccept: '1' } });
      },
      onReject: (callId) => {
        // El usuario apreto Rechazar en la UI nativa. La logica de rechazo
        // contra el backend la dispara la pantalla /call cuando puede;
        // aca solo limpiamos la UI nativa.
        endIncomingCall(callId);
      },
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <WebRTCProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </WebRTCProvider>
  );
}
