// Dynamic Expo config — lee env vars (necesario para que EAS pueda inyectar
// archivos secretos como google-services.json en build time).
//
// En dev local (expo start) cae al path por defecto ./google-services.json.
// En EAS Build, GOOGLE_SERVICES_JSON viene como ruta a un archivo temporal
// generado a partir de la env var de EAS (tipo "file").

module.exports = {
  expo: {
    name: 'prueba-hickvision',
    owner: 'simplesolutions-dev',
    slug: 'prueba-hickvision',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'pruebahickvision',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bitcode: false,
    },
    android: {
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
      permissions: [
        'android.permission.ACCESS_NETWORK_STATE',
        'android.permission.CAMERA',
        'android.permission.INTERNET',
        'android.permission.MODIFY_AUDIO_SETTINGS',
        'android.permission.RECORD_AUDIO',
        'android.permission.SYSTEM_ALERT_WINDOW',
        'android.permission.WAKE_LOCK',
        'android.permission.BLUETOOTH',
        'android.permission.READ_PHONE_STATE',
        'android.permission.READ_PHONE_NUMBERS',
        'android.permission.FOREGROUND_SERVICE',
        'android.permission.FOREGROUND_SERVICE_PHONE_CALL',
        'android.permission.USE_FULL_SCREEN_INTENT',
        'android.permission.POST_NOTIFICATIONS',
      ],
      package: 'com.simplesolutions.hikvision.test',
      googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      [
        'expo-splash-screen',
        {
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#ffffff',
          dark: {
            backgroundColor: '#000000',
          },
        },
      ],
      '@config-plugins/react-native-webrtc',
      'expo-audio',
      '@react-native-firebase/app',
      '@react-native-firebase/messaging',
      'expo-web-browser',
      'expo-asset',
    ],
    experiments: {
      typedRoutes: true,
      reactCompiler: true,
    },
    extra: {
      router: {},
      eas: {
        projectId: 'a9f6e754-a181-4b7d-9a32-ad4426d46e38',
      },
    },
  },
};
