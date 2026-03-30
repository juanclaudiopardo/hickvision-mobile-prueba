import { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { RTCView } from '@stream-io/react-native-webrtc';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useWebRTC } from '../src/hooks/useWebRTC';

export default function CallScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ target: string; type: string }>();
  const target = params.target || '200';
  const callType = params.type || 'voice';
  const isVideo = callType === 'video';

  const webrtc = useWebRTC();
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);

  // Timer de duración
  useEffect(() => {
    const timer = setInterval(() => setCallDuration(prev => prev + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Iniciar llamada WebRTC al montar
  useEffect(() => {
    webrtc.startCall(target, isVideo).catch(err => {
      console.error('[CallScreen] Error iniciando llamada:', err);
    });

    return () => {
      webrtc.endCall();
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleMute = () => {
    webrtc.toggleAudio();
    setIsMuted(!isMuted);
  };

  const handleVideoToggle = () => {
    webrtc.toggleVideo();
    setIsVideoOff(!isVideoOff);
  };

  const handleHangup = () => {
    webrtc.endCall();
    router.back();
  };

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

      {/* Video area */}
      <View style={styles.videoArea}>
        {isVideo && webrtc.remoteStream ? (
          <RTCView
            streamURL={webrtc.remoteStream.toURL()}
            style={styles.remoteVideo}
            objectFit="cover"
          />
        ) : (
          <View style={styles.voicePlaceholder}>
            <View style={styles.avatarCircle}>
              <Text style={styles.avatarText}>{isVideo ? 'V' : 'T'}</Text>
            </View>
            <Text style={styles.placeholderText}>
              {webrtc.isConnected ? `Conectado con ${target}` : 'Conectando...'}
            </Text>
          </View>
        )}

        {/* Video local (miniatura) */}
        {isVideo && webrtc.localStream && (
          <View style={styles.localVideoContainer}>
            <RTCView
              streamURL={webrtc.localStream.toURL()}
              style={styles.localVideo}
              objectFit="cover"
              mirror
            />
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

        {isVideo && (
          <Pressable
            style={[styles.controlBtn, isVideoOff && styles.controlBtnActive]}
            onPress={handleVideoToggle}
          >
            <Text style={styles.controlIcon}>{isVideoOff ? 'X' : 'Cam'}</Text>
            <Text style={styles.controlLabel}>{isVideoOff ? 'Sin video' : 'Video'}</Text>
          </Pressable>
        )}

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
    backgroundColor: '#1e293b',
  },
  remoteVideo: {
    flex: 1,
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
  localVideoContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 100,
    height: 140,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#334155',
  },
  localVideo: {
    flex: 1,
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
