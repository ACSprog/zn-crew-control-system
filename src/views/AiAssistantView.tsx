import React, { useState, useEffect, useRef } from 'react';
import { CrewMember, Flight, Assignment, LeaveTrainingRecord, LegalityRules, AircraftFleet } from '../types';
import { Bot, Send, Sparkles, ShieldCheck, RefreshCw, Trash2, Plus, MessageSquare, Menu, X } from 'lucide-react';
import { auth } from '../utils/authService';
import ReactMarkdown from 'react-markdown';
import {
  ChatSession,
  StoredChatMessage,
  subscribeChatSessions,
  subscribeSessionMessages,
  createChatSession,
  saveSessionMessage,
  deleteChatSession,
} from '../utils/aiChatHistory';

interface AiAssistantViewProps {
  crew: CrewMember[];
  flights: Flight[];
  assignments: Assignment[];
  leaveRecords: LeaveTrainingRecord[];
  fleet?: AircraftFleet[];
  rules: LegalityRules;
}

interface Message {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  verifiedByEngine?: boolean;
}

function toDisplayMessage(stored: StoredChatMessage): Message {
  return {
    id: stored.id,
    sender: stored.sender,
    text: stored.text,
    timestamp: new Date(stored.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    verifiedByEngine: stored.verifiedByEngine,
  };
}

function formatSessionTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export const AiAssistantView: React.FC<AiAssistantViewProps> = ({
  crew,
  flights,
  assignments,
  leaveRecords,
  fleet = [],
  rules,
}) => {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const uid = auth.currentUser?.uid;

  // Live list of this user's chat sessions.
  useEffect(() => {
    if (!uid) return;
    const unsubscribe = subscribeChatSessions(uid, setSessions);
    return () => unsubscribe();
  }, [uid]);

  // Live messages for whichever session is currently open.
  useEffect(() => {
    if (!uid || !activeSessionId) {
      setMessages([]);
      return;
    }
    const unsubscribe = subscribeSessionMessages(uid, activeSessionId, (stored) => {
      setMessages(stored.map(toDisplayMessage));
    });
    return () => unsubscribe();
  }, [uid, activeSessionId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const suggestedPrompts = [
    'Which flights have open crew positions?',
    'Which Q400 captains are available tomorrow?',
    'Are all scheduled flights staffed with qualified crew?',
    'Which crew members have the highest utilization?',
    'Show me all B737 crew available on Friday.',
    'Suggest alternative crew for ZN102.',
  ];

  const handleNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setIsSidebarOpen(false);
  };

  const handleSelectSession = (id: string) => {
    setActiveSessionId(id);
    setIsSidebarOpen(false);
  };

  const handleDeleteSession = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!uid) return;
    if (!window.confirm('Delete this chat? This cannot be undone.')) return;
    await deleteChatSession(uid, id);
    if (activeSessionId === id) {
      setActiveSessionId(null);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputQuery;
    if (!query.trim() || isLoading || !uid) return;

    setInputQuery('');
    setIsLoading(true);

    // Lazily create the session on the first message of a new chat —
    // mirrors how Claude/ChatGPT don't create a conversation until you
    // actually send something, so clicking "New Chat" and changing your
    // mind doesn't leave an empty ghost chat behind.
    let sessionId = activeSessionId;
    const isNewSession = !sessionId;
    if (!sessionId) {
      sessionId = await createChatSession(uid);
      setActiveSessionId(sessionId);
    }

    await saveSessionMessage(uid, sessionId, 'user', query, false, isNewSession);

    try {
      const crewOperational = crew.map((c) => ({
        id: c.id,
        staffNumber: c.staffNumber,
        name: c.name,
        role: c.role,
        aircraft: c.aircraft,
        qualifications: c.qualifications,
        base: c.base,
        status: c.status,
        seniority: c.seniority,
        typeRating: c.typeRating,
        trainingStatus: c.trainingStatus,
        passportStatus: c.passportStatus,
        airportPassStatus: c.airportPassStatus,
        medicalStatus: c.medicalStatus,
        medicalExpiry: c.medicalExpiry,
        licenseStatus: c.licenseStatus,
        licenseExpiry: c.licenseExpiry,
        simStatus: c.simStatus,
        septStatus: c.septStatus,
        crmStatus: c.crmStatus,
        dgrStatus: c.dgrStatus,
        lineCheck: c.lineCheck,
        weeklyBlockHours: c.weeklyBlockHours,
        monthlyBlockHours: c.monthlyBlockHours,
        annualBlockHours: c.annualBlockHours,
        monthlyDutyHours: c.monthlyDutyHours,
        daysOff: c.daysOff,
        employmentStatus: c.employmentStatus,
        nightDuties: c.nightDuties,
        dutiesCount: c.dutiesCount,
        flightsCount: c.flightsCount,
      }));

      const flightsOperational = flights.map((f) => ({
        id: f.id,
        flightNumber: f.flightNumber,
        date: f.date,
        aircraft: f.aircraft,
        registration: f.registration,
        departure: f.departure,
        arrival: f.arrival,
        std: f.std,
        sta: f.sta,
        delayMinutes: f.delayMinutes,
        blockHours: f.blockHours,
        status: f.status,
      }));

      const assignmentsOperational = assignments.map((a) => ({
        id: a.id,
        flightId: a.flightId,
        dutyCode: a.dutyCode,
        captainId: a.captainId,
        firstOfficerId: a.firstOfficerId,
        cabinCrewIds: a.cabinCrewIds,
        status: a.status,
        published: a.published,
      }));

      const leaveOperational = leaveRecords.map((l) => ({
        crewId: l.crewId,
        crewName: l.crewName,
        type: l.type,
        startDate: l.startDate,
        endDate: l.endDate,
        approved: l.approved,
      }));

      const fleetOperational = fleet.map((f) => ({
        aircraft: f.aircraft,
        registration: f.registration,
        status: f.status,
        location: f.location,
      }));

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) {
        throw new Error('You must be signed in to use the assistant.');
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          message: query,
          context: {
            rules,
            crew: crewOperational,
            flights: flightsOperational,
            assignments: assignmentsOperational,
            leave: leaveOperational,
            fleet: fleetOperational,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || `Server returned status ${response.status}`);
      }

      await saveSessionMessage(uid, sessionId, 'assistant', data.reply || 'No response returned.', true);
    } catch (err: unknown) {
      const detail = err instanceof Error ? err.message : 'Please check your backend connection.';
      await saveSessionMessage(uid, sessionId, 'assistant', `Error connecting to Gemini Assistant service: ${detail}`, false);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex gap-4 h-[calc(100vh-180px)] min-h-[600px] animate-in fade-in duration-200">
      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setIsSidebarOpen(true)}
        className="md:hidden fixed bottom-6 left-6 z-30 p-3 bg-rose-600 text-white rounded-full shadow-xl"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Sessions Sidebar */}
      <div
        className={`fixed md:static inset-y-0 left-0 z-40 w-72 shrink-0 bg-white border-r md:border border-slate-200 md:rounded-2xl shadow-2xl md:shadow-sm flex flex-col transition-transform duration-200 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="p-3 border-b border-slate-100 flex items-center gap-2">
          <button
            onClick={handleNewChat}
            className="flex-1 flex items-center gap-2 px-3 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Chat</span>
          </button>
          <button
            onClick={() => setIsSidebarOpen(false)}
            className="md:hidden p-2.5 text-slate-400 hover:text-slate-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 && (
            <p className="text-[11px] text-slate-400 text-center py-8 px-4">
              No chats yet. Start one with "New Chat" or a suggested query.
            </p>
          )}
          {sessions.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSelectSession(s.id)}
              className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center gap-2 group transition-colors cursor-pointer ${
                activeSessionId === s.id ? 'bg-rose-50 border border-rose-200' : 'hover:bg-slate-50 border border-transparent'
              }`}
            >
              <MessageSquare className={`w-3.5 h-3.5 shrink-0 ${activeSessionId === s.id ? 'text-rose-600' : 'text-slate-400'}`} />
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold truncate ${activeSessionId === s.id ? 'text-rose-900' : 'text-slate-700'}`}>
                  {s.title}
                </p>
                <p className="text-[10px] text-slate-400 font-mono">{formatSessionTime(s.updatedAt)}</p>
              </div>
              <span
                onClick={(e) => handleDeleteSession(e, s.id)}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-600 transition-opacity cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </span>
            </button>
          ))}
        </div>
      </div>

      {isSidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-slate-900/50 z-30" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Main Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0 space-y-4">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-rose-950 rounded-2xl p-5 text-white shadow-xl flex flex-wrap items-center justify-between gap-4 border border-slate-800">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-rose-500/20 text-rose-300 rounded-full text-xs font-semibold border border-rose-500/30 font-mono">
              <Sparkles className="w-3.5 h-3.5" />
              GEMINI AI INTELLIGENT ASSISTANT
            </div>
            <h2 className="text-lg font-bold">Zambia Airways AI Schedule Analytics</h2>
          </div>
          <div className="px-3.5 py-2 bg-emerald-950/80 text-emerald-300 rounded-xl border border-emerald-500/30 text-xs font-mono font-bold flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            DETERMINISTIC LEGALITY ENFORCED
          </div>
        </div>

        {/* Chat Conversation Box */}
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-2xl flex flex-col overflow-hidden min-h-0">
          <div className="flex-1 p-6 overflow-y-auto space-y-4 bg-slate-50/50">
            {messages.length === 0 && !isLoading && (
              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-10">
                <Bot className="w-10 h-10 text-slate-300" />
                <p className="text-xs text-slate-400 max-w-sm">
                  Ask about flight coverage, available captains, crew utilization, conflict analysis, or crew recommendations.
                </p>
                <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                  {suggestedPrompts.map((prompt, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(prompt)}
                      className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-800 rounded-xl border border-slate-200 text-xs font-semibold shadow-2xs hover:border-rose-300 transition-all text-left"
                    >
                      "{prompt}"
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className={`max-w-2xl rounded-2xl p-4 shadow-sm space-y-2 ${
                    msg.sender === 'user'
                      ? 'bg-rose-600 text-white font-medium text-xs'
                      : 'bg-white border border-slate-200 text-slate-900 text-xs leading-relaxed'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] opacity-75 font-mono border-b border-slate-100 pb-1 mb-1">
                    <span className="font-bold flex items-center gap-1">
                      {msg.sender === 'assistant' ? (
                        <>
                          <Bot className="w-3.5 h-3.5 text-rose-600" /> Zambia Airways OCC AI
                        </>
                      ) : (
                        'Dispatcher'
                      )}
                    </span>
                    <span>{msg.timestamp}</span>
                  </div>

                  {msg.sender === 'assistant' ? (
                    <div className="prose prose-xs max-w-none font-mono prose-headings:text-slate-900 prose-headings:font-bold prose-headings:text-xs prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-strong:text-slate-900">
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-line font-mono">{msg.text}</div>
                  )}

                  {msg.sender === 'assistant' && msg.verifiedByEngine && (
                    <div className="pt-2 border-t border-slate-100 flex items-center gap-1.5 text-[10px] font-bold text-emerald-700">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Recommendation verified via Deterministic FTL Legality Engine</span>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-200 rounded-2xl p-4 text-xs font-mono text-slate-500 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4 animate-spin text-rose-600" />
                  Thinking...
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          <div className="p-4 bg-white border-t border-slate-200 flex items-center gap-3">
            <input
              type="text"
              placeholder="Ask AI Assistant about crew availability, open positions, or FTL limits..."
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500 font-mono"
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={isLoading}
              className="px-5 py-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};