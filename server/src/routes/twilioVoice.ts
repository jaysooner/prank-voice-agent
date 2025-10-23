import { Router, Request, Response } from 'express';
import { TwiMLVoiceResponse } from 'twilio/lib/twiml/VoiceResponse';
import { config } from '../config';
import { sessionStore } from '../state/sessionStore';

const router = Router();

// This is the main webhook hit by Twilio when the call connects.
// It returns the TwiML to start the media stream.
router.post('/', (req: Request, res: Response) => {
  const { CallSid } = req.body;

  console.log(`Twilio Voice Webhook: Call connected ${CallSid}`);

  // Create the TwiML response
  const twiml = new TwiMLVoiceResponse();

  // Create a <Start> verb with a <Stream> noun
  const stream = twiml.start().stream({
    name: 'RealtimeAudioStream',
    // This is the WSS URL our mediaStreamServer is listening on
    url: `wss://${new URL(config.publicHost).hostname}/ws/media?callSid=${CallSid}`,
  });

  // You can add custom parameters to the <Stream>
  // stream.parameter({ name: 'exampleParam', value: 'hello' });

  // Add a <Pause> to ensure the WebSocket connects before anything is said.
  twiml.pause({ length: 1 });

  // Add a log to the session
  const session = sessionStore.get(CallSid);
  if (session) {
    session.logs.push({
      id: Date.now(),
      source: 'system',
      text: 'Call connected. Starting media stream...',
      timestamp: new Date().toISOString(),
    });
    sessionStore.set(CallSid, session);
  }

  // Send the TwiML response back to Twilio
  res.setHeader('Content-Type', 'text/xml');
  res.send(twiml.toString());
});

// This webhook receives status updates (e.g., 'completed')
router.post('/status', (req: Request, res: Response) => {
  const { CallSid, CallStatus } = req.body;

  console.log(
    `Twilio Status Webhook: Call ${CallSid} status: ${CallStatus}`
  );

  if (CallStatus === 'completed') {
    const session = sessionStore.get(CallSid);
    if (session) {
      session.logs.push({
        id: Date.now(),
        source: 'system',
        text: 'Call ended.',
        timestamp: new Date().toISOString(),
      });
      // Session could be cleaned up here, but WS 'close' event
      // is more reliable for cleaning up active connections.
      // sessionStore.delete(CallSid);
    }
  }

  res.sendStatus(200);
});

export default router;
