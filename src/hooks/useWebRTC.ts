import { useState, useCallback, useRef, useEffect } from 'react';
import JsSIP from 'jssip';
import type { UA } from 'jssip';
import { mediaDevices, MediaStream } from '@stream-io/react-native-webrtc';
import InCallManager from 'react-native-incall-manager';
import { SIP_WS_URL, SIP_URI, SIP_PASSWORD, STUN_SERVER } from '../config/constants';

interface UseWebRTCReturn {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isConnected: boolean;
  isRegistered: boolean;
  hasIncomingCall: boolean;
  startCall: (target: string, withVideo: boolean) => Promise<void>;
  answerIncoming: () => Promise<void>;
  endCall: () => void;
  toggleVideo: () => void;
  toggleAudio: () => void;
}

export const useWebRTC = (): UseWebRTCReturn => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [hasIncomingCall, setHasIncomingCall] = useState(false);
  const incomingSessionRef = useRef<any>(null);

  const uaRef = useRef<UA | null>(null);
  const sessionRef = useRef<any>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  const teardownMedia = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track: any) => track.stop());
    }
    InCallManager.stop();
    setLocalStream(null);
    setRemoteStream(null);
    setIsConnected(false);
  }, []);

  // Inicializar JsSIP UA
  useEffect(() => {
    const socket = new JsSIP.WebSocketInterface(SIP_WS_URL);
    const ua = new JsSIP.UA({
      sockets: [socket],
      uri: SIP_URI,
      password: SIP_PASSWORD,
      register: true,
      session_timers: false,
    });

    ua.on('connected', () => {
      console.log('[WebRTC] Socket SIP conectado');
    });

    ua.on('registered', () => {
      console.log('[WebRTC] Registrado en Asterisk');
      setIsRegistered(true);
    });

    ua.on('unregistered', () => {
      setIsRegistered(false);
    });

    ua.on('registrationFailed', (event: any) => {
      console.error('[WebRTC] Fallo de registro', event?.cause || event);
      setIsRegistered(false);
    });

    ua.on('newRTCSession', (event: any) => {
      const session = event.session;
      const isIncoming = event.originator === 'remote';
      console.log(`[WebRTC] newRTCSession: ${isIncoming ? 'ENTRANTE' : 'saliente'}`);

      if (isIncoming) {
        incomingSessionRef.current = session;
        setHasIncomingCall(true);
      }
      sessionRef.current = session;

      session.on('progress', () => {
        console.log('[WebRTC] Llamada en progreso');
      });

      session.on('accepted', () => {
        console.log('[WebRTC] Llamada aceptada');
        InCallManager.start({ media: 'audio' });
        InCallManager.setForceSpeakerphoneOn(true);
        setIsConnected(true);
      });

      session.on('confirmed', () => {
        console.log('[WebRTC] Llamada confirmada');
        setIsConnected(true);
      });

      session.on('ended', () => {
        console.log('[WebRTC] Llamada finalizada');
        InCallManager.stop();
        sessionRef.current = null;
        teardownMedia();
      });

      session.on('failed', (evt: any) => {
        console.error('[WebRTC] Llamada fallida', evt?.cause || evt);
        InCallManager.stop();
        sessionRef.current = null;
        teardownMedia();
      });

      // Para llamadas salientes, la peerconnection ya existe cuando newRTCSession se dispara
      // Para entrantes, se crea después. Cubrimos ambos casos.
      const setupPC = (pc: any) => {
        if (!pc) return;
        console.log('[WebRTC] Configurando track listener en PeerConnection');
        // Usar addEventListener para no sobreescribir handlers internos de JsSIP
        pc.addEventListener('track', (trackEvent: any) => {
          const [stream] = trackEvent.streams;
          if (!stream) return;
          const audioTracks = stream.getAudioTracks();
          const videoTracks = stream.getVideoTracks();
          console.log(`[WebRTC] Stream remoto: ${audioTracks.length} audio, ${videoTracks.length} video`);
          audioTracks.forEach((t: any) => {
            console.log(`[WebRTC] Audio track: enabled=${t.enabled}, muted=${t.muted}`);
            t.enabled = true;
          });
          setRemoteStream(stream);
        });
      };

      // Si connection ya existe (llamada saliente)
      if (session.connection) {
        setupPC(session.connection);
      }

      // Si connection se crea después (llamada entrante)
      session.on('peerconnection', () => {
        setupPC(session.connection);
      });
    });

    ua.start();
    uaRef.current = ua;

    return () => {
      try {
        if (sessionRef.current) {
          sessionRef.current.terminate();
          sessionRef.current = null;
        }
        ua.stop();
      } catch (error) {
        console.warn('[WebRTC] Error cerrando UA', error);
      }
      uaRef.current = null;
      teardownMedia();
    };
  }, [teardownMedia]);

  const startCall = useCallback(async (target: string, withVideo: boolean) => {
    if (!uaRef.current) {
      throw new Error('Cliente WebRTC no inicializado');
    }

    if (sessionRef.current) {
      sessionRef.current.terminate();
      sessionRef.current = null;
    }

    // Usar mediaDevices de @stream-io/react-native-webrtc
    const stream = await mediaDevices.getUserMedia({
      audio: true,
      video: withVideo,
    });

    setLocalStream(stream as MediaStream);
    setIsAudioEnabled(true);
    setIsVideoEnabled(withVideo);

    const serverIp = SIP_URI.replace('sip:webrtc@', '');
    const options = {
      mediaStream: stream,
      mediaConstraints: {
        audio: true,
        video: withVideo,
      },
      pcConfig: {
        iceServers: [{ urls: STUN_SERVER }],
      },
    };

    const session = (uaRef.current as any).call(`sip:${target}@${serverIp}`, options);
    sessionRef.current = session;
  }, []);

  const answerIncoming = useCallback(async () => {
    const session = incomingSessionRef.current;
    if (!session) {
      console.warn('[WebRTC] No hay llamada entrante para contestar');
      return;
    }

    console.log('[WebRTC] Contestando llamada entrante...');
    const stream = await mediaDevices.getUserMedia({ audio: true, video: false });
    setLocalStream(stream as MediaStream);
    setIsAudioEnabled(true);

    session.answer({
      mediaStream: stream,
      mediaConstraints: { audio: true, video: false },
      pcConfig: {
        iceServers: [{ urls: STUN_SERVER }],
      },
    });

    InCallManager.start({ media: 'audio' });
    InCallManager.setForceSpeakerphoneOn(true);
    setHasIncomingCall(false);
    incomingSessionRef.current = null;
  }, []);

  const endCall = useCallback(() => {
    if (sessionRef.current) {
      try {
        sessionRef.current.terminate();
      } catch {}
      sessionRef.current = null;
    }
    if (incomingSessionRef.current) {
      try {
        incomingSessionRef.current.terminate();
      } catch {}
      incomingSessionRef.current = null;
    }
    setHasIncomingCall(false);
    teardownMedia();
  }, [teardownMedia]);

  const toggleVideo = useCallback(() => {
    if (!localStream) return;
    const videoTrack = localStream.getVideoTracks()[0];
    if (!videoTrack) return;
    videoTrack.enabled = !videoTrack.enabled;
    setIsVideoEnabled(videoTrack.enabled);
  }, [localStream]);

  const toggleAudio = useCallback(() => {
    if (!localStream) return;
    const audioTrack = localStream.getAudioTracks()[0];
    if (!audioTrack) return;
    audioTrack.enabled = !audioTrack.enabled;
    setIsAudioEnabled(audioTrack.enabled);
  }, [localStream]);

  return {
    localStream,
    remoteStream,
    isVideoEnabled,
    isAudioEnabled,
    isConnected,
    isRegistered,
    hasIncomingCall,
    startCall,
    answerIncoming,
    endCall,
    toggleVideo,
    toggleAudio,
  };
};
