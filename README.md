# Welcome to your Expo app 👋

This is an [Expo](https://expo.dev) project created with [`create-expo-app`](https://www.npmjs.com/package/create-expo-app).

## Get started

1. Install dependencies

   ```bash
   npm install
   ```

2. Start the app

   ```bash
   npx expo start
   ```

In the output, you'll find options to open the app in a

- [development build](https://docs.expo.dev/develop/development-builds/introduction/)
- [Android emulator](https://docs.expo.dev/workflow/android-studio-emulator/)
- [iOS simulator](https://docs.expo.dev/workflow/ios-simulator/)
- [Expo Go](https://expo.dev/go), a limited sandbox for trying out app development with Expo

You can start developing by editing the files inside the **app** directory. This project uses [file-based routing](https://docs.expo.dev/router/introduction).

## Get a fresh project

When you're ready, run:

```bash
npm run reset-project
```

This command will move the starter code to the **app-example** directory and create a blank **app** directory where you can start developing.

## Learn more

To learn more about developing your project with Expo, look at the following resources:

- [Expo documentation](https://docs.expo.dev/): Learn fundamentals, or go into advanced topics with our [guides](https://docs.expo.dev/guides).
- [Learn Expo tutorial](https://docs.expo.dev/tutorial/introduction/): Follow a step-by-step tutorial where you'll create a project that runs on Android, iOS, and the web.

## Join the community

Join our community of developers creating universal apps.

- [Expo on GitHub](https://github.com/expo/expo): View our open source platform and contribute.
- [Discord community](https://chat.expo.dev): Chat with Expo users and ask questions.

Solución final

Después de investigar a fondo, estos son los paquetes definitivos:

Paquetes a instalar

# 1. Build nativo (necesario por react-native-webrtc)

npx expo install expo-dev-client

# 2. WebRTC — usar el fork de Stream (soporta New Architecture)

npm install @stream-io/react-native-webrtc@137.1.2
npx expo install @config-plugins/react-native-webrtc

# 3. SIP sobre WebSocket

npm install jssip

# 4. Conexión con tu backend

npm install socket.io-client

# 5. Audio (ringtones, tonos)

npx expo install expo-audio

# 6. Video RTSP — WebView + JSMpeg (sin módulo nativo extra)

npx expo install react-native-webview

Por qué estos y no otros

┌────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐  
 │ Paquete │ Por qué este │
├────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ @stream-io/react-native-webrtc │ Fork del original que sí soporta New Architecture. Misma API que react-native-webrtc, drop-in replacement. Sobrevive a Expo SDK 55 (donde New Arch es │
│ │ obligatoria) │
├────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
 │ jssip │ Excelente mantenimiento (7 releases en 2026). JS puro, sin problemas │
├────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
 │ socket.io-client │ 63k stars, estándar de la industria. JS puro │
├────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
 │ expo-audio │ First-party Expo. Para ringtones y sonidos de la app │
├────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
 │ react-native-webview │ Para el video RTSP. Tu backend ya transcodea RTSP→MPEG via WebSocket. Metés JSMpeg en un WebView y listo — mismo resultado que en web, ~50ms de │
│ │ latencia, cero módulos nativos extra │  
 └────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Por qué NO los otros

┌────────────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────┐  
 │ Descartada │ Razón │
├────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
 │ react-native-webrtc (original) │ No soporta New Architecture. En SDK 55 deja de funcionar │
├────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ react-native-vlc-media-player │ Config plugin roto con Expo 54, build issues frecuentes │  
 ├────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
 │ react-native-video │ No soporta RTSP. Necesitarías convertir a HLS, que agrega 4-10 seg de latencia — inaceptable para un portero │  
 ├────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────┤  
 │ LiveKit / Twilio │ Requieren cambiar toda la arquitectura. Overkill │
└────────────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Video RTSP: la jugada inteligente

En vez de pelearte con VLC o buscar un player RTSP nativo, usás lo que ya funciona: tu backend transcoda RTSP→MPEG→WebSocket, y en mobile lo consumís con un WebView que corre JSMpeg  
 adentro. Mismo approach que tu web, latencia de ~50ms, sin módulos nativos problemáticos.

app.json

{
"expo": {
"plugins": [  
 [
"@config-plugins/react-native-webrtc",
 {
 "cameraPermission": "Permitir acceso a la cámara para videollamadas.",
"microphonePermission": "Permitir acceso al micrófono para llamadas."
 }
],  
 [
 "expo-audio",
{
"microphonePermission": "Permitir acceso al micrófono para llamadas."
}
 ]
]  
 }  
 }

---

Total: 6 paquetes, todos bien mantenidos, todos compatibles con Expo SDK 54 y preparados para SDK 55.

Querés que arranquemos a armar la estructura del proyecto?
# hickvision-mobile-prueba
