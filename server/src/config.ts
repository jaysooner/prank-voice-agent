import 'dotenv/config';

export const config = {
  port: process.env.PORT || 8080,
  publicHost: process.env.PUBLIC_HOST || '',
  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    callerId: process.env.TWILIO_CALLER_ID || '',
  },
  venice: {
    apiKey: process.env.VENICE_API_KEY || '',
    llmModel: process.env.VENICE_LLM_MODEL || 'llama-3.3-70b',
    ttsModel: process.env.VENICE_TTS_MODEL || 'tts-kokoro',
    ttsVoice: process.env.VENICE_TTS_VOICE || 'am_adam',
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

if (!config.venice.apiKey) {
  console.warn('VENICE_API_KEY is not set. LLM and TTS will not function.');
}
