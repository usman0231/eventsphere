const express = require('express');
const router = express.Router();
const { GoogleGenAI, ApiError } = require('@google/genai');
const Expo = require('../models/Expo');
const Session = require('../models/Session');
const ExhibitorApplication = require('../models/ExhibitorApplication');

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
// Default to a fast, cheap model; override with GEMINI_MODEL in .env.local.
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';

// Construct the client once (only when a key is configured).
const client = GEMINI_API_KEY ? new GoogleGenAI({ apiKey: GEMINI_API_KEY }) : null;

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
        reply: "I'm offline right now — the admin hasn't set up the Gemini API key (GEMINI_API_KEY in .env.local). Once it's set, I can answer questions about expos, sessions, exhibitors, and how to use the platform.\n\nGet a free key at https://aistudio.google.com/app/apikey",
        offline: true,
      });
    }

    const context = await buildContext();

    // Map prior turns to Gemini's content shape (assistant -> "model"), then ensure
    // the first turn is a user turn so the conversation starts correctly.
    const mapped = (Array.isArray(history) ? history : [])
      .slice(-10)
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: String(m.content || '').slice(0, 4000) }],
      }))
      .filter((m) => m.parts[0].text);
    while (mapped.length && mapped[0].role === 'model') mapped.shift();

    const contents = [...mapped, { role: 'user', parts: [{ text: message.slice(0, 4000) }] }];

    // System instruction = frozen prompt + live platform data. The volatile question
    // lives in `contents`, after the system instruction.
    const response = await client.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: `${SYSTEM_PROMPT}\n\nCurrent platform data:\n${context}`,
        maxOutputTokens: 600,
        temperature: 0.4,
        // flash-lite is fast/cheap; keep its optional "thinking" off for snappy replies.
        thinkingConfig: { thinkingBudget: 0 },
      },
    });

    const reply = (response.text || '').trim();

    if (!reply) {
      return res.status(502).json({ success: false, message: 'Empty response from chatbot' });
    }

    res.json({ success: true, reply });
  } catch (err) {
    // Map known upstream errors to friendly messages.
    if (err instanceof ApiError) {
      if (err.status === 429) {
        return res.status(503).json({ success: false, message: 'The assistant is busy right now. Please try again in a few seconds.' });
      }
      console.error('Chatbot upstream error:', err.status, err.message);
      return res.status(502).json({ success: false, message: `Chatbot upstream error (${err.status}). Please try again.` });
    }
    console.error('Chatbot error:', err.message);
    return res.status(500).json({ success: false, message: 'Chatbot is having trouble. Please try again.' });
  }
});

module.exports = router;
