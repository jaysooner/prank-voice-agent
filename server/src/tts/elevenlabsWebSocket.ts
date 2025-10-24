import { WebSocket as WSClient } from 'ws';
import { WebSocket } from 'ws';
import { CallSession } from '../state/sessionStore';
import { config } from '../config';
import { sendAudioToTwilio } from '../ws/mediaStreamServer';

/**
 * Manages streaming text-to-speech with ElevenLabs WebSocket API.
 * Uses real-time streaming for ultra-low latency TTS.
 */
export class ElevenLabsWebSocket {
  private session: CallSession;
  private twilioWs: WebSocket;
  private elevenLabsWs: WSClient | null = null;
  private textQueue: string[] = [];
  private isPlaying = false;
  private isConnected = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;

  constructor(session: CallSession, twilioWs: WebSocket) {
    this.session = session;
    this.twilioWs = twilioWs;
    this.connect();
    console.log(`ElevenLabsWebSocket: Initialized for ${session.callSid}`);
  }

  /**
   * Connects to ElevenLabs WebSocket API for streaming TTS
   */
  private connect() {
    const voiceId = this.session.voiceId || config.elevenLabs.voiceId;
    const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream-input?model_id=eleven_turbo_v2_5&output_format=mulaw_8000`;

    console.log(`ElevenLabsWebSocket: Connecting to ElevenLabs with voice ${voiceId}...`);

    this.elevenLabsWs = new WSClient(wsUrl, {
      headers: {
        'xi-api-key': config.elevenLabs.apiKey,
      },
    });

    this.elevenLabsWs.on('open', () => {
      console.log('ElevenLabsWebSocket: Connected to ElevenLabs');
      this.isConnected = true;
      this.reconnectAttempts = 0;

      // Send initial configuration
      this.elevenLabsWs?.send(JSON.stringify({
        text: ' ',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
        xi_api_key: config.elevenLabs.apiKey,
      }));
    });

    this.elevenLabsWs.on('message', (data: Buffer) => {
      try {
        // Check if it's JSON (control message) or audio data
        const text = data.toString();
        if (text.startsWith('{')) {
          const message = JSON.parse(text);

          if (message.error) {
            console.error('ElevenLabsWebSocket: API Error:', message.error);
          } else if (message.isFinal) {
            console.log('ElevenLabsWebSocket: Stream completed');
            this.isPlaying = false;
          }
        } else {
          // Raw audio data - it's already in mulaw_8000 format
          this.isPlaying = true;
          sendAudioToTwilio(this.twilioWs, data);
        }
      } catch (err) {
        // Assume it's audio data if JSON parsing fails
        this.isPlaying = true;
        sendAudioToTwilio(this.twilioWs, data);
      }
    });

    this.elevenLabsWs.on('error', (err) => {
      console.error('ElevenLabsWebSocket: WebSocket error:', err.message);
    });

    this.elevenLabsWs.on('close', (code, reason) => {
      console.log(`ElevenLabsWebSocket: Closed. Code: ${code}, Reason: ${reason.toString()}`);
      this.isConnected = false;

      // Attempt to reconnect if not intentionally closed
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        console.log(`ElevenLabsWebSocket: Reconnecting (attempt ${this.reconnectAttempts})...`);
        setTimeout(() => this.connect(), 1000 * this.reconnectAttempts);
      }
    });
  }

  /**
   * Adds text to the TTS queue and streams it to ElevenLabs
   */
  sendText(text: string) {
    if (!this.isConnected || !this.elevenLabsWs) {
      console.warn('ElevenLabsWebSocket: Not connected, queueing text');
      this.textQueue.push(text);
      return;
    }

    console.log(`ElevenLabsWebSocket: Streaming text: "${text}"`);

    try {
      this.elevenLabsWs.send(JSON.stringify({
        text: text,
        try_trigger_generation: true,
      }));
    } catch (err: any) {
      console.error('ElevenLabsWebSocket: Error sending text:', err.message);
      this.textQueue.push(text);
    }
  }

  /**
   * Marks the end of a "turn" of speech.
   * Flushes the stream and signals completion.
   */
  flush() {
    if (!this.isConnected || !this.elevenLabsWs) {
      console.warn('ElevenLabsWebSocket: Cannot flush, not connected');
      return;
    }

    console.log('ElevenLabsWebSocket: Flushing stream...');

    try {
      // Send empty text to signal end of stream
      this.elevenLabsWs.send(JSON.stringify({
        text: '',
      }));

      // Process any queued text
      if (this.textQueue.length > 0) {
        const queuedText = this.textQueue.join(' ');
        this.textQueue = [];
        this.sendText(queuedText);
      }
    } catch (err: any) {
      console.error('ElevenLabsWebSocket: Error flushing:', err.message);
    }
  }

  /**
   * Immediately stops any playing TTS (barge-in support)
   */
  interrupt() {
    console.log('ElevenLabsWebSocket: Interrupting speech...');
    this.textQueue = [];
    this.isPlaying = false;

    // Close and reconnect to clear the buffer
    if (this.elevenLabsWs) {
      this.elevenLabsWs.close();
      this.connect();
    }
  }

  /**
   * Stops the TTS service and closes connections
   */
  stop() {
    console.log('ElevenLabsWebSocket: Stopping TTS service...');
    this.textQueue = [];
    this.isPlaying = false;
    this.isConnected = false;

    if (this.elevenLabsWs) {
      this.elevenLabsWs.close();
      this.elevenLabsWs = null;
    }
  }

  getIsPlaying(): boolean {
    return this.isPlaying;
  }
}
