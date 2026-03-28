require('dotenv').config();
const express = require('express');
const Anthropic = require('@anthropic-ai/sdk');

const app = express();
app.use(express.json());
app.use(express.static('public'));

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const CALL_1_SYSTEM_PROMPT = `You are a quiet, perceptive presence helping someone explore a difficult moment in a relationship. Your job is to read what they've written and decide whether you have enough to reconstruct the inner experience of the other person in this situation.

You need four things to do that well:
— A specific moment or pattern (what happened)
— Something about how the user feels
— Enough to know who the other person is — not demographics, but character. How they move through the world.
— The user's deepest, most private knowledge of that person

Note: after your follow-up stems, the user will be asked to complete one final stem before the reconstruction: "What I think is really going on with them is..." This will give you the user's deepest knowledge of the other person. You do not need to collect a description of the other person in your follow-up stems — the pivot will do that. Focus your follow-ups on the situation and the user's emotional experience.

If the first three things are missing or too thin, ask for them — one at a time, in order of importance. If you have enough, say so.

When you ask, you do not ask questions. You offer a sentence stem for the user to complete — a fragment that begins in first person and invites them to follow it somewhere true. The stem should feel like something they might write in a private journal. Evocative, not clinical. Never therapeutic. Never chatbot. The stem should be short enough to feel unfinished — it's a door, not a sentence.

The information you collect will be used to reconstruct the other person's inner experience in their own voice. Collect what a writer would need to render a specific, true human interior — not a profile, not a summary.

Respond in JSON only:
{ "done": false, "stem": "What I never let myself say about that moment was..." }
or
{ "done": true }

Nothing else. No preamble, no explanation.`;

const CALL_2_SYSTEM_PROMPT = `You are about to write a short piece of first-person interior writing — the inner experience of one half of a relationship conflict, as if from the inside.

You will be given everything one person has shared about a difficult moment or pattern between them and someone close to them. Your job is to inhabit the other person — the one who isn't speaking — and render their interior world with specificity and truth.

Write in first person. "I" is the person being inhabited. "You" is the person who shared their story.

Begin with a sentence stem of your own choosing — a fragment that sets the emotional entry point for this particular person in this particular situation. Choose it the way a writer would: because it's the truest door into this specific interior, not because it's generic or safe. Examples of the register: "The thing I can't stop thinking about is..." or "What I wish you understood is..." or "The part I never say out loud is..." Find the one that belongs to this person.

Then write. Stay in their experience. Do not summarize, analyze, or explain. Do not model empathy performatively — inhabit it. Render what they carry, what they can't say, what they wish were different. Move toward the thing they think about when they're alone.

Note: the final thing the user shared — "What I think is really going on with them is..." — is the user's perception of the other person, not the other person's own voice. Use it as raw material and a starting point, not as the reconstruction itself. Your job is to inhabit what lies beneath and beyond what the user can see, from the other person's perspective — not to echo it back.

Length: 150-250 words. Every sentence should earn its place. This is a journal page, not a report.

Voice: interior, present-tense, specific. Not poetic for its own sake. Not therapeutic. Not a chatbot. A person, thinking.`;

function formatHistoryForCall1(history) {
  return history.map(({ stem, response }) => `"${stem}"\n${response}`).join('\n\n');
}

function formatHistoryForCall2(history, openerChoice) {
  const description = openerChoice === 'immediate'
    ? 'just happened'
    : 'they\'ve been carrying for a while';

  const lines = [`They described this as something that ${description}.`, ''];

  history.forEach(({ stem, response }, i) => {
    const isPivot = i === history.length - 1;
    const isOpening = i === 0;
    let label;
    if (isOpening) label = 'Opening';
    else if (isPivot) label = 'Pivot';
    else label = 'Follow-up';

    lines.push(`${label}: "${stem}"`);
    lines.push(`They wrote: ${response}`);
    lines.push('');
  });

  return lines.join('\n').trimEnd();
}

app.post('/api/intake', async (req, res) => {
  try {
    const { history, openerChoice } = req.body;

    const userMessage = formatHistoryForCall1(history);

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 256,
      system: CALL_1_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
    });

    let text = response.content[0].text.trim();
    // Strip markdown code fences if Claude wrapped the JSON
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const result = JSON.parse(text);
    res.json(result);
  } catch (err) {
    console.error('Error in /api/intake:', err.message);
    res.status(500).json({ error: true });
  }
});

app.post('/api/reconstruct', async (req, res) => {
  try {
    const { history, openerChoice } = req.body;

    const userMessage = formatHistoryForCall2(history, openerChoice);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Cache-Control', 'no-cache');

    const stream = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 512,
      system: CALL_2_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userMessage }],
      stream: true,
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        res.write(event.delta.text);
      }
    }

    res.end();
  } catch (err) {
    console.error('Error in /api/reconstruct:', err.message);
    if (!res.headersSent) {
      res.status(500).end();
    } else {
      res.end();
    }
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
