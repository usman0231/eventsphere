import React, { useState, useRef, useEffect } from 'react';
import api from '../utils/api';
import './Chatbot.css';

const WELCOME = {
  role: 'assistant',
  content: "Hi! I'm the EventSphere Assistant. Ask me about upcoming expos, sessions, exhibitors, or how to use the platform.",
};

const SUGGESTIONS = [
  'What expos are coming up?',
  'How do I apply as an exhibitor?',
  'Show me AI-related sessions',
  'How do I get my ticket?',
];

export default function Chatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([WELCOME]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, sending]);

  const send = async (textOverride) => {
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;
    setInput('');
    const next = [...messages, { role: 'user', content: text }];
    setMessages(next);
    setSending(true);
    try {
      const history = next.filter(m => m !== WELCOME);
      const { data } = await api.post('/api/chatbot', {
        message: text,
        history: history.slice(-12),
      });
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply || 'Sorry, no response.' }]);
    } catch (err) {
      const serverMsg = err.response?.data?.message;
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: serverMsg
          ? `⚠️ ${serverMsg}`
          : '⚠️ I had trouble reaching the server. Please try again in a moment.',
      }]);
    } finally {
      setSending(false);
    }
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      <button
        className={`cb-fab ${open ? 'cb-fab-open' : ''}`}
        onClick={() => setOpen(o => !o)}
        title="Chat with EventSphere Assistant"
      >
        <span className="cb-fab-icon">{open ? '✕' : '💬'}</span>
        {!open && <span className="cb-fab-pulse" />}
      </button>

      {open && (
        <div className="cb-panel">
          <div className="cb-header">
            <div className="cb-header-row">
              <div className="cb-avatar">🤖</div>
              <div>
                <div className="cb-title">EventSphere Assistant</div>
                <div className="cb-sub">Ask anything about expos & sessions</div>
              </div>
            </div>
          </div>

          <div className="cb-list" ref={listRef}>
            {messages.map((m, i) => (
              <div key={i} className={`cb-msg cb-msg-${m.role}`}>
                {m.role === 'assistant' && <div className="cb-msg-avatar">🤖</div>}
                <div className="cb-bubble">
                  {m.content.split('\n').map((line, j) => (
                    <p key={j}>{line}</p>
                  ))}
                </div>
              </div>
            ))}
            {sending && (
              <div className="cb-msg cb-msg-assistant">
                <div className="cb-msg-avatar">🤖</div>
                <div className="cb-bubble cb-typing">
                  <span /><span /><span />
                </div>
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="cb-suggestions">
              {SUGGESTIONS.map(s => (
                <button key={s} className="cb-sugg" onClick={() => send(s)} disabled={sending}>
                  {s}
                </button>
              ))}
            </div>
          )}

          <div className="cb-input-row">
            <input
              className="cb-input"
              placeholder={sending ? 'Thinking…' : 'Ask about expos, sessions…'}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={sending}
            />
            <button
              className="cb-send"
              onClick={() => send()}
              disabled={sending || !input.trim()}
              title="Send"
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
