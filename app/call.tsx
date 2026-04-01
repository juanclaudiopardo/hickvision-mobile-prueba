import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Alert } from 'react-native';
import { RTCView } from '@stream-io/react-native-webrtc';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWebRTCContext } from '../src/context/WebRTCContext';
import { useRTSP } from '../src/hooks/useRTSP';
import { api } from '../src/services/api';

export default function CallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ target: string; type: string; incoming: string }>();
  const target = params.target || '200';
  const callType = params.type || 'voice';
  const isVideo = callType === 'video';
  const isIncoming = params.incoming === 'true';

  const webrtc = useWebRTCContext();
  const rtsp = useRTSP();
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  // Timer de duración
  useEffect(() => {
    const timer = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Iniciar llamada SIP (siempre voz, RTSP maneja video) + RTSP si es videollamada
  useEffect(() => {
    if (!isIncoming) {
      // Siempre llamada de voz por SIP (audio bidireccional)
      webrtc.startCall(target, false).catch(err => {
        console.error('[CallScreen] Error iniciando llamada:', err);
      });
    }

    // Si es videollamada, iniciar RTSP para video del portero
    if (isVideo) {
      rtsp.connect().catch(err => {
        console.error('[CallScreen] Error conectando RTSP:', err);
      });
    }

    return () => {
      webrtc.endCall();
      if (isVideo) rtsp.disconnect();
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const [doorLoading, setDoorLoading] = useState(false);

  const handleMute = () => {
    webrtc.toggleAudio();
    setIsMuted(!isMuted);
  };

  const handleDoor = async () => {
    setDoorLoading(true);
    try {
      await api.openDoor();
      Alert.alert('Puerta', 'Puerta abierta');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Error abriendo puerta');
    } finally {
      setDoorLoading(false);
    }
  };

  const handleHangup = () => {
    webrtc.endCall();
    if (isVideo) rtsp.disconnect();
    router.back();
  };

  // HTML para JSMpeg RTSP player
  const rtspHtml = rtsp.wsUrl ? `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
  <style>
    * { margin: 0; padding: 0; }
    body { background: #000; overflow: hidden; }
    canvas { width: 100%; height: 100%; object-fit: contain; }
    #status { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); color: #94a3b8; font-family: sans-serif; font-size: 14px; }
  </style>
</head>
<body>
  <canvas id="canvas"></canvas>
  <div id="status">Conectando video...</div>
  <script src="https://jsmpeg.com/jsmpeg.min.js"></script>
  <script>
    var canvas = document.getElementById('canvas');
    var status = document.getElementById('status');
    try {
      var player = new JSMpeg.Player('${rtsp.wsUrl}', {
        canvas: canvas,
        autoplay: true,
        audio: false,
        disableGl: false,
        onSourceEstablished: function() {
          status.style.display = 'none';
        }
      });
    } catch(e) {
      status.textContent = 'Error: ' + e.message;
    }
  </script>
</body>
</html>` : null;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.target}>{target}</Text>
        <Text style={styles.info}>
          {isVideo ? 'Videollamada' : 'Llamada de voz'} - {formatDuration(callDuration)}
        </Text>
        <View style={styles.statusRow}>
          <View style={[styles.dot, webrtc.isConnected ? styles.dotGreen : styles.dotYellow]} />
          <Text style={styles.statusText}>
            {webrtc.isConnected ? 'Conectado' : 'Conectando...'}
          </Text>
        </View>
      </View>

      {/* RTCView para audio remoto (siempre renderizado cuando hay stream) */}
      {webrtc.remoteStream && (
        <RTCView
          streamURL={webrtc.remoteStream.toURL()}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}
        />
      )}

      {/* Video area */}
      <View style={styles.videoArea}>
        {isVideo && rtspHtml ? (
          <WebView
            source={{ html: rtspHtml }}
            style={styles.remoteVideo}
            javaScriptEnabled
            mediaPlaybackRequiresUserAction={false}
            allowsInlineMediaPlayback
          />
        ) : isVideo ? (
          <View style={styles.voicePlaceholder}>
            <Text style={styles.placeholderText}>Conectando video...</Text>
          </View>
        ) : (
          <View style={styles.voicePlaceholder}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>T</Text>
            </View>
            <Text style={styles.placeholderText}>
              {webrtc.isConnected ? `Conectado con ${target}` : 'Conectando...'}
            </Text>
          </View>
        )}
      </View>

      {/* Controles */}
      <View style={styles.controls}>
        <Pressable
          style={[styles.controlBtn, isMuted && styles.controlBtnActive]}
          onPress={handleMute}
        >
          <Text style={styles.controlIcon}>{isMuted ? 'M' : 'Mic'}</Text>
          <Text style={styles.controlLabel}>{isMuted ? 'Sin audio' : 'Audio'}</Text>
        </Pressable>

        <Pressable
          style={[styles.controlBtn, !webrtc.isSpeakerOn && styles.controlBtnActive]}
          onPress={() => webrtc.toggleSpeaker()}
        >
          <Text style={styles.controlIcon}>{webrtc.isSpeakerOn ? 'Spk' : 'Ear'}</Text>
          <Text style={styles.controlLabel}>{webrtc.isSpeakerOn ? 'Altavoz' : 'Auricular'}</Text>
        </Pressable>

        <Pressable
          style={[styles.controlBtn, { backgroundColor: '#16a34a' }]}
          onPress={handleDoor}
          disabled={doorLoading}
        >
          <Text style={styles.controlIcon}>{doorLoading ? '...' : 'Door'}</Text>
          <Text style={styles.controlLabel}>Abrir</Text>
        </Pressable>

        <Pressable style={styles.hangupBtn} onPress={handleHangup}>
          <Text style={styles.hangupIcon}>End</Text>
          <Text style={styles.hangupLabel}>Colgar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 24,
    paddingBottom: 16,
    alignItems: 'center',
  },
  target: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  info: {
    color: '#94a3b8',
    fontSize: 14,
    marginTop: 4,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotGreen: { backgroundColor: '#4ade80' },
  dotYellow: { backgroundColor: '#facc15' },
  statusText: {
    color: '#94a3b8',
    fontSize: 13,
  },
  videoArea: {
    flex: 1,
    margin: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  remoteVideo: {
    flex: 1,
    backgroundColor: '#000',
  },
  voicePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#1e3a5f',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: '#fff',
    fontSize: 36,
    fontWeight: 'bold',
  },
  placeholderText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 20,
    paddingBottom: 50,
    paddingTop: 16,
  },
  controlBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controlBtnActive: {
    backgroundColor: '#dc2626',
  },
  controlIcon: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  controlLabel: {
    color: '#94a3b8',
    fontSize: 10,
    marginTop: 2,
  },
  hangupBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hangupIcon: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  hangupLabel: {
    color: '#fff',
    fontSize: 10,
    marginTop: 2,
  },
});
