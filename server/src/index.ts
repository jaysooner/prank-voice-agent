import 'dotenv/config';
import express from 'express';
import http from 'http';
import { config } from './config';
import { initializeMediaStreamServer } from './ws/mediaStreamServer';
import callRoutes from './routes/call';
import twilioVoiceRoutes from './routes/twilioVoice';

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple root welcome
app.get('/api', (req, res) => {
  res.send('Conversational Voice Agent Backend is running!');
});

// API routes
app.use('/api/call', callRoutes);

// Twilio Webhook routes
app.use('/twilio/voice', twilioVoiceRoutes);

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server
initializeMediaStreamServer(server);

// Start listening
server.listen(config.port, () => {
  console.log(`Server listening on http://localhost:${config.port}`);
  console.log(`Public Host (for Twilio): ${config.publicHost}`);
  console.log(
    `WebSocket server running at wss://${new URL(config.publicHost).hostname}/ws/media`
  );
});
