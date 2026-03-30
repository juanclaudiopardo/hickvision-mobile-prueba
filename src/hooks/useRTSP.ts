import { useState, useCallback } from 'react';
import { api } from '../services/api';
import { RTSP_URL, API_BASE_URL } from '../config/constants';

interface UseRTSPReturn {
  isConnected: boolean;
  wsUrl: string | null;
  connect: (rtspUrl?: string) => Promise<void>;
  disconnect: () => void;
}

export const useRTSP = (): UseRTSPReturn => {
  const [isConnected, setIsConnected] = useState(false);
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  const connect = useCallback(async (rtspUrl?: string) => {
    try {
      const result = await api.startRtsp(rtspUrl || RTSP_URL) as any;
      const url = result.wsUrl || result.url;
      if (url) {
        // Reemplazar localhost por la IP del servidor
        const fixedUrl = url.replace('localhost', API_BASE_URL.replace('http://', '').replace(':3000', ''));
        setWsUrl(fixedUrl);
        setIsConnected(true);
        console.log('[RTSP] Conectado:', fixedUrl);
      }
    } catch (error) {
      console.error('[RTSP] Error conectando:', error);
      throw error;
    }
  }, []);

  const disconnect = useCallback(() => {
    api.stopRtsp().catch(() => {});
    setIsConnected(false);
    setWsUrl(null);
    console.log('[RTSP] Desconectado');
  }, []);

  return { isConnected, wsUrl, connect, disconnect };
};
