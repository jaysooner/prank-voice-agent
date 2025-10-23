import { CallSession } from './sessionStore';
import { ElevenLabsRealtime } from '../tts/elevenlabsRealtime';
import { config } from '../config';

const STOP_WORDS = [
  'stop',
  'not interested',
  'do not call',
  'wrong number',
  'remove me',
];

/**
 * Manages the state of the conversation, advancing through beats.
 */
export class ConversationState {
  private session: CallSession;
  private ttsService: ElevenLabsRealtime;
  private beats: string[];
  private currentBeat: number;
  private startTime: number;

  constructor(session: CallSession, ttsService: ElevenLabsRealtime) {
    this.session = session;
    this.ttsService = ttsService;
    this.beats = session.outline
      .split('\n')
      .map((b) => b.replace(/^\d+\.\s*/, '').trim()) // Remove "1. "
      .filter((b) => b.length > 0);

    this.currentBeat = 0;
    this.startTime = Date.now();

    // Initialize state in the session
    session.convoState = {
      currentBeat: this.currentBeat,
      beats: this.beats,
      startTime: this.startTime,
    };
  }

  /**
   * Sends the next logical beat of the conversation.
   * In a real system, this would be sent to Gemini as a prompt.
   * Here, we'll just send it directly to TTS.
   */
  async sendNextBeat() {
    // Check call duration
    if (
      (Date.now() - this.startTime) / 1000 >
      config.maxCallSeconds
    ) {
      console.log('Max call time exceeded. Ending call.');
      this.sendStop('Thanks for your time, goodbye!');
      return;
    }

    if (this.currentBeat >= this.beats.length) {
      console.log('Conversation outline complete.');
      // You could have a final "goodbye" beat
      return;
    }

    // Don't send a new beat if the bot is already talking
    if (this.ttsService.getIsPlaying()) {
      return;
    }

    const beatText = this.beats[this.currentBeat];
    this.currentBeat++;
    this.session.convoState!.currentBeat = this.currentBeat;

    console.log(`Sending beat ${this.currentBeat}: "${beatText}"`);

    // Log agent "thought" / beat
    this.session.logs.push({
      id: Date.now(),
      source: 'system',
      text: `(Advancing to beat ${this.currentBeat}: ${beatText})`,
      timestamp: new Date().toISOString(),
    });

    // In a real system, you would *not* just say the beat.
    // You would feed this beat as a prompt to Gemini.
    // e.g., gemini.sendPrompt(`Now, move to the next topic: ${beatText}`)
    // For this stub, we'll just speak the beat text directly
    // This will be replaced by `handleUserText` logic in a real app.

    // This is a *placeholder* for the first beat
    if (this.currentBeat === 1) {
      this.session.logs.push({
        id: Date.now(),
        source: 'agent',
        text: beatText,
        timestamp: new Date().toISOString(),
      });
      this.ttsService.sendText(beatText);
      this.ttsService.flush();
    }
  }

  /**
   * Checks for stop words
   */
  isStopWord(text: string): boolean {
    const lowerText = text.toLowerCase();
    return STOP_WORDS.some((word) => lowerText.includes(word));
  }

  /**
   * Sends a final stop message and prepares to end the call.
   */
  sendStop(message: string = 'Okay, my mistake. Have a great day. Goodbye.') {
    console.log('Sending stop message.');
    this.session.logs.push({
      id: Date.now(),
      source: 'agent',
      text: message,
      timestamp: new Date().toISOString(),
    });
    this.ttsService.interrupt(); // Stop anything currently playing
    this.ttsService.sendText(message);
    this.ttsService.flush();
    // The WebSocket connection will be closed by the 'stop' event
    // or by the TTS service finishing and the llm/ws handler cleaning up.
  }
}
