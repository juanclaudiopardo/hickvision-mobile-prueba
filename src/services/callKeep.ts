// Antes este archivo usaba react-native-callkeep (ConnectionService).
// Migramos a @notifee/react-native porque callkeep tiene metodos sobrecargados
// en el modulo nativo Android que el bridge TurboModule de New Architecture
// no soporta. Notifee es de Invertase, soporta New Arch, y para nuestro caso
// (despertar al usuario cuando suena el portero) cubre el 95% de la UX:
// full-screen intent sobre el lockscreen, sonido, vibracion, botones
// Contestar/Rechazar.
//
// Mantenemos la misma API publica (setupCallKeep, displayIncomingCall,
// endIncomingCall, setCallKeepHandlers) para no propagar el cambio al resto
// del codigo.
//
// Para iOS (cuando se agregue), notifee solo muestra notificaciones — para la
// UI nativa de CallKit hara falta volver a sumar callkeep o un patch-package.

import notifee, {
  AndroidCategory,
  AndroidImportance,
  AndroidVisibility,
  EventType,
  Event,
  TriggerType,
  TimestampTrigger,
} from '@notifee/react-native';
import { Platform } from 'react-native';

type Handlers = {
  onAnswer?: (callId: string) => void;
  onReject?: (callId: string) => void;
};

let initialized = false;
let handlers: Handlers = {};

// IMPORTANTE: si cambiamos config del channel (sonido, vibracion, importance),
// hay que cambiar el ID. Android cachea la config la primera vez que se crea
// el channel y los cambios posteriores con el mismo ID se ignoran.
const CHANNEL_ID = 'incoming_calls_v2';

export function setCallKeepHandlers(h: Handlers) {
  handlers = h;
}

export async function setupCallKeep() {
  if (initialized) return;
  if (Platform.OS !== 'android') return;

  await notifee.createChannel({
    id: CHANNEL_ID,
    name: 'Llamadas entrantes',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibration: true,
    vibrationPattern: [300, 500, 300, 500],
    bypassDnd: true,
    visibility: AndroidVisibility.PUBLIC,
  });

  notifee.onForegroundEvent((event) => {
    handleNotificationEvent(event);
  });

  initialized = true;
  console.log('[Notifee] setup OK');
}

export async function displayIncomingCall(
  callId: string,
  callerName: string,
  callerNumber: string,
  _hasVideo = true
) {
  if (Platform.OS !== 'android') return;

  await notifee.displayNotification({
    id: callId,
    title: callerName || 'Llamada entrante',
    body: callerNumber || 'Portero',
    android: {
      channelId: CHANNEL_ID,
      category: AndroidCategory.CALL,
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      ongoing: true,
      autoCancel: false,
      smallIcon: 'ic_launcher',
      sound: 'default',
      loopSound: true,
      vibrationPattern: [300, 500, 300, 500],
      pressAction: {
        id: 'default',
        launchActivity: 'default',
      },
      fullScreenAction: {
        id: 'default',
        launchActivity: 'default',
      },
      actions: [
        {
          title: '<font color="#16a34a">Contestar</font>',
          pressAction: {
            id: 'answer',
            launchActivity: 'default',
          },
        },
        {
          title: '<font color="#dc2626">Rechazar</font>',
          pressAction: {
            id: 'reject',
          },
        },
      ],
    },
    data: { callId, callerName, callerNumber },
  });

  console.log('[Notifee] displayIncomingCall', { callId, callerName });
}

export async function endIncomingCall(callId: string) {
  await notifee.cancelNotification(callId);
}

// Programa una notificacion para que el SO la dispare en N ms, independiente
// de si la app esta viva. Util para testear el caso "phone locked" en Xiaomi
// y otros OEMs que matan el proceso al bloquear pantalla.
export async function scheduleIncomingCall(
  callId: string,
  callerName: string,
  callerNumber: string,
  delayMs: number
) {
  if (Platform.OS !== 'android') return;

  const trigger: TimestampTrigger = {
    type: TriggerType.TIMESTAMP,
    timestamp: Date.now() + delayMs,
    alarmManager: { allowWhileIdle: true },
  };

  await notifee.createTriggerNotification(
    {
      id: callId,
      title: callerName || 'Llamada entrante',
      body: callerNumber || 'Portero',
      android: {
        channelId: CHANNEL_ID,
        category: AndroidCategory.CALL,
        importance: AndroidImportance.HIGH,
        visibility: AndroidVisibility.PUBLIC,
        ongoing: true,
        autoCancel: false,
        smallIcon: 'ic_launcher',
        sound: 'default',
        loopSound: true,
        vibrationPattern: [300, 500, 300, 500],
        pressAction: { id: 'default', launchActivity: 'default' },
        fullScreenAction: { id: 'default', launchActivity: 'default' },
        actions: [
          {
            title: '<font color="#16a34a">Contestar</font>',
            pressAction: { id: 'answer', launchActivity: 'default' },
          },
          {
            title: '<font color="#dc2626">Rechazar</font>',
            pressAction: { id: 'reject' },
          },
        ],
      },
      data: { callId, callerName, callerNumber },
    },
    trigger
  );
  console.log('[Notifee] scheduleIncomingCall', { callId, delayMs });
}

export async function endAllCalls() {
  await notifee.cancelAllNotifications();
}

function handleNotificationEvent(event: Event) {
  const { type, detail } = event;
  const notification = detail.notification;
  const pressAction = detail.pressAction;
  const callId = (notification?.data?.callId as string | undefined) ?? '';
  if (!callId) return;

  if (type === EventType.ACTION_PRESS) {
    if (pressAction?.id === 'answer') {
      console.log('[Notifee] answer pressed', callId);
      handlers.onAnswer?.(callId);
      notifee.cancelNotification(callId);
    } else if (pressAction?.id === 'reject') {
      console.log('[Notifee] reject pressed', callId);
      handlers.onReject?.(callId);
      notifee.cancelNotification(callId);
    }
  } else if (type === EventType.PRESS) {
    // Tap en el cuerpo de la notificacion (no los botones): tratar como
    // contestar — abre la app.
    console.log('[Notifee] body pressed', callId);
    handlers.onAnswer?.(callId);
    notifee.cancelNotification(callId);
  }
}

// Background event handler — debe registrarse a nivel de modulo desde
// app/_layout.tsx, fuera de cualquier componente. Se ejecuta cuando el
// usuario interactua con la notificacion estando la app cerrada o en
// background.
export function registerBackgroundEventHandler() {
  notifee.onBackgroundEvent(async (event) => {
    handleNotificationEvent(event);
  });
}
