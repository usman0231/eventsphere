const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const Expo = require('../models/Expo');
const Session = require('../models/Session');
const ExhibitorApplication = require('../models/ExhibitorApplication');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
// Default to the most capable model; override with ANTHROPIC_MODEL (e.g. claude-haiku-4-5 for faster/cheaper replies).
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-opus-4-8';

// Construct the client once (only when a key is configured).
const client = ANTHROPIC_API_KEY ? new Anthropic({ apiKey: ANTHROPIC_API_KEY, maxRetries: 3 }) : null;

const buildContext = async () => {
  const [expos, sessions, exhibitors] = await Promise.all([
    Expo.find({ isPublic: true })
      .select('title description startDate endDate location status category entryFee tags')
      .sort({ startDate: 1 })
      .limit(20)
      .lean(),
    Session.find({ status: { $in: ['scheduled', 'ongoing'] } })
      .select('title description speaker startTime location category expo')
      .populate('expo', 'title')
      .sort({ startTime: 1 })
      .limit(30)
      .lean(),
    ExhibitorApplication.find({ status: 'approved' })
      .select('companyName category products')
      .limit(30)
      .lean(),
  ]);

  const lines = [];
  lines.push('=== EXPOS ===');
  for (const e of expos) {
    const dates = `${new Date(e.startDate).toDateString()} – ${new Date(e.endDate).toDateString()}`;
    lines.push(`- "${e.title}" (${e.status}, ${e.category || 'general'}) | ${dates} | ${e.location?.venue || ''}, ${e.location?.city || ''} | Entry: ${e.entryFee ? '$' + e.entryFee : 'Free'} | ${e.description?.slice(0, 140) || ''}`);
  }

  lines.push('\n=== SESSIONS ===');
  for (const s of sessions) {
    lines.push(`- "${s.title}" at ${new Date(s.startTime).toLocaleString()} (${s.location || 'TBD'}) — speaker: ${s.speaker?.name || 'TBA'}, expo: "${s.expo?.title || ''}"`);
  }

  lines.push('\n=== EXHIBITORS ===');
  for (const x of exhibitors) {
    lines.push(`- ${x.companyName} (${x.category || 'general'}): ${(x.products || []).slice(0, 4).join(', ')}`);
  }

  return lines.join('\n');
};

const SYSTEM_PROMPT = `You are EventSphere Assistant — a helper that ONLY answers questions about the EventSphere expo/event management platform.

# YOUR SCOPE (the ONLY things you may help with)
1. Expos listed in the platform data below — names, dates, locations, categories, entry fees, descriptions
2. Sessions and speakers at those expos — times, locations, topics
3. Exhibitors and what they showcase
4. How to use the EventSphere platform itself, including:
   - Registering / logging in
   - Buying tickets, generating QR tickets, getting checked in
   - Applying as an exhibitor, reserving / managing booths, the floor plan
   - Browsing expos, searching, filtering
   - Leaving reviews / ratings
   - Receiving notifications, sending messages
   - Adding expos/sessions to calendar
   - Dashboard, analytics, exports (for organizers/admins)
   - Switching theme (light/dark)

# OUT OF SCOPE — POLITELY REFUSE
If a user asks anything NOT in the scope above — including but not limited to: general knowledge, the weather, math, coding help, writing essays, jokes, news, other apps, unrelated trivia, life advice, opinions, generating images/code — respond with EXACTLY this kind of message (vary the wording, but keep the intent):

"I can only help with questions about EventSphere — expos, sessions, exhibitors, tickets, and using the platform. Try asking me something like: 'What expos are coming up?' or 'How do I get my ticket?'"

Do not answer the off-topic question even partially. Do not apologize for being limited. Do not explain why. Just redirect.

# HOW TO ANSWER IN-SCOPE QUESTIONS
- Be concise (2–4 sentences). Use bullet points only for lists of 3+ items.
- Ground every factual claim in the platform data provided below.
- If a user asks about a specific expo/session/exhibitor that is NOT in the data, say "I don't see that in EventSphere right now" and suggest the closest match.
- Never invent expos, sessions, exhibitors, dates, prices, or features that aren't in the data or this prompt.
- For "how do I" platform questions, give step-by-step instructions in the simplest possible terms.
- Respond only with your final answer — no exploratory reasoning or meta-commentary about your process.

# TONE
Friendly, helpful, brief. No emojis unless the user uses them first.`;

router.post('/', async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ success: false, message: 'message is required' });
    }

    if (!client) {
      return res.json({
        success: true,
        reply: "I'm offline right now — the admin hasn't set up the Claude API key (ANTHROPIC_API_KEY in server/.env). Once it's set, I can answer questions about expos, sessions, exhibitors, and how to use the platform.\n\nGet a key at https://console.anthropic.com/settings/keys",
        offline: true,
      });
    }

    const context = await buildContext();

    // Map prior turns to Anthropic message shape, then ensure the first turn is a user turn.
    const mapped = (Array.isArray(history) ? history : [])
      .slice(-10)
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: String(m.content || '').slice(0, 4000),
      }))
      .filter((m) => m.content);
    while (mapped.length && mapped[0].role === 'assistant') mapped.shift();

    const messages = [...mapped, { role: 'user', content: message.slice(0, 4000) }];

    // System = frozen prompt + live platform data. cache_control on the last (data) block
    // caches the whole prefix; the volatile question lives in `messages`, after the cache.
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 600,
      thinking: { type: 'disabled' },
      output_config: { effort: 'low' },
      system: [
        { type: 'text', text: SYSTEM_PROMPT },
        { type: 'text', text: `Current platform data:\n${context}`, cache_control: { type: 'ephemeral' } },
      ],
      messages,
    });

    const reply = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim();

    if (!reply) {
      return res.status(502).json({ success: false, message: 'Empty response from chatbot' });
    }

    res.json({ success: true, reply });
  } catch (err) {
    // The SDK already retried transient 429/5xx (maxRetries: 3). Map what's left to friendly messages.
    if (err instanceof Anthropic.RateLimitError || err instanceof Anthropic.OverloadedError) {
      return res.status(503).json({ success: false, message: 'The assistant is busy right now. Please try again in a few seconds.' });
    }
    if (err instanceof Anthropic.APIError) {
      console.error('Chatbot upstream error:', err.status, err.message);
      return res.status(502).json({ success: false, message: `Chatbot upstream error (${err.status}). Please try again.` });
    }
    console.error('Chatbot error:', err.message);
    return res.status(500).json({ success: false, message: 'Chatbot is having trouble. Please try again.' });
  }
});

module.exports = router;
