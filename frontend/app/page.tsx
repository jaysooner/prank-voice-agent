'use client';

import { useState, useRef, FormEvent, useEffect } from 'react';
import { Phone, Bot, User, Play, StopCircle, Loader2 } from 'lucide-react';

// As per constraints, all React components are in this single file.

// #region Log Entry Component
interface LogEntry {
  id: number;
  source: 'user' | 'agent' | 'system';
  text: string;
  timestamp: string;
}

/**
 * Renders a single log entry with an appropriate icon.
 */
const LogItem = ({ log }: { log: LogEntry }) => {
  const getIcon = () => {
    switch (log.source) {
      case 'user':
        return <User className="w-5 h-5 text-blue-500" />;
      case 'agent':
        return <Bot className="w-5 h-5 text-purple-500" />;
      case 'system':
        return <Phone className="w-5 h-5 text-gray-500" />;
    }
  };

  const colors = {
    user: 'text-blue-700',
    agent: 'text-purple-700',
    system: 'text-gray-600 italic',
  };

  return (
    <li className="flex items-start gap-3 p-3 transition-all bg-white rounded-lg shadow-sm hover:bg-gray-50">
      <span className="flex-shrink-0 p-2 bg-gray-100 rounded-full">
        {getIcon()}
      </span>
      <div className="flex-grow">
        <p className={`text-sm font-medium ${colors[log.source]}`}>
          {log.source.charAt(0).toUpperCase() + log.source.slice(1)}
        </p>
        <p className="text-gray-800">{log.text}</p>
        <time className="text-xs text-gray-400">{log.timestamp}</time>
      </div>
    </li>
  );
};
// #endregion

// #region Logs Pane Component
/**
 * Displays the live list of log entries.
 */
const LogsPane = ({ logs }: { logs: LogEntry[] }) => {
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="w-full lg:w-1/2 bg-gray-100 rounded-xl shadow-inner overflow-hidden">
      <h2 className="p-4 text-lg font-semibold text-gray-800 border-b border-gray-200 bg-white/50">
        Live Call Log
      </h2>
      <div className="h-[600px] p-4 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500">Waiting for call to start...</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {logs.map((log) => (
              <LogItem key={log.id} log={log} />
            ))}
          </ul>
        )}
        <div ref={logsEndRef} />
      </div>
    </div>
  );
};
// #endregion

// #region Main Page Component
export default function HomePage() {
  // Form State
  const [phoneNumber, setPhoneNumber] = useState('');
  const [theme, setTheme] = useState('Confused Pizza Delivery');
  const [outline, setOutline] = useState(
    '1. Intro: Hi, I have your pizza?\n2. Complication: Wait, you ordered 100 pizzas?\n3. Escalation: The manager is yelling at me, you have to take them!\n4. Exit: Oh... this is 123 Main St? I\'m at 123 Main Ave. My bad.'
  );
  const [voiceId, setVoiceId] = useState('Rachel');
  const [callerId, setCallerId] = useState('+15551234567'); // Default from .env

  // App State
  const [callSid, setCallSid] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Polling interval reference
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- MOCK API FUNCTIONS ---
  // In a real app, these would be real fetch calls.
  // We use mocks here so the UI is interactive in the preview.
  const mockApiCall = (
    url: string,
    options: RequestInit
  ): Promise<{ ok: boolean; json: () => Promise<any>; status: number; statusText: string }> => {
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        console.log('Mock API Call:', url, options.body);
        if (url.endsWith('/api/call/start')) {
          if (JSON.parse(options.body as string).phoneNumber === 'error') {
            reject(new Error('Mock Error: Invalid phone number.'));
            return;
          }
          const mockSid = `CA_${Math.random().toString(36).substring(2, 12)}`;
          resolve({
            ok: true,
            status: 200,
            statusText: 'OK',
            json: () => Promise.resolve({ sid: mockSid }),
          });
        } else {
          reject(new Error(`Mock Error: Unknown API endpoint ${url}`));
        }
      }, 1000);
    });
  };

  const mockApiLogs = (
    url: string
  ): Promise<{ ok: boolean; json: () => Promise<LogEntry[]> }> => {
    const mockLogEntries: LogEntry[] = [
      {
        id: 1,
        source: 'system',
        text: `Call initiated with SID: ${callSid}`,
        timestamp: new Date().toLocaleTimeString(),
      },
      {
        id: 2,
        source: 'agent',
        text: '(Ringing...)',
        timestamp: new Date().toLocaleTimeString(),
      },
      {
        id: 3,
        source: 'system',
        text: 'Call connected.',
        timestamp: new Date().toLocaleTimeString(),
      },
      {
        id: 4,
        source: 'agent',
        text: 'Hi, I have your pizza?',
        timestamp: new Date().toLocaleTimeString(),
      },
      {
        id: 5,
        source: 'user',
        text: '...What? I didn\'t order a pizza.',
        timestamp: new Date().toLocaleTimeString(),
      },
      {
        id: 6,
        source: 'agent',
        text: 'Wait, you ordered 100 pizzas?',
        timestamp: new Date().toLocaleTimeString(),
      },
    ];

    // Simulate logs growing over time
    const logCount = logs.length === 0 ? 3 : logs.length + 1;
    const newLogs = mockLogEntries.slice(0, logCount);

    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          ok: true,
          json: () => Promise.resolve(newLogs),
        });
      }, 700);
    });
  };
  // --- END MOCK ---

  // Fetches logs for the current callSid
  const fetchLogs = async () => {
    if (!callSid) return;
    try {
      // DEV: Use mock API
      const response = await mockApiLogs(`/api/call/logs?callSid=${callSid}`);
      // PROD: Use real API
      // const response = await fetch(`/api/call/logs?callSid=${callSid}`);

      if (!response.ok) {
        throw new Error('Failed to fetch logs');
      }
      const data: LogEntry[] = await response.json();
      setLogs(data);

      // Check for a "call ended" log
      const ended = data.some((log) => log.text.includes('Call ended'));
      if (ended) {
        stopPolling();
        setIsLoading(false);
        setCallSid(null);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to fetch logs. Stopping poller.');
      stopPolling();
    }
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  // Start polling for logs when a callSid is set
  useEffect(() => {
    if (callSid) {
      stopPolling(); // Clear any existing pollers
      setLogs([]); // Clear old logs
      setError(null);
      // Fetch immediately, then start interval
      fetchLogs();
      pollIntervalRef.current = setInterval(fetchLogs, 2000);
    }

    // Cleanup on unmount
    return () => stopPolling();
  }, [callSid]); // Only re-run when callSid changes

  // Handles the form submission to start a call
  const handleStartCall = async (e: FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setLogs([]); // Clear logs on new call

    const body = JSON.stringify({
      phoneNumber,
      theme,
      outline,
      voiceId,
      callerId,
    });

    try {
      // DEV: Use mock API
      const response = await mockApiCall('/api/call/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
      });
      // PROD: Use real API
      // const response = await fetch('/api/call/start', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body,
      // });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({
          error: 'An unknown error occurred.',
        }));
        throw new Error(errData.error || response.statusText);
      }

      const data = await response.json();
      setCallSid(data.sid);
      // Loading stays true, polling will handle logs and state
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  // Handles stopping the call (mock)
  const handleStopCall = () => {
    stopPolling();
    setIsLoading(false);
    setCallSid(null);
    setError(null);
    setLogs([
      ...logs,
      {
        id: 99,
        source: 'system',
        text: 'Call manually stopped by user.',
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  };

  const Input = ({ id, label, ...props }: any) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        {...props}
        className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
      />
    </div>
  );

  const Textarea = ({ id, label, ...props }: any) => (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-gray-700">
        {label}
      </label>
      <textarea
        id={id}
        {...props}
        className="mt-1 block w-full px-3 py-2 bg-white border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm"
      />
    </div>
  );

  return (
    <main className="flex flex-col items-center min-h-screen p-4 bg-gray-50 md:p-8 font-sans">
      <div className="w-full max-w-6xl p-6 bg-white rounded-xl shadow-xl">
        <header className="pb-4 mb-6 border-b border-gray-200">
          <h1 className="text-3xl font-bold text-gray-900">
            Conversational Voice Agent
          </h1>
          <p className="mt-1 text-gray-600">
            Start a themed call and monitor its progress in real-time.
          </p>
          <p className="mt-2 text-xs text-red-600">
            Note: For consensual entertainment only. Please respect all
            local laws regarding telephone calls and recording.
          </p>
        </header>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* --- Form Section --- */}
          <div className="w-full lg:w-1/2">
            <form onSubmit={handleStartCall} className="space-y-4">
              <Input
                id="phoneNumber"
                label="Phone Number to Call"
                type="tel"
                value={phoneNumber}
                onChange={(e: any) => setPhoneNumber(e.target.value)}
                placeholder="e.g., +15559876543"
                required
              />
              <Input
                id="callerId"
                label="Your Twilio Number (Caller ID)"
                type="tel"
                value={callerId}
                onChange={(e: any) => setCallerId(e.target.value)}
                placeholder="Your Twilio number"
                required
              />
              <Input
                id="theme"
                label="Theme / Persona"
                type="text"
                value={theme}
                onChange={(e: any) => setTheme(e.target.value)}
                placeholder="e.g., Confused Pizza Delivery"
                required
              />
              <Textarea
                id="outline"
                label="Conversation Outline (Beats)"
                rows={5}
                value={outline}
                onChange={(e: any) => setOutline(e.target.value)}
                placeholder="One beat per line..."
                required
              />
              <Input
                id="voiceId"
                label="ElevenLabs Voice ID"
                type="text"
                value={voiceId}
                onChange={(e: any) => setVoiceId(e.target.value)}
                placeholder="e.g., Rachel"
                required
              />

              {error && (
                <p className="text-sm text-red-600">Error: {error}</p>
              )}

              {callSid && (
                <div className="p-3 text-sm text-center text-green-800 bg-green-100 rounded-md">
                  Call in progress... (SID: {callSid})
                </div>
              )}

              <div className="flex gap-4">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  ) : (
                    <Play className="w-5 h-5 mr-2" />
                  )}
                  {isLoading ? 'Calling...' : 'Start Call'}
                </button>
                {isLoading && (
                  <button
                    type="button"
                    onClick={handleStopCall}
                    className="flex-1 inline-flex justify-center items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    <StopCircle className="w-5 h-5 mr-2" />
                    Stop Call
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* --- Logs Section --- */}
          <LogsPane logs={logs} />
        </div>
      </div>
    </main>
  );
}
// #endregion
