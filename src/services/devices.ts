import { API_BASE_URL } from '../config/constants';

type RegisterPayload = {
  platform: 'android' | 'ios';
  token: string;
  packageName: string;
};

export async function registerDevice(payload: RegisterPayload) {
  const res = await fetch(`${API_BASE_URL}/api/devices/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`registerDevice ${res.status}`);
  return res.json();
}

export async function unregisterDevice(token: string) {
  const res = await fetch(
    `${API_BASE_URL}/api/devices/${encodeURIComponent(token)}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error(`unregisterDevice ${res.status}`);
  return res.json();
}

export async function sendTestPush(callerName = 'Test Push') {
  const res = await fetch(`${API_BASE_URL}/api/devices/test-push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callerName }),
  });
  if (!res.ok) throw new Error(`sendTestPush ${res.status}`);
  return res.json();
}
