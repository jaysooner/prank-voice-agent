// STUB FILE: This needs to be implemented
import { WebSocket } from 'ws';
import { CallSession } from '../state/sessionStore';
import { config } from '../config';
import { sendAudioToTwilio } from '../ws/mediaStreamServer';

// You might need 'node-fetch' or 'axios' for the REST API
// Or the 'elevenlabs-node' SDK if it supports streaming

/**
 * Manages streaming text-to-speech with ElevenLabs.
 * This is a STUB and needs to be implemented.
 *
 * You can use:
 * 1. ElevenLabs Realtime WebSocket API (Preferred):
 *    - Connect to wss://api.elevenlabs.io/v1/text-to-speech/...
 *    - Send text chunks, receive audio chunks.
 *
 * 2. ElevenLabs Low-Latency REST API:
 *    - Make an HTTP POST to /v1/text-to-speech/...
 *    - Process the audio as it streams in.
 */
export class ElevenLabsRealtime {
  private session: CallSession;
  private twilioWs: WebSocket;
  private elWs: WebSocket | null = null; // WebSocket connection to ElevenLabs
  private textQueue: string[] = [];
  private isPlaying = false;
  private isBuffering = false;

  constructor(session: CallSession, twilioWs: WebSocket) {
    this.session = session;
    this.twilioWs = twilioWs;
    console.log(`ElevenLabs: Initialized for ${session.callSid}`);

    // TODO: Implement connection to ElevenLabs WebSocket
    // this.connect();
  }

  /**
   * STUB: Connect to ElevenLabs WebSocket API
   */
  private connect() {
    const elApiKey = config.elevenLabs.apiKey;
    const voiceId = this.session.voiceId;
    const elApiUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=eleven_turbo_v2&output_format=mulaw_8000`;

    // this.elWs = new WebSocket(elApiUrl, {
    //   headers: { 'xi-api-key': elApiKey },
    // });

    // this.elWs.on('open', () => {
    //   console.log('ElevenLabs: WebSocket connection established.');
    //   // Send auth message
    //   this.elWs?.send(JSON.stringify({
    //     xi_api_key: elApiKey,
    //     // other config
    //   }));
    // });

    // this.elWs.on('message', (audioData: Buffer) => {
    //   // This message will be audio chunks
    //   // The audioData is already mulaw_8000, so we can send it directly
    //   this.isBuffering = false;
    //   this.isPlaying = true;
    //   // We receive JSON with audio field, extract it
    //   // const data = JSON.parse(audioData.toString());
    //   // if (data.audio) {
    //   //   const audioChunk = Buffer.from(data.audio, 'base64');
    //   //   sendAudioToTwilio(this.twilioWs, audioChunk);
    //   // }
    // });

    // this.elWs.on('close', () => console.log('ElevenLabs: WebSocket closed.'));
    // this.elWs.on('error', (err) => console.error('ElevenLabs: WebSocket error:', err));
  }

  /**
   * Adds text to the TTS queue.
   */
  sendText(text: string) {
    console.log(`ElevenLabs: Queuing text: "${text}"`);
    this.textQueue.push(text);
    this.processQueue();
  }

  /**
   * Marks the end of a "turn" of speech.
   * Flushes any remaining text to the TTS.
   */
  flush() {
    console.log('ElevenLabs: Flushing text queue.');
    this.textQueue.push(' '); // Add a space to flush
    this.processQueue();
    // TODO: Send an "end of stream" message to EL WebSocket if needed
    // this.elWs?.send(JSON.stringify({ text: "" }));
  }

  /**
   * STUB: Processes the text queue, sending it to ElevenLabs
   */
  private processQueue() {
    if (this.isBuffering || this.textQueue.length === 0) {
      return;
    }

    this.isBuffering = true;
    const textToSend = this.textQueue.join('');
    this.textQueue = [];

    console.log(`ElevenLabs: Sending to TTS: "${textToSend}"`);

    // TODO: Send text to ElevenLabs WebSocket
    // this.elWs?.send(JSON.stringify({
    //   text: textToSend,
    //   try_trigger_generation: true
    // }));

    // --- MOCK RESPONSE (for stub) ---
    // Simulate receiving audio data
    setTimeout(() => {
      this.isBuffering = false;
      this.isPlaying = true;
      // Simulate a fake audio chunk (empty buffer)
      // In reality, this would come from the EL 'message' handler
      const mockAudioChunk = Buffer.alloc(160); // 20ms of 8kHz mulaw
      sendAudioToTwilio(this.twilioWs, mockAudioChunk);

      // Simulate end of speech
      setTimeout(() => {
        this.isPlaying = false;
      }, 500); // Simulate 500ms of speech
    }, 300); // Simulate 300ms latency
    // --- END MOCK ---
  }

  /**
   * Immediately stops any playing TTS.
   * (Barge-in support)
   */
  interrupt() {
    console.log('ElevenLabs: Interrupting speech.');
    this.textQueue = [];
    this.isPlaying = false;
    this.isBuffering = false;
    // TODO: Send a "flush" or "interrupt" message to ElevenLabs
    // This might involve closing and reopening the EL WebSocket
  }

  stop() {
    console.log('ElevenLabs: Stopping TTS service.');
    this.elWs?.close();
  }

  getIsPlaying() {
    return this.isPlaying;
  }
}
