import twilio from 'twilio';
import { config } from './config';

const { accountSid, authToken } = config.twilio;

const twilioClient = twilio(accountSid, authToken);

export default twilioClient;
