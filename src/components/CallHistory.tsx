import { View, Text, StyleSheet } from 'react-native';

const MOCK_CALLS = [
  { id: '1', target: '1#1#1', type: 'video', status: 'completed', time: '10:30', duration: '02:15' },
  { id: '2', target: '200', type: 'voice', status: 'completed', time: '09:45', duration: '01:30' },
  { id: '3', target: '1#1#1', type: 'voice', status: 'missed', time: '08:20', duration: '-' },
  { id: '4', target: '200', type: 'video', status: 'completed', time: 'Ayer 18:00', duration: '05:22' },
  { id: '5', target: '1#1#1', type: 'voice', status: 'missed', time: 'Ayer 14:10', duration: '-' },
];

export default function CallHistory() {
  return (
    <View>
      {MOCK_CALLS.map(call => (
        <View key={call.id} style={styles.item}>
          <View style={[styles.typeIndicator, call.status === 'missed' ? styles.missed : styles.completed]} />
          <View style={{ flex: 1 }}>
            <Text style={styles.target}>{call.target}</Text>
            <Text style={styles.meta}>
              {call.type === 'video' ? 'Video' : 'Voz'} - {call.time}
            </Text>
          </View>
          <Text style={[styles.duration, call.status === 'missed' && styles.missedText]}>
            {call.status === 'missed' ? 'Perdida' : call.duration}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 14,
    marginBottom: 8,
    gap: 12,
  },
  typeIndicator: {
    width: 4,
    height: 32,
    borderRadius: 2,
  },
  completed: {
    backgroundColor: '#4ade80',
  },
  missed: {
    backgroundColor: '#f87171',
  },
  target: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '500',
  },
  meta: {
    color: '#64748b',
    fontSize: 12,
    marginTop: 2,
  },
  duration: {
    color: '#94a3b8',
    fontSize: 13,
  },
  missedText: {
    color: '#f87171',
  },
});
