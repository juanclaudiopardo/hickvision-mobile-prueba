import { useState, useCallback, useRef, useEffect } from 'react';
import JsSIP from 'jssip';
import type { UA } from 'jssip';
import { mediaDevices, MediaStream } from '@stream-io/react-native-webrtc';
import { SIP_WS_URL, SIP_URI, SIP_PASSWORD, STUN_SERVER } from '../config/constants';

interface UseWebRTCReturn {
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isVideoEnabled: boolean;
  isAudioEnabled: boolean;
  isConnected: boolean;
  isRegistered: boolean;
  startCall: (target: string, withVideo: boolean) => Promise<void>;
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
      sessionRef.current = event.session;
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

  const bindSessionEvents = useCallback((session: any) => {
    session.on('progress', () => {
      console.log('[WebRTC] Llamada en progreso');
    });

    session.on('accepted', () => {
      console.log('[WebRTC] Llamada aceptada');
      setIsConnected(true);
    });

    session.on('confirmed', () => {
      console.log('[WebRTC] Llamada confirmada');
      setIsConnected(true);
    });

    session.on('ended', () => {
      console.log('[WebRTC] Llamada finalizada');
      sessionRef.current = null;
      teardownMedia();
    });

    session.on('failed', (event: any) => {
      console.error('[WebRTC] Llamada fallida', event?.cause || event);
      sessionRef.current = null;
      teardownMedia();
    });

    session.on('peerconnection', () => {
      const pc = session.connection;
      if (!pc) return;

      pc.ontrack = (trackEvent: any) => {
        const [stream] = trackEvent.streams;
        if (!stream) return;
        console.log('[WebRTC] Stream remoto recibido');
        setRemoteStream(stream);
      };
    });
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

    const session = uaRef.current.call(`sip:${target}@${serverIp}`, options);
    sessionRef.current = session;
    bindSessionEvents(session);
  }, [bindSessionEvents]);

  const endCall = useCallback(() => {
    if (sessionRef.current) {
      try {
        sessionRef.current.terminate();
      } catch {}
      sessionRef.current = null;
    }
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
    startCall,
    endCall,
    toggleVideo,
    toggleAudio,
  };
};
