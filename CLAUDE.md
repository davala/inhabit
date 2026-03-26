# Inhabit — Claude Code Briefing

## What This Is
Inhabit is an empathy tool. It takes a user's description of a relationship conflict and reconstructs the partner's inner experience in first-person voice. Not advice, not therapy — a moment of perspective. The core experience is a journal-like interface that guides the user through a structured intake, then delivers a first-person reconstruction of the other person's interior world.

## Philosophy
- Simplest thing that can possibly work. No frameworks, no unnecessary dependencies.
- Fewest moving parts wins every time.
- No data persistence of any kind. Nothing is logged, stored, or retained.
- When in doubt, do less.

## Stack
- **Frontend:** vanilla HTML/CSS/JS, single file at `public/index.html`
- **Backend:** Node.js with Express, single file at `api/server.js`
- **API:** Anthropic Claude, model `claude-opus-4-6`
- **Deploy target:** Vercel
- **Font:** Caveat from Google Fonts, loaded via CDN

## Project Structure
```
inhabit/
├── public/
│   └── index.html
├── api/
│   └── server.js
├── .env
├── package.json
└── vercel.json
```

## Frontend Stages
The UI is a single HTML page. JS manages four stages via show/hide — no routing, no page loads.

### Stage 1 — Landing
Opening copy followed by two buttons. Buttons set `openerChoice` to `"immediate"` or `"chronic"` and advance to Stage 2.

Opening copy (exact, do not paraphrase):
> "Inhabit is a space to step outside your own experience for a moment and into someone else's. Not advice, not therapy — just a spark of empathy. Write honestly. Nothing is saved, and no one will see it but you. The more you share, the better it works."

Button labels: *"This just happened"* / *"I've been sitting with this for a while"*

### Stage 2 — Intake
- First stem is determined by `openerChoice`:
  - `immediate`: *"The moment I keep coming back to is..."*
  - `chronic`: *"What I've been carrying for a while that I can't let go of is..."*
- Stem animates in as typewriter effect (~40ms per character)
- Textarea below for user input
- Continue button — disabled until input reaches ~30 characters. No error messages, no counters, just patience.
- On continue: append `{ stem, response }` to history array, POST to `/api/intake`
- Response is either `{ done: false, stem: "..." }` (show next stem) or `{ done: true }` (show pivot stem)
- Maximum 2 follow-up stems before pivot regardless of API response — enforce this in frontend logic
- Pivot stem (exact): *"What I think is really going on with them is..."*
- After pivot response submitted: trigger page turn, then POST to `/api/reconstruct`

### Stage 3 — Page Turn
- Pure CSS 3D transform animation. Single page flips from right to left.
- Intake content is removed from DOM after animation completes.
- Reconstruction page is visually identical to intake page.

### Stage 4 — Reconstruction + Reflection
- Reconstruction streams in from `/api/reconstruct`
- Render stream with same typewriter animation as intake stems
- After reconstruction completes: 2.5 second pause
- Reflection stem appears (exact): *"What I'm sitting with now is..."*
- Same textarea + continue button pattern
- On submit: app goes quiet. No confirmation message. A single unobtrusive "start over" link appears at bottom of page. Nothing else.

## Visual Design
- Background: ruled journal/notebook paper effect in pure CSS. Warm off-white base (`#faf8f3` or similar), horizontal ruled lines, subtle paper texture if achievable without images.
- Ruled lines should sit behind text and textarea — text sits on the lines naturally.
- Single centered column, max-width ~680px, generous padding.
- Font: Caveat throughout — stems, user input, reconstruction, everything.
- No navigation, no header, no logo, no chrome. The page is the whole experience.
- Textareas should feel like writing on the page — no heavy borders, transparent or minimal background, same font as everything else.
- Continue button: minimal, consistent with journal aesthetic. Disabled state is visually obvious (opacity) but not aggressive.

## Backend Endpoints

### POST `/api/intake`
- Receives: `{ history: [{ stem, response }, ...], openerChoice: "immediate"|"chronic" }`
- Formats history into Call 1 system prompt + user message
- Calls `claude-opus-4-6`
- Returns: `{ done: boolean, stem?: string }`

### POST `/api/reconstruct`
- Receives: `{ history: [{ stem, response }, ...], openerChoice: "immediate"|"chronic" }`
- Formats full intake history into Call 2 system prompt + user message
- Calls `claude-opus-4-6` with streaming enabled
- Returns: streaming text response
- Frontend consumes stream incrementally and feeds typewriter

## System Prompts
These are exact and must be used verbatim. Store as constants at top of `server.js`.

### CALL_1_SYSTEM_PROMPT
```
You are a quiet, perceptive presence helping someone explore a difficult moment in a relationship. Your job is to read what they've written and decide whether you have enough to reconstruct the inner experience of the other person in this situation.

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

Nothing else. No preamble, no explanation.
```

### CALL_2_SYSTEM_PROMPT
```
You are about to write a short piece of first-person interior writing — the inner experience of one half of a relationship conflict, as if from the inside.

You will be given everything one person has shared about a difficult moment or pattern between them and someone close to them. Your job is to inhabit the other person — the one who isn't speaking — and render their interior world with specificity and truth.

Write in first person. "I" is the person being inhabited. "You" is the person who shared their story.

Begin with a sentence stem of your own choosing — a fragment that sets the emotional entry point for this particular person in this particular situation. Choose it the way a writer would: because it's the truest door into this specific interior, not because it's generic or safe. Examples of the register: "The thing I can't stop thinking about is..." or "What I wish you understood is..." or "The part I never say out loud is..." Find the one that belongs to this person.

Then write. Stay in their experience. Do not summarize, analyze, or explain. Do not model empathy performatively — inhabit it. Render what they carry, what they can't say, what they wish were different. Move toward the thing they think about when they're alone.

Note: the final thing the user shared — "What I think is really going on with them is..." — is the user's perception of the other person, not the other person's own voice. Use it as raw material and a starting point, not as the reconstruction itself. Your job is to inhabit what lies beneath and beyond what the user can see, from the other person's perspective — not to echo it back.

Length: 150-250 words. Every sentence should earn its place. This is a journal page, not a report.

Voice: interior, present-tense, specific. Not poetic for its own sake. Not therapeutic. Not a chatbot. A person, thinking.
```

## Intake Data Format for Call 2
The history passed to `/api/reconstruct` should be formatted in the user message like this:

```
They described this as something that [just happened / they've been carrying for a while].

Opening: "[seed stem]"
They wrote: [seed response]

Follow-up: "[follow-up stem]"
They wrote: [follow-up response]

Follow-up: "[follow-up stem]"
They wrote: [follow-up response]

Pivot: "What I think is really going on with them is..."
They wrote: [pivot response]
```

## Environment
- API key in `.env` as `ANTHROPIC_API_KEY`
- Never log or store user input
- `.env` in `.gitignore`

## Vercel Config
`vercel.json` should route `/api/*` to the Node backend and everything else to `public/index.html`.
