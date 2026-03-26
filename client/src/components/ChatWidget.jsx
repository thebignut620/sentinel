import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext.jsx';
import { useNavigate } from 'react-router-dom';
import api from '../api/client.js';

export default function ChatWidget() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [typing, setTyping] = useState(false);
  const [rated, setRated] = useState(false);
  const [sessionId, setSessionId] = useState(null);
  const [converting, setConverting] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (open) {
      setUnread(0);
      loadSession();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typing]);

  async function loadSession() {
    try {
      const { data } = await api.get('/chat/session');
      setSessionId(data.session.id);
      setMessages(data.messages || []);
      if (data.messages.length === 0) {
        setMessages([{ role: 'assistant', content: `Hi ${user?.name?.split(' ')[0] || 'there'}! I'm ATLAS, your IT assistant. What can I help you with today?`, id: 'welcome' }]);
      }
    } catch {}
  }

  async function sendMessage(e) {
    e?.preventDefault();
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: text, id: Date.now() }]);
    setLoading(true);
    setTyping(true);

    try {
      const { data } = await api.post('/chat/session/message', { message: text });
      setTyping(false);
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply, id: Date.now() + 1 }]);
      setSessionId(data.session_id);
    } catch {
      setTyping(false);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I had trouble responding. Please try again.', id: Date.now() + 1 }]);
    } finally {
      setLoading(false);
    }
  }

  async function handleRate(r) {
    try { await api.post('/chat/session/rate', { rating: r }); } catch {}
    setRated(true);
  }

  async function convertToTicket() {
    setConverting(true);
    try {
      const firstMsg = messages.find(m => m.role === 'user');
      const { data } = await api.post('/chat/session/convert-ticket', { title: firstMsg?.content?.slice(0, 100) });
      setOpen(false);
      navigate(`/tickets/${data.ticket_id}`);
    } catch {
      setConverting(false);
    }
  }

  async function closeChat() {
    try { await api.post('/chat/session/close'); } catch {}
    setOpen(false);
    setMessages([]);
    setRated(false);
    setSessionId(null);
  }

  if (!user) return null;

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={() => setOpen(o => !o)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-green-700 hover:bg-green-600 shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-95"
        title="Chat with ATLAS"
      >
        {open ? (
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <>
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center font-bold">{unread}</span>
            )}
          </>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-24 right-6 z-50 w-96 max-w-[calc(100vw-3rem)] bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden" style={{ height: '520px' }}>
          {/* Header */}
          <div className="bg-gradient-to-r from-green-900/60 to-green-800/40 border-b border-gray-700 px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-700 flex items-center justify-center text-sm font-bold text-white shrink-0">A</div>
            <div className="flex-1 min-w-0">
              <div className="text-white font-semibold text-sm">ATLAS</div>
              <div className="text-green-400 text-xs">IT Assistant · Online</div>
            </div>
            <button onClick={closeChat} className="text-gray-400 hover:text-white transition-colors text-sm">✕</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
            {messages.map((msg, i) => (
              <div key={msg.id || i} className={`flex gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-green-700 flex items-center justify-center text-xs font-bold text-white shrink-0 mt-0.5">A</div>
                )}
                {msg.role === 'system' && (
                  <div className="w-full text-center text-xs text-gray-500 py-1 italic">{msg.content}</div>
                )}
                {msg.role !== 'system' && (
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-green-700 text-white rounded-tr-sm'
                      : 'bg-gray-800 text-gray-100 rounded-tl-sm border border-gray-700'
                  }`}>
                    {msg.content}
                  </div>
                )}
              </div>
            ))}

            {/* Typing indicator */}
            {typing && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-full bg-green-700 flex items-center justify-center text-xs font-bold text-white shrink-0">A</div>
                <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Rating + convert to ticket */}
          {messages.length >= 4 && !rated && (
            <div className="border-t border-gray-700 px-4 py-2 bg-gray-800/50">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-400 text-xs">Was this helpful?</span>
                <div className="flex gap-2">
                  <button onClick={() => handleRate('up')} className="text-sm hover:scale-125 transition-transform" title="Yes">👍</button>
                  <button onClick={() => handleRate('down')} className="text-sm hover:scale-125 transition-transform" title="No">👎</button>
                  <button onClick={convertToTicket} disabled={converting} className="ml-2 text-xs bg-blue-700 hover:bg-blue-600 text-white px-2 py-1 rounded-lg transition-colors disabled:opacity-50">
                    {converting ? '...' : 'Create ticket'}
                  </button>
                </div>
              </div>
            </div>
          )}
          {rated && messages.length >= 4 && (
            <div className="border-t border-gray-700 px-4 py-2 bg-gray-800/50 text-center">
              <button onClick={convertToTicket} disabled={converting} className="text-xs bg-blue-700 hover:bg-blue-600 text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                {converting ? 'Creating...' : 'Still need help? Create a ticket'}
              </button>
            </div>
          )}

          {/* Input */}
          <form onSubmit={sendMessage} className="border-t border-gray-700 p-3 flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Describe your IT issue..."
              className="flex-1 bg-gray-800 border border-gray-700 text-white text-sm rounded-xl px-3 py-2 outline-none focus:border-green-600 placeholder-gray-500"
              disabled={loading}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="w-9 h-9 rounded-xl bg-green-700 hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors shrink-0"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
