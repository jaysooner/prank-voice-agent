import { CallSession } from '../state/sessionStore';
import { config } from '../config';
import { linear16ToMulaw, mulawToLinear16 } from '../utils/audio';

/**
 * Manages real-time speech recognition using OpenAI Whisper API.
 * Buffers audio chunks and sends them to Whisper for transcription.
 */
export class WhisperRealtime {
  private session: CallSession;
  private audioBuffer: Buffer[] = [];
  private isProcessing = false;
  private silenceThreshold = 500; // ms of silence before processing
  private lastAudioTime = Date.now();
  private minBufferDuration = 1000; // Minimum 1 second of audio before transcription
  private maxBufferDuration = 10000; // Maximum 10 seconds of audio
  private onTranscriptCallback: (text: string) => void;

  constructor(
    session: CallSession,
    onTranscript: (text: string) => void
  ) {
    this.session = session;
    this.onTranscriptCallback = onTranscript;
    console.log(`WhisperRealtime: Initialized for ${session.callSid}`);
    this.startBufferMonitor();
  }

  /**
   * Receives audio chunks from Twilio (8kHz mulaw)
   */
  addAudioChunk(chunk: Buffer) {
    this.audioBuffer.push(chunk);
    this.lastAudioTime = Date.now();

    // Calculate current buffer duration (160 bytes = 20ms at 8kHz)
    const bufferDurationMs = this.audioBuffer.reduce((sum, buf) => sum + buf.length, 0) / 160 * 20;

    // Process if we've hit max buffer duration
    if (bufferDurationMs >= this.maxBufferDuration) {
      this.processBuffer();
    }
  }

  /**
   * Monitors for silence and processes buffer when user stops speaking
   */
  private startBufferMonitor() {
    setInterval(() => {
      const silenceDuration = Date.now() - this.lastAudioTime;
      const bufferDurationMs = this.audioBuffer.reduce((sum, buf) => sum + buf.length, 0) / 160 * 20;

      // If we have enough audio and there's been silence, process it
      if (
        bufferDurationMs >= this.minBufferDuration &&
        silenceDuration >= this.silenceThreshold &&
        !this.isProcessing &&
        this.audioBuffer.length > 0
      ) {
        this.processBuffer();
      }
    }, 100);
  }

  /**
   * Processes the audio buffer and sends to Whisper for transcription
   */
  private async processBuffer() {
    if (this.isProcessing || this.audioBuffer.length === 0) {
      return;
    }

    this.isProcessing = true;
    const audioToProcess = Buffer.concat(this.audioBuffer);
    this.audioBuffer = []; // Clear buffer

    console.log(`WhisperRealtime: Processing ${audioToProcess.length} bytes of audio`);

    try {
      // Convert mulaw to linear16 PCM for Whisper
      const pcmAudio = mulawToLinear16(audioToProcess);

      // Create a WAV file in memory
      const wavBuffer = this.createWavBuffer(pcmAudio);

      // Send to OpenAI Whisper API
      const formData = new FormData();
      // Convert Buffer to Uint8Array for Blob compatibility
      const audioArray = new Uint8Array(wavBuffer);
      const audioBlob = new Blob([audioArray], { type: 'audio/wav' });
      formData.append('file', audioBlob, 'audio.wav');
      formData.append('model', 'whisper-1');
      formData.append('language', 'en');
      formData.append('response_format', 'json');

      const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.openai.apiKey}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Whisper API error: ${response.status} ${response.statusText}`);
      }

      const result = await response.json();
      const transcript = result.text?.trim();

      if (transcript && transcript.length > 0) {
        console.log(`WhisperRealtime: Transcribed: "${transcript}"`);

        // Log the transcription
        this.session.logs.push({
          id: Date.now(),
          source: 'user',
          text: transcript,
          timestamp: new Date().toISOString(),
        });

        // Send to callback (which will be the LLM handler)
        this.onTranscriptCallback(transcript);
      } else {
        console.log('WhisperRealtime: No speech detected');
      }
    } catch (err: any) {
      console.error('WhisperRealtime: Error transcribing audio:', err.message);
      this.session.logs.push({
        id: Date.now(),
        source: 'system',
        text: `ASR Error: ${err.message}`,
        timestamp: new Date().toISOString(),
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Creates a WAV file buffer from PCM audio data
   */
  private createWavBuffer(pcmData: Buffer): Buffer {
    const sampleRate = 8000; // 8kHz
    const numChannels = 1; // Mono
    const bitsPerSample = 16;

    const byteRate = sampleRate * numChannels * bitsPerSample / 8;
    const blockAlign = numChannels * bitsPerSample / 8;
    const dataSize = pcmData.length;

    const buffer = Buffer.alloc(44 + dataSize);

    // WAV header
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataSize, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16); // Subchunk1Size
    buffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
    buffer.writeUInt16LE(numChannels, 22);
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(byteRate, 28);
    buffer.writeUInt16LE(blockAlign, 32);
    buffer.writeUInt16LE(bitsPerSample, 34);
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataSize, 40);

    // Copy PCM data
    pcmData.copy(buffer, 44);

    return buffer;
  }

  /**
   * Stops the ASR service
   */
  stop() {
    console.log(`WhisperRealtime: Stopping ASR for ${this.session.callSid}`);
    this.audioBuffer = [];
    this.isProcessing = false;
  }
}
