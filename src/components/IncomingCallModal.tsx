import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import type { Call } from '../types';

interface Props {
  call: Call | null;
  onAnswer: (callId: string) => void;
  onReject: (callId: string) => void;
}

export default function IncomingCallModal({ call, onAnswer, onReject }: Props) {
  if (!call) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => onReject(call.id)}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>{call.type === 'video' ? 'V' : 'T'}</Text>
          </View>

          <Text style={styles.title}>Llamada Entrante</Text>
          <Text style={styles.from}>{call.from || 'Desconocido'}</Text>
          <Text style={styles.type}>
            {call.type === 'video' ? 'Videollamada' : 'Llamada de voz'}
          </Text>

          <View style={styles.buttons}>
            <Pressable style={styles.rejectBtn} onPress={() => onReject(call.id)}>
              <Text style={styles.btnText}>Rechazar</Text>
            </Pressable>
            <Pressable style={styles.answerBtn} onPress={() => onAnswer(call.id)}>
              <Text style={styles.btnText}>Contestar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#1e293b',
    borderRadius: 20,
    padding: 32,
    width: '100%',
    alignItems: 'center',
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#1e3a5f',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  iconText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  from: {
    color: '#e2e8f0',
    fontSize: 16,
    marginBottom: 4,
  },
  type: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 28,
  },
  buttons: {
    flexDirection: 'row',
    gap: 16,
    width: '100%',
  },
  rejectBtn: {
    flex: 1,
    backgroundColor: '#dc2626',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  answerBtn: {
    flex: 1,
    backgroundColor: '#16a34a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
