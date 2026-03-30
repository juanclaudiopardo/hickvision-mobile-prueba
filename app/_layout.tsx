import { registerGlobals } from '@stream-io/react-native-webrtc';
import { Stack } from "expo-router";

// Registrar APIs WebRTC globalmente para que JsSIP las encuentre
registerGlobals();

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }} />
  );
}
