import { API_BASE_URL } from '../config/constants';

class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = API_BASE_URL;
  }

  private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Health
  getHealth() {
    return this.request<any>('/health');
  }

  // Calls
  initiateCall(from: string, to: string, context: string, callId: string) {
    return this.request('/api/calls/initiate', {
      method: 'POST',
      body: JSON.stringify({ from, to, context, callId }),
    });
  }

  hangupCall(callId: string) {
    return this.request(`/api/calls/${callId}/hangup`, { method: 'POST' });
  }

  getCallStatus(callId: string) {
    return this.request(`/api/calls/${callId}/status`);
  }

  getActiveCalls() {
    return this.request('/api/calls/active');
  }

  // ISUP
  getDeviceStatus() {
    return this.request('/api/isup/device/status');
  }

  getRecentEvents(limit = 8) {
    return this.request(`/api/isup/events/recent?limit=${limit}`);
  }

  acceptIsupCall(callId: string) {
    return this.request(`/api/isup/calls/${callId}/accept`, {
      method: 'POST',
      body: JSON.stringify({ source: 'frontend' }),
    });
  }

  hangupIsupCall(callId: string) {
    return this.request(`/api/isup/calls/${callId}/hangup`, { method: 'POST' });
  }

  // RTSP
  startRtsp(rtspUrl: string) {
    return this.request<{ wsUrl: string }>('/api/rtsp/start', {
      method: 'POST',
      body: JSON.stringify({ rtspUrl }),
    });
  }

  getRtspStream() {
    return this.request('/api/rtsp/stream');
  }

  stopRtsp() {
    return this.request('/api/rtsp/stop', { method: 'POST' });
  }

  // Door
  openDoor() {
    return this.request('/api/door/open', { method: 'POST' });
  }

  closeDoor() {
    return this.request('/api/door/close', { method: 'POST' });
  }

  // SIP status
  getSipStatus() {
    return this.request('/api/sip/status');
  }

  getSipPeers() {
    return this.request('/api/sip/peers');
  }
}

export const api = new ApiService();
