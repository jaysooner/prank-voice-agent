import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Conversational Voice Prank Agent',
  description: 'Real-time AI-powered voice prank calls using Twilio, Gemini, and ElevenLabs',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
