import http from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import url from 'url';
import { sessionStore, CallSession } from '../state/sessionStore';
import { VeniceRealtime } from '../llm/veniceRealtime';
import { ElevenLabsWebSocket } from '../tts/elevenlabsWebSocket';
import { WhisperRealtime } from '../asr/whisperRealtime';
import { ConversationState } from '../state/convoState';
import { config } from '../config';

// Define the shape of Twilio Media Stream messages
// See: https://www.twilio.com/docs/voice/twiml/stream#message-media
interface TwilioMediaMessage {
  event: 'connected' | 'start' | 'media' | 'stop' | 'mark';
  streamSid: string;
  start?: {
    streamSid: string;
    // ... other start properties
  };
  media?: {
    track: 'inbound' | 'outbound';
    chunk: string; // timestamp
    timestamp: string;
    payload: string; // Base64-encoded 8kHz mulaw audio
  };
  stop?: {
    streamSid: string;
  };
}

export function initializeMediaStreamServer(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/ws/media' });

  wss.on('connection', (ws: WebSocket, req: http.IncomingMessage) => {
    if (!req.url) {
      console.error('WebSocket connection missing URL');
      ws.close(1008, 'Missing connection URL');
      return;
    }

    const { query } = url.parse(req.url, true);
    const callSid = query.callSid as string;

    if (!callSid) {
      console.error('WebSocket connection missing callSid');
      ws.close(1008, 'Missing callSid parameter');
      return;
    }

    const session = sessionStore.get(callSid);
    if (!session) {
      console.error(`No session found for callSid: ${callSid}`);
      ws.close(1008, 'Call session not found');
      return;
    }

    console.log(`WebSocket connected for call: ${callSid}`);
    session.logs.push({
      id: Date.now(),
      source: 'system',
      text: 'WebSocket media server connected.',
      timestamp: new Date().toISOString(),
    });

    // Initialize the services for this specific call
    const ttsService = new ElevenLabsWebSocket(session, ws);
    const convoState = new ConversationState(session, ttsService);
    const llmService = new VeniceRealtime(
      session,
      convoState,
      ttsService
    );

    // Initialize ASR service with callback to LLM
    const asrService = new WhisperRealtime(session, (transcript) => {
      llmService.handleUserText(transcript);
    });

    // --- WebSocket Message Handling ---

    ws.on('message', (message: string) => {
      try {
        const msg: TwilioMediaMessage = JSON.parse(message);

        switch (msg.event) {
          case 'connected':
            console.log(`Stream ${msg.streamSid} connected for ${callSid}`);
            break;

          case 'start':
            console.log(`Stream ${msg.streamSid} started for ${callSid}`);
            // This is a good place to send the *first* prompt
            llmService.startConversation();
            break;

          case 'media':
            // This is the core audio loop
            if (msg.media!.track === 'inbound') {
              // msg.media.payload is Base64 mulaw audio
              const audioChunk = Buffer.from(msg.media!.payload, 'base64');

              // Implement barge-in logic
              if (ttsService.getIsPlaying()) {
                console.log('Barge-in detected, interrupting TTS');
                ttsService.interrupt();
              }

              // Send the audio chunk to ASR for transcription
              asrService.addAudioChunk(audioChunk);
            }
            break;

          case 'stop':
            console.log(`Stream ${msg.streamSid} stopped for ${callSid}`);
            cleanupCall();
            break;

          case 'mark':
            // Used to confirm end of bot speech, not typical here
            console.log(`Mark received for ${callSid}`);
            break;
        }
      } catch (err: any) {
        console.error('Error processing WebSocket message:', err.message);
      }
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error for ${callSid}:`, err);
      cleanupCall();
    });

    ws.on('close', (code, reason) => {
      console.log(
        `WebSocket closed for ${callSid}. Code: ${code}, Reason: ${reason.toString()}`
      );
      cleanupCall();
    });

    // --- Cleanup Function ---
    function cleanupCall() {
      console.log(`Cleaning up resources for call ${callSid}`);
      llmService.stopConversation();
      ttsService.stop();
      asrService.stop();
      // Remove from session store after a short delay to allow logs to be polled
      setTimeout(() => {
        sessionStore.delete(callSid);
        console.log(`Session deleted for ${callSid}`);
      }, 30000); // 30-second delay
    }
  });

  console.log('WebSocket Media Stream Server initialized.');
}

/**
 * Sends audio data back to Twilio over the WebSocket.
 * Audio must be 8kHz mulaw, Base64 encoded.
 */
export function sendAudioToTwilio(ws: WebSocket, audioChunk: Buffer) {
  const twilioMediaPayload = {
    event: 'media',
    media: {
      payload: audioChunk.toString('base64'),
    },
    // We don't include streamSid, Twilio docs say not to for outbound
  };
  ws.send(JSON.stringify(twilioMediaPayload));
}
