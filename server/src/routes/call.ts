import { Router, Request, Response } from 'express';
import twilioClient from '../twilioClient';
import { config } from '../config';
import { sessionStore } from '../state/sessionStore';
import { TwiMLVoiceResponse } from 'twilio/lib/twiml/VoiceResponse';

const router = Router();

interface StartCallBody {
  phoneNumber: string;
  theme: string;
  outline: string;
  voiceId?: string;
  callerId?: string;
}

// POST /api/call/start
// Initiates the outbound call
router.post('/start', async (req: Request, res: Response) => {
  const {
    phoneNumber,
    theme,
    outline,
    voiceId,
    callerId,
  } = req.body as StartCallBody;

  if (!phoneNumber || !theme || !outline) {
    return res.status(400).json({
      error: 'Missing required fields: phoneNumber, theme, and outline.',
    });
  }

  try {
    const twiml = new TwiMLVoiceResponse();
    // Add a brief pause to allow WebSocket to connect before speech
    twiml.pause({ length: 1 });
    // The <Start><Stream> logic is handled in the /twilio/voice webhook
    // This TwiML is just a simple fallback.

    const call = await twilioClient.calls.create({
      twiml: twiml.toString(),
      to: phoneNumber,
      from: callerId || config.twilio.callerId,
      // This is the webhook Twilio will call *after* the call connects
      // It's this webhook that will return the <Start><Stream> TwiML
      url: `${config.publicHost}/twilio/voice`,
      method: 'POST',
      // We can use statusCallback to get 'completed' event
      statusCallback: `${config.publicHost}/twilio/voice/status`,
      statusCallbackEvent: ['completed'],
    });

    // Store session data to be retrieved by the WebSocket server
    sessionStore.set(call.sid, {
      callSid: call.sid,
      theme,
      outline,
      voiceId: voiceId || config.elevenLabs.defaultVoiceId,
      logs: [
        {
          id: Date.now(),
          source: 'system',
          text: `Call initiated to ${phoneNumber}. SID: ${call.sid}`,
          timestamp: new Date().toISOString(),
        },
      ],
      // Conversation state will be initialized by the WS server
    });

    console.log(`Call initiated: ${call.sid}`);
    res.status(200).json({ sid: call.sid });
  } catch (err: any) {
    console.error('Error starting call:', err);
    res.status(500).json({ error: err.message || 'Failed to start call.' });
  }
});

// GET /api/call/logs?callSid=...
// Pollable endpoint for the frontend to get live logs
router.get('/logs', (req: Request, res: Response) => {
  const { callSid } = req.query;

  if (typeof callSid !== 'string') {
    return res.status(400).json({ error: 'Missing callSid query parameter.' });
  }

  const session = sessionStore.get(callSid);
  if (!session) {
    return res.status(404).json({ error: 'Call session not found.' });
  }

  res.status(200).json(session.logs);
});

export default router;
