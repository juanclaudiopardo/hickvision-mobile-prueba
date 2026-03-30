import { useEffect, useState, useCallback } from 'react';
import {
  Text,
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '../src/services/api';
import { useSIP } from '../src/hooks/useSIP';
import CallModal from '../src/components/CallModal';
import IncomingCallModal from '../src/components/IncomingCallModal';
import { useWebRTC } from '../src/hooks/useWebRTC';
import { useRTSP } from '../src/hooks/useRTSP';
import RTSPPlayer from '../src/components/RTSPPlayer';
import CallHistory from '../src/components/CallHistory';

export default function Dashboard() {
  const { isConnected: sipConnected, currentCall, incomingCalls, initiateCall, answerCall, endCall } = useSIP();
  const router = useRouter();
  const webrtc = useWebRTC();
  const rtsp = useRTSP();
  const [showCallModal, setShowCallModal] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [callModalType, setCallModalType] = useState<'voice' | 'video'>('voice');

  // ISUP monitor
  const [isupStatus, setIsupStatus] = useState<any>(null);
  const [isupEvents, setIsupEvents] = useState<any[]>([]);
  const [doorLoading, setDoorLoading] = useState<'open' | 'close' | null>(null);

  const loadISUP = useCallback(async () => {
    try {
      const [statusRes, eventsRes] = await Promise.all([
        api.getDeviceStatus().catch(() => null),
        api.getRecentEvents(5).catch(() => null),
      ]);
      if (statusRes) setIsupStatus((statusRes as any).status || statusRes);
      if (eventsRes) setIsupEvents((eventsRes as any).events || []);
    } catch {}
  }, []);

  useEffect(() => {
    loadISUP();
    const interval = setInterval(loadISUP, 5000);
    return () => clearInterval(interval);
  }, [loadISUP]);

  // Acciones
  const openCallModal = (type: 'voice' | 'video') => {
    setCallModalType(type);
    setShowCallModal(true);
  };

  const handleCall = async (target: string, isVideo: boolean) => {
    try {
      await initiateCall(target, isVideo);
      router.push({ pathname: '/call', params: { target, type: isVideo ? 'video' : 'voice' } });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo iniciar la llamada');
    }
  };

  const handleDoor = async (action: 'open' | 'close') => {
    setDoorLoading(action);
    try {
      if (action === 'open') await api.openDoor();
      else await api.closeDoor();
      Alert.alert('Puerta', action === 'open' ? 'Puerta abierta' : 'Puerta cerrada');
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Error controlando puerta');
    } finally {
      setDoorLoading(null);
    }
  };

  const handleAnswer = async (callId: string) => {
    try {
      await answerCall(callId);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo contestar');
    }
  };

  const handleEndCall = async (callId: string) => {
    try {
      await endCall(callId);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'No se pudo colgar');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>HIKVISION SIP</Text>
        <View style={styles.row}>
          <View style={[styles.dot, sipConnected ? styles.dotGreen : styles.dotRed]} />
          <Text style={styles.headerStatus}>{sipConnected ? 'Conectado' : 'Desconectado'}</Text>
        </View>
      </View>

      {/* Llamada activa */}
      {currentCall && currentCall.status !== 'ended' && (
        <View style={styles.activeCallBanner}>
          <View style={{ flex: 1 }}>
            <Text style={styles.activeCallText}>
              Llamada {currentCall.type === 'video' ? 'Video' : 'Voz'}: {currentCall.target}
            </Text>
            <Text style={styles.activeCallStatus}>{currentCall.status}</Text>
          </View>
          <Pressable style={styles.hangupBtn} onPress={() => handleEndCall(currentCall.id)}>
            <Text style={styles.hangupText}>Colgar</Text>
          </Pressable>
        </View>
      )}

      {/* Llamadas entrantes */}
      {incomingCalls.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Llamadas Entrantes</Text>
          {incomingCalls.map(call => (
            <View key={call.id} style={styles.incomingCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.incomingFrom}>{call.from || 'Desconocido'}</Text>
                <Text style={styles.incomingType}>
                  {call.type === 'video' ? 'Videollamada' : 'Llamada de voz'}
                </Text>
              </View>
              <Pressable style={styles.answerBtn} onPress={() => handleAnswer(call.id)}>
                <Text style={styles.btnText}>Contestar</Text>
              </Pressable>
              <Pressable style={styles.rejectBtn} onPress={() => handleEndCall(call.id)}>
                <Text style={styles.btnText}>Rechazar</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      {/* Acciones principales */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Acciones</Text>
        <View style={styles.grid}>
          <Pressable style={styles.actionCard} onPress={() => openCallModal('voice')}>
            <View style={[styles.iconBox, { backgroundColor: '#1e3a5f' }]}>
              <Text style={styles.icon}>T</Text>
            </View>
            <Text style={styles.actionTitle}>Llamar al Portero</Text>
            <Text style={styles.actionSub}>Llamada de voz</Text>
          </Pressable>

          <Pressable style={styles.actionCard} onPress={() => openCallModal('video')}>
            <View style={[styles.iconBox, { backgroundColor: '#14532d' }]}>
              <Text style={styles.icon}>V</Text>
            </View>
            <Text style={styles.actionTitle}>Videollamada</Text>
            <Text style={styles.actionSub}>Video + Audio</Text>
          </Pressable>

          <Pressable style={styles.actionCard} onPress={() => {
            if (rtsp.isConnected) rtsp.disconnect();
            else rtsp.connect().catch(err => Alert.alert('Error', 'No se pudo conectar RTSP'));
          }}>
            <View style={[styles.iconBox, { backgroundColor: rtsp.isConnected ? '#14532d' : '#1e3a5f' }]}>
              <Text style={styles.icon}>C</Text>
            </View>
            <Text style={styles.actionTitle}>Conexion Directa</Text>
            <Text style={styles.actionSub}>{rtsp.isConnected ? 'Conectado' : 'RTSP + Video'}</Text>
          </Pressable>

          <Pressable style={styles.actionCard} onPress={() => setShowHistory(!showHistory)}>
            <View style={[styles.iconBox, { backgroundColor: '#3b0764' }]}>
              <Text style={styles.icon}>H</Text>
            </View>
            <Text style={styles.actionTitle}>Historial</Text>
            <Text style={styles.actionSub}>Ultimas llamadas</Text>
          </Pressable>
        </View>
      </View>

      {/* Historial */}
      {showHistory && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Historial de Llamadas</Text>
          <CallHistory />
        </View>
      )}

      {/* RTSP Player */}
      {rtsp.isConnected && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Camara en Vivo</Text>
          <RTSPPlayer wsUrl={rtsp.wsUrl} isConnected={rtsp.isConnected} onDisconnect={rtsp.disconnect} />
        </View>
      )}

      {/* Control de puerta */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Control de Puerta</Text>
        <View style={styles.doorRow}>
          <Pressable
            style={[styles.doorBtn, styles.doorOpen]}
            onPress={() => handleDoor('open')}
            disabled={doorLoading !== null}
          >
            {doorLoading === 'open' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.doorBtnText}>Abrir Puerta</Text>
            )}
          </Pressable>
          <Pressable
            style={[styles.doorBtn, styles.doorClose]}
            onPress={() => handleDoor('close')}
            disabled={doorLoading !== null}
          >
            {doorLoading === 'close' ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.doorBtnText}>Cerrar Puerta</Text>
            )}
          </Pressable>
        </View>
      </View>

      {/* Estado del sistema */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Estado del Sistema</Text>
        <View style={styles.statusRow}>
          <View style={[styles.dot, sipConnected ? styles.dotGreen : styles.dotRed]} />
          <Text style={styles.statusText}>Socket.IO: {sipConnected ? 'Conectado' : 'Desconectado'}</Text>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.dot, webrtc.isRegistered ? styles.dotGreen : styles.dotRed]} />
          <Text style={styles.statusText}>WebRTC/SIP: {webrtc.isRegistered ? 'Registrado' : 'No registrado'}</Text>
        </View>
        <View style={styles.statusRow}>
          <View style={[styles.dot, isupStatus?.activeCenterConnections > 0 ? styles.dotGreen : styles.dotYellow]} />
          <Text style={styles.statusText}>
            ISUP: {isupStatus?.activeCenterConnections > 0 ? 'Conectado' : 'Sin conexiones'}
          </Text>
        </View>
      </View>

      {/* Monitor ISUP */}
      <View style={styles.section}>
        <View style={[styles.row, { justifyContent: 'space-between', marginBottom: 12 }]}>
          <Text style={styles.sectionTitle}>Monitor ISUP</Text>
          <Pressable onPress={loadISUP}>
            <Text style={styles.refreshText}>Actualizar</Text>
          </Pressable>
        </View>

        <View style={styles.isupGrid}>
          <View style={styles.isupItem}>
            <Text style={styles.isupLabel}>Conexiones TCP</Text>
            <Text style={styles.isupValue}>
              Centro: {isupStatus?.activeCenterConnections ?? 0} | Alarmas: {isupStatus?.activeAlarmConnections ?? 0}
            </Text>
          </View>
          <View style={styles.isupItem}>
            <Text style={styles.isupLabel}>Ultimo remoto</Text>
            <Text style={styles.isupValue}>{isupStatus?.lastRemote || 'Sin datos'}</Text>
          </View>
        </View>

        <Text style={[styles.isupLabel, { marginTop: 12, marginBottom: 8 }]}>Eventos recientes</Text>
        {isupEvents.length === 0 ? (
          <Text style={styles.isupValue}>Sin eventos aun</Text>
        ) : (
          isupEvents.map((event, i) => (
            <View key={i} style={styles.eventItem}>
              <Text style={styles.eventTime}>{event.at} | {event.source}</Text>
              <Text style={styles.eventType}>{event.type}</Text>
            </View>
          ))
        )}
      </View>

      <View style={{ height: 40 }} />

      <CallModal
        visible={showCallModal}
        onClose={() => setShowCallModal(false)}
        onCall={handleCall}
        initialCallType={callModalType}
      />

      <IncomingCallModal
        call={incomingCalls[0] || null}
        onAnswer={handleAnswer}
        onReject={handleEndCall}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  content: {
    padding: 16,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerStatus: {
    color: '#94a3b8',
    fontSize: 13,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  dotGreen: { backgroundColor: '#4ade80' },
  dotRed: { backgroundColor: '#f87171' },
  dotYellow: { backgroundColor: '#facc15' },

  // Llamada activa
  activeCallBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#166534',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  activeCallText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  activeCallStatus: {
    color: '#bbf7d0',
    fontSize: 13,
    marginTop: 2,
  },
  hangupBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  hangupText: {
    color: '#fff',
    fontWeight: '600',
  },

  // Llamadas entrantes
  incomingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e3a5f',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    gap: 8,
  },
  incomingFrom: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  incomingType: {
    color: '#94a3b8',
    fontSize: 13,
  },
  answerBtn: {
    backgroundColor: '#16a34a',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  rejectBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },

  // Secciones
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 12,
  },

  // Grid de acciones
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    width: '47%',
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  icon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionTitle: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
    marginBottom: 2,
  },
  actionSub: {
    color: '#64748b',
    fontSize: 12,
  },

  // Control de puerta
  doorRow: {
    flexDirection: 'row',
    gap: 12,
  },
  doorBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doorOpen: {
    backgroundColor: '#16a34a',
  },
  doorClose: {
    backgroundColor: '#475569',
  },
  doorBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },

  // Estado
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  statusText: {
    color: '#cbd5e1',
    fontSize: 14,
  },

  // ISUP
  refreshText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '600',
  },
  isupGrid: {
    gap: 8,
  },
  isupItem: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 12,
  },
  isupLabel: {
    color: '#64748b',
    fontSize: 12,
    marginBottom: 4,
  },
  isupValue: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  eventItem: {
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },
  eventTime: {
    color: '#64748b',
    fontSize: 11,
  },
  eventType: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '500',
  },
});
