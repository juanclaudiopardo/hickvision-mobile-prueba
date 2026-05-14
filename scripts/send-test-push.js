#!/usr/bin/env node
/* eslint-disable */

// Manda un push FCM "incoming_call" al token indicado, simulando lo que hara
// el backend cuando reciba una llamada del portero. Usalo para validar el
// flow de notifee + lockscreen sin depender de que Lucas tenga implementado
// el endpoint de backend todavia.
//
// Uso:
//   node scripts/send-test-push.js <FCM_TOKEN> [callerName]
//
// Ejemplo:
//   node scripts/send-test-push.js cOFGfDmZRj6W9N6tebIyye:APA91bE...
//
// Requiere ../hikvision_cam_sip/secrets/fcm-service-account.json

const path = require('path');
const admin = require('firebase-admin');

const SERVICE_ACCOUNT_PATH = path.resolve(
  __dirname,
  '..',
  '..',
  'hikvision_cam_sip',
  'secrets',
  'fcm-service-account.json'
);

const token = process.argv[2];
const callerName = process.argv[3] || 'Test Portero';

if (!token) {
  console.error('Falta el FCM token.');
  console.error('Uso: node scripts/send-test-push.js <FCM_TOKEN> [callerName]');
  process.exit(1);
}

const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const callId = `test-${Date.now()}`;

const message = {
  token,
  data: {
    type: 'incoming_call',
    callId,
    source: 'test',
    callerName,
    callerNumber: '200',
    timestamp: String(Date.now()),
  },
  android: {
    priority: 'high',
    ttl: 30 * 1000,
  },
};

console.log('Enviando push FCM...');
console.log('  callId:    ', callId);
console.log('  callerName:', callerName);
console.log('  token:     ', token.slice(0, 20) + '...');

admin
  .messaging()
  .send(message)
  .then((response) => {
    console.log('\nOK. messageId:', response);
    process.exit(0);
  })
  .catch((err) => {
    console.error('\nFALLO:', err.code || err.message);
    if (err.errorInfo) console.error(err.errorInfo);
    process.exit(1);
  });
