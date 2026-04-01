import React, { createContext, useContext } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';

type WebRTCContextType = ReturnType<typeof useWebRTC>;

const WebRTCContext = createContext<WebRTCContextType | null>(null);

export function WebRTCProvider({ children }: { children: React.ReactNode }) {
  const webrtc = useWebRTC();
  return (
    <WebRTCContext.Provider value={webrtc}>
      {children}
    </WebRTCContext.Provider>
  );
}

export function useWebRTCContext(): WebRTCContextType {
  const ctx = useContext(WebRTCContext);
  if (!ctx) throw new Error('useWebRTCContext must be used within WebRTCProvider');
  return ctx;
}
