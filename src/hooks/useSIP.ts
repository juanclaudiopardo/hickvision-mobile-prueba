import { useState, useEffect, useCallback, useRef } from 'react';
import { getSocket } from '../services/socket';
import { api } from '../services/api';
import { RTSP_URL } from '../config/constants';
import type { Call } from '../types';

interface UseSIPReturn {
  isConnected: boolean;
  currentCall: Call | null;
  incomingCalls: Call[];
  initiateCall: (target: string, isVideo: boolean) => Promise<Call>;
  answerCall: (callId: string) => Promise<void>;
  endCall: (callId: string) => Promise<void>;
  disconnect: () => void;
}

export const useSIP = (): UseSIPReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [currentCall, setCurrentCall] = useState<Call | null>(null);
  const [incomingCalls, setIncomingCalls] = useState<Call[]>([]);
  const callTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearCallTimeout = useCallback(() => {
    if (callTimeoutRef.current) {
      clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    const socket = getSocket();
    socket.connect();

    socket.on('connect', () => {
      console.log('[SIP] Conectado al servidor');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[SIP] Desconectado del servidor');
      setIsConnected(false);
    });

    socket.on('call:incoming', (call: Call) => {
      console.log('[SIP] Llamada entrante:', call);
      setIncomingCalls(prev => {
        if (prev.some(existing => existing.id === call.id)) return prev;
        return [...prev, call];
      });
    });

    socket.on('call:answered', (call: Call) => {
      console.log('[SIP] Llamada contestada:', call);
      clearCallTimeout();
      setCurrentCall(prev => ({
        ...(prev || {}),
        ...call,
        status: 'connected',
      } as Call));
      setIncomingCalls(prev => prev.filter(c => c.id !== call.id));
    });

    socket.on('call:ended', (callId: string) => {
      console.log('[SIP] Llamada terminada:', callId);
      clearCallTimeout();
      setCurrentCall(null);
      setIncomingCalls(prev => prev.filter(c => c.id !== callId));
    });

    socket.on('call:status', (call: Call) => {
      console.log('[SIP] Estado actualizado:', call);
      if (call.status === 'connected') {
        clearCallTimeout();
      }
      setCurrentCall(prev => ({
        ...(prev || {}),
        ...call,
      } as Call));
    });

    socket.on('call:error', (payload: any) => {
      console.error('[SIP] Error:', payload);
    });

    return () => {
      clearCallTimeout();
      socket.off('connect');
      socket.off('disconnect');
      socket.off('call:incoming');
      socket.off('call:answered');
      socket.off('call:ended');
      socket.off('call:status');
      socket.off('call:error');
      socket.disconnect();
    };
  }, [clearCallTimeout]);

  const initiateCall = useCallback(async (target: string, isVideo: boolean): Promise<Call> => {
    const socket = getSocket();
    if (!socket.connected) throw new Error('No conectado al servidor SIP');

    const call: Call = {
      id: `call_${Date.now()}`,
      target,
      type: isVideo ? 'video' : 'voice',
      status: 'initiating',
      startTime: new Date(),
    };

    setCurrentCall(call);

    try {
      socket.emit('call', {
        from: 'mobile_user',
        to: target,
        context: 'mobile',
        type: call.type,
        callId: call.id,
      });

      setCurrentCall(prev => (prev ? { ...prev, status: 'ringing' } : null));

      clearCallTimeout();
      callTimeoutRef.current = setTimeout(() => {
        setCurrentCall(prev => {
          if (!prev || prev.status === 'connected' || prev.status === 'ended') return prev;
          return { ...prev, status: 'ended', endTime: new Date() };
        });
      }, 25000);

      // Para videollamada, intentar iniciar RTSP (falla silenciosamente)
      if (isVideo) {
        try {
          await api.startRtsp(RTSP_URL);
          console.log('[SIP] Stream RTSP iniciado para videollamada');
        } catch (rtspError) {
          console.warn('[SIP] No se pudo iniciar RTSP:', rtspError);
        }
      }
    } catch (error) {
      console.error('[SIP] Error iniciando llamada:', error);
      clearCallTimeout();
      setCurrentCall(prev => (prev ? { ...prev, status: 'ended' } : null));
      throw error;
    }

    return call;
  }, [clearCallTimeout]);

  const answerCall = useCallback(async (callId: string): Promise<void> => {
    const socket = getSocket();
    if (!socket.connected) throw new Error('No conectado al servidor');

    const call = incomingCalls.find(c => c.id === callId);
    if (!call) throw new Error('Llamada no encontrada');

    const isIsup = call.source === 'isup' || String(call.id).startsWith('isup-') || call.target === 'APP';

    if (isIsup) {
      await api.acceptIsupCall(callId);
    } else {
      socket.emit('call:answer', { callId });
    }

    setCurrentCall({ ...call, status: 'connected' });
    clearCallTimeout();
    setIncomingCalls(prev => prev.filter(c => c.id !== callId));
  }, [incomingCalls, clearCallTimeout]);

  const endCall = useCallback(async (callId: string): Promise<void> => {
    const socket = getSocket();
    if (!socket.connected) throw new Error('No conectado al servidor');

    setCurrentCall(prev => (prev ? { ...prev, status: 'ended', endTime: new Date() } : null));
    clearCallTimeout();

    socket.emit('call:end', { callId });

    setTimeout(() => {
      setCurrentCall(null);
    }, 1000);
  }, [clearCallTimeout]);

  const disconnect = useCallback(() => {
    const socket = getSocket();
    socket.disconnect();
  }, []);

  return {
    isConnected,
    currentCall,
    incomingCalls,
    initiateCall,
    answerCall,
    endCall,
    disconnect,
  };
};
