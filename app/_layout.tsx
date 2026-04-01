import { registerGlobals } from '@stream-io/react-native-webrtc';
import { Stack } from "expo-router";
import { WebRTCProvider } from '../src/context/WebRTCContext';

// Registrar APIs WebRTC globalmente para que JsSIP las encuentre
registerGlobals();

export default function RootLayout() {
  return (
    <WebRTCProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </WebRTCProvider>
  );
}
