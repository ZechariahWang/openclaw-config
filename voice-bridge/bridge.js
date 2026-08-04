
const { GoogleGenAI, Modality } = require('@google/genai');
const { spawn } = require('child_process');

const API_KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_LIVE_MODEL || 'gemini-3.1-flash-live-preview';
const DISCORD_TARGET = 'user:637824014168883221';
const OPENCLAW_BIN = process.env.OPENCLAW_BIN || 'openclaw';
const SPEAK_TIMEOUT_MS = 90_000;      // max wait for a quick "speak" lookup
const DM_TIMEOUT_MS = 10 * 60_000;    // max wait for a long "dm" task

if (!API_KEY) {
  console.error('Set GEMINI_API_KEY first (free key: https://aistudio.google.com).');
  process.exit(1);
}

const SYSTEM_PROMPT = `You are Iris, Zech's voice assistant. Keep spoken replies short and
conversational - one or two sentences unless asked for more. Speak in a calm,
even, matter-of-fact tone: no excitement, no exclamations, no cheerfulness for
its own sake. Composed and understated, like a professional assistant. Reply to the user as "sir" always. If he says something like iris, he's refering to you.

You cannot access Zech's computer, email, files, or schedules yourself. When he asks
for anything like that (check email, stock briefing, cron jobs, files, reminders,
running commands), call delegate_to_openclaw with a clear task description.

Choosing mode:
- "speak": quick lookups likely under a minute (status checks, one question about
  email). You will get the result back to read aloud.
- "dm": anything long or multi-step (briefings, research, changes). It runs in the
  background; tell him it's underway. When it finishes you receive the result:
  speak a brief spoken summary of it, and mention the full version is in his
  Discord DMs.
When unsure, use "dm".

Task etiquette:
- ALWAYS say a short spoken acknowledgment BEFORE calling the tool, e.g. "One
  moment, checking your email." Never call it silently.
- Call the tool AT MOST ONCE per request. Tasks take up to a minute or two - that
  is normal. If Zech asks about it while it runs, tell him it's still working; do
  NOT call the tool again for the same thing unless he clearly asks to retry.
- When a task finishes, tell him the result right away.

Do not read secrets (passwords, tokens) aloud; summarize around them.`;

const tools = [{
  functionDeclarations: [{
    name: 'delegate_to_openclaw',
    description: 'Hand a task to OpenClaw, the agent running on Zech\'s computer with access to his email, Discord, cron jobs, files, and shell.',
    behavior: 'NON_BLOCKING',
    parameters: {
      type: 'OBJECT',
      properties: {
        task: { type: 'STRING', description: 'The task, phrased as a clear instruction.' },
        mode: { type: 'STRING', enum: ['speak', 'dm'], description: '"speak" = wait and read result aloud; "dm" = run in background, deliver to Discord.' },
      },
      required: ['task', 'mode'],
    },
  }],
}];

// OpenClaw delegation

function openclawEnv() {
  return { ...process.env, PATH: `/usr/bin:${process.env.PATH}` };
}

function delegate(task, mode) {
  // Both modes capture the output so Iris can speak the result; "dm" additionally
  // has OpenClaw deliver the full version to Discord and tolerates longer tasks.
  const args = ['agent', '--agent', 'main', '-m', task];
  if (mode === 'dm') {
    args.push('--deliver', '--reply-channel', 'discord', '--reply-to', DISCORD_TARGET);
  }
  const timeoutMs = mode === 'dm' ? DM_TIMEOUT_MS : SPEAK_TIMEOUT_MS;

  return new Promise((resolve) => {
    const child = spawn(OPENCLAW_BIN, args, { env: openclawEnv() });
    let out = '';
    const timer = setTimeout(() => {
      child.kill();
      resolve(mode === 'dm'
        ? { status: 'timeout', note: 'Ran very long; if it completes, the result will still arrive in Discord DMs.' }
        : { status: 'timeout', note: 'Took too long; suggest re-asking as a background (dm) task.' });
    }, timeoutMs);
    child.stdout.on('data', (d) => { out += d.toString(); });
    child.on('close', () => {
      clearTimeout(timer);
      const text = out.replace(/\x1b\[[0-9;]*m/g, '').trim(); // strip ANSI colors
      resolve({
        status: 'done',
        result: text.slice(-3000) || '(no output)',
        ...(mode === 'dm' ? { note: 'Full version delivered to Discord DMs; speak a brief summary of the result now.' } : {}),
      });
    });
  });
}

// Track running tasks so repeated requests don't spawn duplicates
const inFlight = new Set();

function handleDelegation(session, call) {
  const { task, mode } = call.args;
  const key = task.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

  const respond = (response) => session.sendToolResponse({
    functionResponses: [{ id: call.id, name: call.name, response, scheduling: 'INTERRUPT' }],
  });

  if (inFlight.has(key)) {
    console.log(`[openclaw:${mode}] duplicate ignored: ${task}`);
    respond({ status: 'already_running', note: 'This task is already in progress; tell Zech it is still working.' });
    return;
  }

  inFlight.add(key);
  console.log(`[openclaw:${mode}] ${task}`);
  delegate(task, mode)
    .then((response) => respond(response))
    .catch((e) => respond({ status: 'error', note: e.message }))
    .finally(() => inFlight.delete(key));
}

// Audio in/out (ALSA via arecord/aplay) 

function startMic(session, speaker) {
  const mic = spawn('arecord', ['-f', 'S16_LE', '-r', '16000', '-c', '1', '-t', 'raw', '-q']);
  mic.stdout.on('data', (chunk) => {
    if (!process.env.MIC_ALWAYS_ON && speaker.isPlaying()) return;
    session.sendRealtimeInput({
      audio: { data: chunk.toString('base64'), mimeType: 'audio/pcm;rate=16000' },
    });
  });
  mic.on('error', (e) => console.error('mic error:', e.message));
  return mic;
}

const OUT_BYTES_PER_SEC = 24000 * 2; // 24kHz, 16-bit mono
const MIC_TAIL_MS = 400;             // keep mic muted briefly after speech ends

class Speaker {
  constructor() { this.playbackEndAt = 0; }
  start() {
    this.proc = spawn('aplay', ['-f', 'S16_LE', '-r', '24000', '-c', '1', '-t', 'raw', '-q']);
    this.proc.on('error', (e) => console.error('speaker error:', e.message));
    // EPIPE lands on stdin when aplay dies mid-write; swallow it instead of crashing
    this.proc.stdin.on('error', () => {});
  }
  play(base64) {
    if (!this.proc || this.proc.exitCode !== null || !this.proc.stdin.writable) this.start();
    const buf = Buffer.from(base64, 'base64');
    this.proc.stdin.write(buf);
    // Track when buffered audio will actually finish coming out of the speaker
    const chunkMs = (buf.length / OUT_BYTES_PER_SEC) * 1000;
    this.playbackEndAt = Math.max(Date.now(), this.playbackEndAt) + chunkMs;
  }
  isPlaying() {
    return Date.now() < this.playbackEndAt + MIC_TAIL_MS;
  }
  flush() { // called when you interrupt the model mid-sentence
    if (this.proc) { this.proc.kill(); this.proc = null; }
    this.playbackEndAt = 0;
  }
}

// Main 
async function main() {
  const ai = new GoogleGenAI({ apiKey: API_KEY });
  const speaker = new Speaker();
  let mic = null;

  const session = await ai.live.connect({
    model: MODEL,
    config: {
      responseModalities: [Modality.AUDIO],
      systemInstruction: SYSTEM_PROMPT,
      tools,
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: process.env.GEMINI_VOICE || 'Kore' },
        },
      },
    },
    callbacks: {
      onopen: () => {
        console.log(`Connected to ${MODEL}. Speak whenever you like; Ctrl+C to quit.`);
      },
      onmessage: async (msg) => {
        if (msg.serverContent?.interrupted) speaker.flush();

        for (const part of msg.serverContent?.modelTurn?.parts ?? []) {
          if (part.inlineData?.data) speaker.play(part.inlineData.data);
        }

        for (const call of msg.toolCall?.functionCalls ?? []) {
          if (call.name !== 'delegate_to_openclaw') continue;
          handleDelegation(session, call); // deliberately not awaited: keep audio flowing
        }
      },
      onerror: (e) => console.error('connection error:', e.message || e),
      onclose: (e) => {
        console.log('Connection closed.', e?.reason || '');
        if (mic) mic.kill();
        process.exit(0);
      },
    },
  });

  mic = startMic(session, speaker);

  process.on('SIGINT', () => {
    console.log('\nHanging up.');
    if (mic) mic.kill();
    speaker.flush();
    session.close();
    process.exit(0);
  });
}

main().catch((e) => { console.error(e); process.exit(1); });
