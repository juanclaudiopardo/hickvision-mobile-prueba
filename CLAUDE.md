# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

React Native (Expo SDK 54) mobile client that controls a Hikvision intercom via SIP/WebRTC. The app talks to a backend (separate repo at `/Users/juanpardo/Desktop/hikvision_cam_sip`) over Socket.IO + REST, and to Asterisk directly over SIP-WS using JsSIP.

**Requires a custom dev client** — `@stream-io/react-native-webrtc` and `react-native-incall-manager` are native modules; Expo Go cannot run this app.

## Commands

```bash
npx expo start          # Metro + dev client (scan QR with installed dev client)
npm run ios             # expo start --ios
npm run android         # expo start --android
npm run lint            # expo lint (eslint-config-expo)
```

After installing any native module, the dev client must be rebuilt (EAS build, see `eas.json` profiles `development` / `preview` / `production`).

## Backend dependency

The app is useless without the backend. Start it from the sibling repo:

```bash
cd /Users/juanpardo/Desktop/hikvision_cam_sip
docker compose up -d postgres redis asterisk sdk-bridge api-server
# Health check
curl http://localhost:3000/health
```

`SERVER_IP` in `src/config/constants.ts` must match the Mac's LAN IP (currently `192.168.0.163`, office Hikvision network). Change it when the network changes — physical devices cannot reach `localhost`.

## Architecture

### Single shared WebRTC user agent

The single most important architectural decision: **there is exactly one JsSIP UserAgent for the whole app**, owned by `src/context/WebRTCContext.tsx` and mounted at `app/_layout.tsx`. `useWebRTC` is called once inside the provider; all screens consume it via `useWebRTCContext()`. Never call `useWebRTC` directly in a screen — doing so creates a second UA, and the second registration kicks the first one off Asterisk, breaking incoming calls.

`registerGlobals()` from `@stream-io/react-native-webrtc` is called at module top of `app/_layout.tsx` so JsSIP can find `RTCPeerConnection` etc. on the global scope. This must run before any JsSIP import that touches WebRTC.

### Two parallel signaling planes

The app uses two coordinated channels for one logical "call":

1. **Socket.IO to api-server (`hooks/useSIP.ts`)** — high-level call lifecycle events (`call:incoming`, `call:answered`, `call:ended`, ISUP events). This is what the UI binds to for incoming-call state.
2. **SIP over WebSocket to Asterisk (`hooks/useWebRTC.ts` via JsSIP)** — actual RTP/SRTP media path. Audio and video flow here, not through the backend.

Outgoing call flow: UI → `useSIP.initiateCall` emits `call` over Socket.IO **and** `useWebRTC.startCall` opens a JsSIP session in parallel. Incoming call flow: backend emits `call:incoming` over Socket.IO; the user accepts; for ISUP-sourced calls the app POSTs `/api/isup/calls/:id/accept` (REST), for SIP-sourced calls it emits `call:answer` (Socket.IO). Media is then negotiated by JsSIP on whichever leg Asterisk bridges.

Distinguish ISUP vs SIP incoming calls by `source === 'isup'` or `id` prefix `isup-`.

### RTSP video path

Video from the Hikvision is **not** WebRTC. It is RTSP, transcoded by the backend to MPEG-TS over WebSocket, and rendered with JSMpeg inside a `WebView` (`components/RTSPPlayer.tsx`, `hooks/useRTSP.ts`). Flow: `POST /api/rtsp/start` with the `rtspUrl` → backend returns `{ wsUrl }` → WebView loads inline HTML that JSMpegs the canvas. Default channel is `102` (sub-stream — better mobile performance than channel `101`).

### Audio routing

`react-native-incall-manager` controls speakerphone/earpiece routing during an active call. WebRTC alone routes audio to earpiece by default on iOS/Android — InCallManager is what makes the speaker toggle in `app/call.tsx` actually do anything. Don't replace it with raw audio-session APIs.

### Routing

`expo-router` with `typedRoutes` enabled. Three routes only:
- `app/_layout.tsx` — root, wraps the tree in `WebRTCProvider`.
- `app/index.tsx` — dashboard.
- `app/call.tsx` — active-call screen (audio/video controls, RTSP view, door open/close).

Incoming calls navigate to `app/call.tsx` so the ringtone (`expo-audio`) plays in a screen with mounted players. See commit `f5deac7`.

## Configuration & secrets

- `src/config/constants.ts` is the single source of truth for `SERVER_IP`, SIP creds, RTSP URL, STUN. SIP password (`webrtc123`) and Hikvision creds (`admin`/`German987`) are intentionally checked in — this is a LAN-only dev project. Don't promote these to production without rotating.
- The Hikvision device at `192.168.0.243` registers itself with Asterisk as SIP user `200`. The mobile app registers as `webrtc@SERVER_IP`. Keep these IDs aligned with the backend's `pjsip.conf`.

## Reference docs in repo

- `MOBILE_APP_SPEC.md` — original feature spec; useful when adding new screens, but treat the existing code as the source of truth where they disagree.
- `CAMBIOS_BACKEND.md` — backend tweaks needed for the real Hikvision (NAT/`external_media_address`, dialplan). Read this before debugging "audio works one way" issues.
- `MOBILE_DEPENDENCIES.md` — rationale for each native dep.
