import { CallSession } from '../state/sessionStore';
import { ConversationState } from '../state/convoState';
import { ElevenLabsWebSocket } from '../tts/elevenlabsWebSocket';
import { config } from '../config';
import { getSystemPrompt } from '../prompts/systemPrompt';

/**
 * Manages the real-time conversation with Venice.ai LLM.
 * Uses Venice.ai's chat completion API for conversational AI.
 */
export class VeniceRealtime {
  private session: CallSession;
  private convoState: ConversationState;
  private ttsService: ElevenLabsWebSocket;
  private conversationHistory: Array<{ role: string; content: string }> = [];
  private systemPrompt: string;

  constructor(
    session: CallSession,
    convoState: ConversationState,
    ttsService: ElevenLabsWebSocket
  ) {
    this.session = session;
    this.convoState = convoState;
    this.ttsService = ttsService;
    this.systemPrompt = getSystemPrompt(session.theme, session.outline);

    console.log(`VeniceRealtime: Initialized for ${session.callSid} with model ${config.venice.llmModel}`);
  }

  /**
   * Called when the call starts.
   * Sends the first message based on the conversation outline.
   */
  async startConversation() {
    console.log(`VeniceRealtime: Starting conversation for ${this.session.callSid}`);
    // The ConversationState will handle sending the first beat
    await this.convoState.sendNextBeat();
  }

  /**
   * Receives inbound audio chunks from Twilio.
   * Note: Venice.ai doesn't have native audio input, so this would need
   * to be transcribed first (e.g., using Whisper or another ASR service).
   * For now, this is a placeholder.
   */
  sendAudio(audioChunk: Buffer) {
    // TODO: Implement audio transcription using Whisper or similar
    // Then call handleUserText with the transcribed text
    console.log(`VeniceRealtime: Received audio chunk of ${audioChunk.length} bytes. (ASR not yet implemented)`);
  }

  /**
   * Called when a final text transcript is available from ASR.
   * This function sends the text to Venice.ai and streams the response.
   */
  async handleUserText(text: string) {
    console.log(`VeniceRealtime: Handling user text: "${text}"`);

    // Log user text
    this.session.logs.push({
      id: Date.now(),
      source: 'user',
      text: text,
      timestamp: new Date().toISOString(),
    });

    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: text,
    });

    try {
      // Call Venice.ai chat completion API with streaming
      const response = await fetch('https://api.venice.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.venice.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.venice.llmModel,
          messages: [
            { role: 'system', content: this.systemPrompt },
            ...this.conversationHistory,
          ],
          stream: true,
          max_tokens: 150, // Keep responses short for natural conversation
          temperature: 0.8, // Slightly creative but coherent
        }),
      });

      if (!response.ok) {
        throw new Error(`Venice API error: ${response.status} ${response.statusText}`);
      }

      // Process streaming response
      let fullResponse = '';
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('No response body reader available');
      }

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(line => line.trim() !== '');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;

              if (content) {
                console.log(`VeniceRealtime: Received chunk: "${content}"`);
                fullResponse += content;
                // Stream this text chunk to TTS
                this.ttsService.sendText(content);
              }
            } catch (e) {
              // Skip malformed JSON chunks
              console.warn('Failed to parse SSE chunk:', e);
            }
          }
        }
      }

      // Add assistant response to history
      this.conversationHistory.push({
        role: 'assistant',
        content: fullResponse,
      });

      // Once full response is assembled
      console.log(`VeniceRealtime: Full response: "${fullResponse}"`);
      this.ttsService.flush(); // Tell TTS service this turn is done
      this.session.logs.push({
        id: Date.now(),
        source: 'agent',
        text: fullResponse,
        timestamp: new Date().toISOString(),
      });

      // Check for stop words
      if (this.convoState.isStopWord(fullResponse) || this.convoState.isStopWord(text)) {
        this.convoState.sendStop();
        return;
      }

      // Advance to the next beat *after* responding
      await this.convoState.sendNextBeat();
    } catch (err: any) {
      console.error('VeniceRealtime: Error handling user text:', err.message);
      this.session.logs.push({
        id: Date.now(),
        source: 'system',
        text: `Error: ${err.message}`,
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Cleans up any active connections.
   */
  stopConversation() {
    console.log(`VeniceRealtime: Stopping conversation for ${this.session.callSid}`);
    this.conversationHistory = [];
  }
}
