import { WebSocket } from 'ws';
import { CallSession } from '../state/sessionStore';
import { config } from '../config';
import { sendAudioToTwilio } from '../ws/mediaStreamServer';

/**
 * Manages streaming text-to-speech with Venice.ai.
 * Uses Venice.ai's TTS API (tts-kokoro model) to convert text to speech.
 */
export class VeniceTTS {
  private session: CallSession;
  private twilioWs: WebSocket;
  private textQueue: string[] = [];
  private isPlaying = false;
  private isProcessing = false;

  constructor(session: CallSession, twilioWs: WebSocket) {
    this.session = session;
    this.twilioWs = twilioWs;
    console.log(`VeniceTTS: Initialized for ${session.callSid} with voice ${config.venice.ttsVoice}`);
  }

  /**
   * Adds text to the TTS queue.
   */
  sendText(text: string) {
    console.log(`VeniceTTS: Queuing text: "${text}"`);
    this.textQueue.push(text);
    this.processQueue();
  }

  /**
   * Marks the end of a "turn" of speech.
   * Flushes any remaining text to the TTS.
   */
  flush() {
    console.log('VeniceTTS: Flushing text queue.');
    if (this.textQueue.length > 0) {
      this.processQueue();
    }
  }

  /**
   * Processes the text queue, sending it to Venice.ai TTS
   */
  private async processQueue() {
    if (this.isProcessing || this.textQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    const textToSend = this.textQueue.join('');
    this.textQueue = [];

    console.log(`VeniceTTS: Sending to TTS: "${textToSend}"`);

    try {
      // Call Venice.ai TTS API
      const response = await fetch('https://api.venice.ai/api/v1/audio/speech', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.venice.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.venice.ttsModel,
          input: textToSend,
          voice: config.venice.ttsVoice,
          response_format: 'pcm', // Raw PCM audio
          speed: 1.0,
        }),
      });

      if (!response.ok) {
        throw new Error(`Venice TTS API error: ${response.status} ${response.statusText}`);
      }

      // Get the audio data
      const audioBuffer = await response.arrayBuffer();
      const audioData = Buffer.from(audioBuffer);

      console.log(`VeniceTTS: Received ${audioData.length} bytes of audio`);

      // Convert PCM to mulaw for Twilio
      const mulawAudio = this.convertPCMToMulaw(audioData);

      // Send audio to Twilio in chunks
      this.isPlaying = true;
      await this.streamAudioToTwilio(mulawAudio);
      this.isPlaying = false;

    } catch (err: any) {
      console.error('VeniceTTS: Error processing TTS:', err.message);
      this.session.logs.push({
        id: Date.now(),
        source: 'system',
        text: `TTS Error: ${err.message}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      this.isProcessing = false;
      // Process any new items that were added while we were processing
      if (this.textQueue.length > 0) {
        this.processQueue();
      }
    }
  }

  /**
   * Converts PCM audio to mulaw format for Twilio
   * Note: This is a simplified conversion. For production, use a proper audio library.
   */
  private convertPCMToMulaw(pcmBuffer: Buffer): Buffer {
    // Venice returns PCM 24kHz 16-bit, Twilio needs 8kHz mulaw
    // For now, we'll use a simple downsample and mulaw encode

    // Simple downsample: take every 3rd sample (24kHz -> 8kHz)
    const samples16bit = new Int16Array(pcmBuffer.buffer, pcmBuffer.byteOffset, pcmBuffer.length / 2);
    const downsampledLength = Math.floor(samples16bit.length / 3);
    const downsampled = new Int16Array(downsampledLength);

    for (let i = 0; i < downsampledLength; i++) {
      downsampled[i] = samples16bit[i * 3];
    }

    // Convert to mulaw
    const mulaw = Buffer.alloc(downsampledLength);
    for (let i = 0; i < downsampledLength; i++) {
      mulaw[i] = this.linearToMulaw(downsampled[i]);
    }

    return mulaw;
  }

  /**
   * Converts a 16-bit linear PCM sample to 8-bit mulaw
   */
  private linearToMulaw(sample: number): number {
    const MULAW_MAX = 0x1FFF;
    const MULAW_BIAS = 33;

    let sign = (sample >> 8) & 0x80;
    if (sign !== 0) sample = -sample;
    if (sample > MULAW_MAX) sample = MULAW_MAX;

    sample = sample + MULAW_BIAS;
    let exponent = 7;
    let expMask;
    for (expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1) {}

    const mantissa = (sample >> (exponent + 3)) & 0x0F;
    const mulawByte = ~(sign | (exponent << 4) | mantissa);

    return mulawByte & 0xFF;
  }

  /**
   * Streams audio to Twilio in 20ms chunks (160 bytes of 8kHz mulaw)
   */
  private async streamAudioToTwilio(audioBuffer: Buffer): Promise<void> {
    const CHUNK_SIZE = 160; // 20ms of 8kHz mulaw audio
    const CHUNK_DELAY = 20; // 20ms delay between chunks

    for (let i = 0; i < audioBuffer.length; i += CHUNK_SIZE) {
      const chunk = audioBuffer.slice(i, Math.min(i + CHUNK_SIZE, audioBuffer.length));
      sendAudioToTwilio(this.twilioWs, chunk);

      // Wait 20ms before sending next chunk (to simulate real-time playback)
      await new Promise(resolve => setTimeout(resolve, CHUNK_DELAY));
    }
  }

  /**
   * Immediately stops any playing TTS.
   * (Barge-in support)
   */
  interrupt() {
    console.log('VeniceTTS: Interrupting speech.');
    this.textQueue = [];
    this.isPlaying = false;
    this.isProcessing = false;
  }

  stop() {
    console.log('VeniceTTS: Stopping TTS service.');
    this.textQueue = [];
    this.isPlaying = false;
    this.isProcessing = false;
  }

  getIsPlaying() {
    return this.isPlaying;
  }
}
