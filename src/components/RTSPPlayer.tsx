import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';

interface Props {
  wsUrl: string | null;
  isConnected: boolean;
  onDisconnect: () => void;
}

export default function RTSPPlayer({ wsUrl, isConnected, onDisconnect }: Props) {
  if (!isConnected || !wsUrl) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Sin conexion RTSP</Text>
      </View>
    );
  }

  // HTML con JSMpeg embebido que se conecta al WebSocket del backend
  const html = `
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
  <div id="status">Conectando stream...</div>
  <script src="https://jsmpeg.com/jsmpeg.min.js"></script>
  <script>
    var canvas = document.getElementById('canvas');
    var status = document.getElementById('status');
    try {
      var player = new JSMpeg.Player('${wsUrl}', {
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
</html>`;

  return (
    <View style={styles.container}>
      <WebView
        source={{ html }}
        style={styles.webview}
        javaScriptEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
      />
      <View style={styles.controls}>
        <View style={styles.statusRow}>
          <View style={styles.dotGreen} />
          <Text style={styles.statusText}>RTSP Conectado</Text>
        </View>
        <Pressable style={styles.stopBtn} onPress={onDisconnect}>
          <Text style={styles.stopText}>Desconectar</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  webview: {
    height: 220,
    backgroundColor: '#000',
  },
  placeholder: {
    height: 150,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    color: '#64748b',
    fontSize: 14,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    padding: 12,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dotGreen: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4ade80',
  },
  statusText: {
    color: '#cbd5e1',
    fontSize: 13,
  },
  stopBtn: {
    backgroundColor: '#dc2626',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  stopText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
});
