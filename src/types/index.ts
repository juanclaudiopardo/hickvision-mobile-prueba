export interface Call {
  id: string;
  target: string;
  from?: string;
  type: 'voice' | 'video';
  status: 'initiating' | 'ringing' | 'connected' | 'ended';
  source?: string;
  channel?: string;
  startTime?: Date;
  endTime?: Date;
}

export interface ISUPDeviceStatus {
  enabled: boolean;
  mode: string;
  connected: boolean;
  activeCalls: number;
  lastEventAt: string | null;
  lastError: string | null;
}

export interface HealthResponse {
  status: string;
  timestamp: string;
  uptime: number;
  environment: string;
  isup: ISUPDeviceStatus;
}
