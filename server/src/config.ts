import 'dotenv/config';

export const config = {
  port: process.env.PORT || 8080,
  publicHost: process.env.PUBLIC_HOST || '',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    callerId: process.env.TWILIO_CALLER_ID || '',
  },
  elevenLabs: {
    apiKey: process.env.ELEVENLABS_API_KEY || '',
    defaultVoiceId: process.env.ELEVENLABS_VOICE_ID || 'Rachel',
  },
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
  },
  maxCallSeconds: parseInt(process.env.MAX_CALL_SECONDS || '240', 10),
};

// Validate essential config
if (!config.publicHost) {
  throw new Error(
    'PUBLIC_HOST environment variable is not set. This is required for Twilio webhooks.'
  );
}

if (!config.twilio.accountSid || !config.twilio.authToken) {
  throw new Error(
    'TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN is not set.'
  );
}

if (!config.gemini.apiKey) {
  console.warn('GEMINI_API_KEY is not set. LLM will not function.');
}

if (!config.elevenLabs.apiKey) {
  console.warn('ELEVENLABS_API_KEY is not set. TTS will not function.');
}
