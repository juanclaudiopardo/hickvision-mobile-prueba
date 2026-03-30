import { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

interface CallModalProps {
  visible: boolean;
  onClose: () => void;
  onCall: (target: string, isVideo: boolean) => Promise<any>;
  initialCallType?: 'voice' | 'video';
}

const PRESETS = [
  { label: 'Piso 1 - Videoportero 1', value: '1#1#1' },
  { label: 'Intercomunicador HIKVISION', value: '200' },
];

export default function CallModal({ visible, onClose, onCall, initialCallType = 'voice' }: CallModalProps) {
  const [target, setTarget] = useState('1#1#1');
  const [callType, setCallType] = useState<'voice' | 'video'>(initialCallType);
  const [isCalling, setIsCalling] = useState(false);

  useEffect(() => {
    if (visible) setCallType(initialCallType);
  }, [visible, initialCallType]);

  const handleCall = async () => {
    if (!target.trim()) return;
    setIsCalling(true);
    try {
      await onCall(target, callType === 'video');
      onClose();
    } catch {
    } finally {
      setIsCalling(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <Text style={styles.title}>Realizar Llamada</Text>

          {/* Presets */}
          <Text style={styles.label}>Destino</Text>
          {PRESETS.map(p => (
            <Pressable
              key={p.value}
              style={[styles.preset, target === p.value && styles.presetActive]}
              onPress={() => setTarget(p.value)}
            >
              <Text style={[styles.presetText, target === p.value && styles.presetTextActive]}>
                {p.label}
              </Text>
              <Text style={styles.presetValue}>{p.value}</Text>
            </Pressable>
          ))}

          {/* Input manual */}
          <TextInput
            style={styles.input}
            value={target}
            onChangeText={setTarget}
            placeholder="Destino manual (ej: 1#1#1)"
            placeholderTextColor="#64748b"
          />

          {/* Tipo de llamada */}
          <Text style={styles.label}>Tipo</Text>
          <View style={styles.typeRow}>
            <Pressable
              style={[styles.typeBtn, callType === 'voice' && styles.typeBtnActive]}
              onPress={() => setCallType('voice')}
            >
              <Text style={[styles.typeText, callType === 'voice' && styles.typeTextActive]}>Voz</Text>
            </Pressable>
            <Pressable
              style={[styles.typeBtn, callType === 'video' && styles.typeBtnActiveVideo]}
              onPress={() => setCallType('video')}
            >
              <Text style={[styles.typeText, callType === 'video' && styles.typeTextActive]}>Video</Text>
            </Pressable>
          </View>

          {/* Botones */}
          <View style={styles.actions}>
            <Pressable style={styles.cancelBtn} onPress={onClose} disabled={isCalling}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.callBtn, callType === 'video' ? styles.callBtnVideo : styles.callBtnVoice]}
              onPress={handleCall}
              disabled={isCalling || !target.trim()}
            >
              {isCalling ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.callBtnText}>Llamar</Text>
              )}
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
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#1e293b',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  label: {
    color: '#94a3b8',
    fontSize: 13,
    marginBottom: 8,
    marginTop: 12,
  },
  preset: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  presetActive: {
    borderColor: '#3b82f6',
  },
  presetText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '500',
  },
  presetTextActive: {
    color: '#fff',
  },
  presetValue: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    color: '#fff',
    fontSize: 14,
    marginTop: 4,
  },
  typeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeBtn: {
    flex: 1,
    backgroundColor: '#0f172a',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  typeBtnActive: {
    borderColor: '#3b82f6',
  },
  typeBtnActiveVideo: {
    borderColor: '#16a34a',
  },
  typeText: {
    color: '#94a3b8',
    fontSize: 15,
    fontWeight: '600',
  },
  typeTextActive: {
    color: '#fff',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#334155',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: '#cbd5e1',
    fontWeight: '600',
    fontSize: 15,
  },
  callBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  callBtnVoice: {
    backgroundColor: '#3b82f6',
  },
  callBtnVideo: {
    backgroundColor: '#16a34a',
  },
  callBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
});
