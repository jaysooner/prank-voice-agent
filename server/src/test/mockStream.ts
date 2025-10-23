// This is a simple client to test the WebSocket server locally
// It simulates Twilio connecting and sending a media stream.

// You need to create a test file: test-audio.mulaw
// You can generate one using sox:
// sox my-audio.wav -r 8000 -c 1 -e mu-law test-audio.mulaw

import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';

const WS_URL = 'ws://localhost:8080/ws/media?callSid=MOCK_SID_12345';
const AUDIO_FILE_PATH = path.join(__dirname, 'test-audio.mulaw'); // Needs to exist!
const CHUNK_SIZE = 160; // 20ms of 8kHz mulaw audio

// Mock session data for the server to find
import { sessionStore } from '../state/sessionStore';

sessionStore.set('MOCK_SID_12345', {
  callSid: 'MOCK_SID_12345',
  theme: 'Mock Test Call',
  outline: '1. Hello\n2. Test\n3. Goodbye',
  voiceId: 'Rachel',
  logs: [],
});

function sendAudioStream(ws: WebSocket) {
  try {
    const stream = fs.createReadStream(AUDIO_FILE_PATH, {
      highWaterMark: CHUNK_SIZE,
    });

    let streamSid = `MM_${Math.random().toString(36).substring(2, 12)}`;

    stream.on('open', () => {
      console.log('MockClient: Sending "connected" and "start" events...');
      // 1. Send "connected"
      ws.send(
        JSON.stringify({
          event: 'connected',
          protocol: 'Call',
          version: '1.0.0',
        })
      );

      // 2. Send "start"
      ws.send(
        JSON.stringify({
          event: 'start',
          streamSid: streamSid,
          start: {
            // ... mock start data
          },
        })
      );
    });

    stream.on('data', (chunk: string | Buffer) => {
      // 3. Send "media"
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const mediaMessage = {
        event: 'media',
        streamSid: streamSid,
        media: {
          track: 'inbound',
          chunk: '1', // Mock chunk index
          timestamp: Date.now().toString(),
          payload: buffer.toString('base64'),
        },
      };
      ws.send(JSON.stringify(mediaMessage));
    });

    stream.on('end', () => {
      console.log('MockClient: Audio file sent. Sending "stop".');
      // 4. Send "stop"
      ws.send(
        JSON.stringify({
          event: 'stop',
          streamSid: streamSid,
          stop: {
            // ... mock stop data
          },
        })
      );
      // ws.close();
    });

    stream.on('error', (err) => {
      console.error('MockClient: Error reading audio file:', err.message);
      ws.close();
    });
  } catch (err: any) {
    console.error(`MockClient: Failed to read audio file at ${AUDIO_FILE_PATH}`);
    console.error('Please create a test-audio.mulaw file.');
    ws.close();
  }
}

const ws = new WebSocket(WS_URL);

ws.on('open', () => {
  console.log(`MockClient: Connected to ${WS_URL}`);
  sendAudioStream(ws);
});

ws.on('message', (message: string) => {
  const msg = JSON.parse(message);
  if (msg.event === 'media') {
    console.log(
      `MockClient: Received audio packet from server (payload: ${msg.media.payload.length} bytes)`
    );
  } else {
    console.log('MockClient: Received message from server:', msg);
  }
});

ws.on('close', () => {
  console.log('MockClient: Connection closed.');
});

ws.on('error', (err) => {
  console.error('MockClient: WebSocket error:', err.message);
});
