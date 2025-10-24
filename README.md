# Real-Time Conversational Voice Prank Agent

This repository contains the full-stack code for a real-time conversational voice agent. It uses Twilio for telephony, Twilio Media Streams for real-time audio, Venice.ai for conversational AI (LLM), OpenAI Whisper for speech-to-text, and ElevenLabs for real-time text-to-speech.

## Overview

The system allows a user to initiate a "prank" call to a phone number with a specific theme and outline. The AI agent will then carry on a live, natural-sounding conversation based on the provided persona, managed by a Node.js backend.

- **Frontend (Next.js)**: A simple UI to start calls and monitor live transcripts.
- **Backend (Node.js/Express)**: Manages API, Twilio webhooks, and the core WebSocket server.
- **Media Server (WebSocket)**: Handles bidirectional audio streaming with Twilio.
- **ASR (OpenAI Whisper)**: Converts user speech to text with real-time buffering and silence detection.
- **AI Core (Venice.ai LLM)**: Generates conversational responses using Llama 3.3 70B or other models.
- **TTS (ElevenLabs)**: Synthesizes AI responses into ultra-realistic speech using WebSocket streaming and sends them back into the call.

## Features

- **Outbound Calling**: Start a call from a web UI.
- **Real-Time Streaming**: Bidirectional audio via Twilio Media Streams & WebSockets.
- **Speech-to-Text**: OpenAI Whisper for accurate real-time transcription.
- **Conversational AI**: Venice.ai LLM (Llama 3.3 70B) with streaming responses.
- **Ultra-Low Latency TTS**: ElevenLabs WebSocket API for natural-sounding speech.
- **Barge-In Support**: Interrupts AI speech when user starts talking.
- **Stateful Conversation**: Follows a theme and outline while remaining conversational.
- **Privacy-Focused**: Venice.ai provides uncensored, private AI without data retention.
- **Safety**: Detects stop words and ends calls gracefully.

## Project Structure

```
/prank-voice-agent
├── README.md
├── .env.example
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── /frontend
│   ├── next.config.js
│   ├── package.json
│   ├── tsconfig.json
│   └── /app
│       └── page.tsx
└── /server
    ├── package.json
    ├── tsconfig.json
    └── /src
        ├── index.ts                 # Main server entry
        ├── config.ts                # Environment config
        ├── twilioClient.ts          # Twilio REST client
        ├── /routes
        │   ├── call.ts              # POST /api/call/start
        │   └── twilioVoice.ts       # POST /twilio/voice (TwiML)
        ├── /ws
        │   └── mediaStreamServer.ts # WebSocket server & logic
        ├── /asr
        │   └── whisperRealtime.ts   # OpenAI Whisper speech-to-text
        ├── /llm
        │   └── veniceRealtime.ts    # Venice.ai LLM client with streaming
        ├── /tts
        │   └── elevenlabsWebSocket.ts # ElevenLabs WebSocket TTS
        ├── /state
        │   ├── sessionStore.ts      # In-memory call session storage
        │   └── convoState.ts        # State machine for conversation
        ├── /utils
        │   └── audio.ts             # Audio format utilities (stub)
        └── /test
            └── mockStream.ts        # Script to test WS server
```

## Setup & Installation

### Clone Repository

```bash
git clone <repository-url>
cd prank-voice-agent
```

### Install Dependencies

This project uses pnpm workspaces.

```bash
pnpm install
```

### Configure Environment

Copy `.env.example` to `.env` and fill in all the required API keys and configuration.

```bash
cp .env.example .env
# Edit .env with your credentials
```

You must set `PUBLIC_HOST` to a publicly accessible URL (e.g., using ngrok) so Twilio can send webhooks.

### Twilio Setup

1. Buy a Twilio phone number.
2. Set your `TWILIO_CALLER_ID` in `.env` to this number.
3. Configure your Twilio number's "A CALL COMES IN" webhook to point to your `PUBLIC_HOST` (e.g., `https://<your-ngrok-id>.ngrok.io/twilio/voice`).
4. Ensure your Twilio account has Programmable Voice and Media Streams enabled.

### Run the Application

```bash
# Build all workspaces
pnpm -r build

# Start both frontend and backend
pnpm -r start
```

- Backend will run on `http://localhost:8080` (or `PORT` from `.env`).
- Frontend will run on `http://localhost:3000`.

## Local Testing

### Testing with Ngrok

Twilio needs to reach your local server. Use ngrok to expose your backend port.

```bash
# Install ngrok: https://ngrok.com/download
ngrok http 8080
```

Copy the `https://*.ngrok.io` URL and set it as your `PUBLIC_HOST` in the `.env` file. Restart the server.

### Testing WebSocket Server (Mock Stream)

You can test the WebSocket server locally without placing a real call by sending a pre-recorded audio file.

1. Make sure the server is running (`pnpm -w start:server`).
2. Run the mock client script:

```bash
pnpm -w test:mock-stream
```

This will connect to `ws://localhost:8080/ws/media` and stream a mock audio file. You can monitor the server logs to see the TTS processing.

## Implementation Status

### ✅ Fully Implemented - Complete Speech-to-Speech Pipeline!

- **✅ OpenAI Whisper ASR**: Real-time speech-to-text with intelligent buffering and silence detection
- **✅ Venice.ai LLM**: Streaming chat completion using Llama 3.3 70B for conversational AI
- **✅ ElevenLabs TTS**: WebSocket-based ultra-low latency text-to-speech (mulaw_8000 format)
- **✅ Audio Processing**: G.711 mulaw ↔ PCM conversion with proper sample rate handling
- **✅ Barge-In**: Detects when user speaks and interrupts AI
- **✅ Conversation State**: Stateful management with themes, outlines, and beats
- **✅ Stop Word Detection**: Graceful call termination on keywords

### 🎯 Production Considerations

- Add proper error handling and retry logic for all API calls
- Implement rate limiting for Venice.ai, ElevenLabs, and Whisper APIs
- Add monitoring and logging (e.g., Winston, Sentry)
- Use Redis for session storage instead of in-memory
- Consider optimizing audio buffer sizes for your use case
- Add comprehensive tests for the full pipeline
- Set up proper environment variable management for production

## Deployment

This application is stateful (due to WebSockets) and requires a server that can handle persistent connections.

- **Platforms**: Suitable for platforms like Render, Fly.io, or any VPS.
- **TLS/WSS**: Your public host must have a valid SSL certificate. Twilio Media Streams require a secure WebSocket connection (wss://). Ngrok, Render, and Fly.io provide this automatically.
- **Docker**: A `docker-compose.yml` is provided for a containerized setup.

```bash
docker-compose up --build
```

## Important Notes

⚠️ **For consensual entertainment only. Please respect all local laws regarding telephone calls and recording.**

## License

MIT
