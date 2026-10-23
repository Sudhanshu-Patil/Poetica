const $ = (id) => document.getElementById(id);
const composer = $('composer');
const state = { versions: [], shown: null, busy: false };

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const pct = (n) => `${Math.round(n * 100)}%`;

// ---------- networking ----------

async function post(url, body) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        let msg = res.statusText;
        try { msg = (await res.json()).error || msg; } catch { /* not JSON */ }
        throw new Error(msg);
    }
    return res;
}

async function* chunks(res) {
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    while (true) {
        const { value, done } = await reader.read();
        if (done) return;
        yield value;
    }
}

// ---------- rendering ----------

function split(text) {
    const t = text.replace(/^\s+/, '');
    const i = t.indexOf('\n');
    if (i < 0) return { title: t, body: '' };
    return { title: t.slice(0, i).replace(/^#+\s*|\*\*/g, '').trim(), body: t.slice(i + 1).replace(/^\s*\n/, '') };
}

function setMood(mood) {
    document.documentElement.style.setProperty('--mood', mood ? `var(--${mood})` : 'var(--accent)');
}

function status(msg, isError = false) {
    $('status').textContent = msg;
    $('status').classList.toggle('error', isError);
}

function showText(text) {
    const { title, body } = split(text);
    $('poemTitle').textContent = title;
    $('poemBody').textContent = body;
}

function show(v) {
    stopSpeaking();
    state.shown = v;
    showText(v.text);
    showEmotions(v);
    for (const b of $('versions').children) b.setAttribute('aria-current', b._v === v);
    for (const b of $('rounds').querySelectorAll('.round')) b.setAttribute('aria-current', b._v === v);
}

function showEmotions(v) {
    const panel = $('emotionPanel');
    panel.hidden = !v.emotions;
    setMood(v.top);
    if (!v.emotions) return;
    const rows = Object.entries(v.emotions).sort((a, b) => b[1] - a[1]).map(([label, score]) => {
        const row = document.createElement('div');
        row.className = 'bar' + (label === v.top ? ' top' : '');
        row.dataset.mood = label;
        const name = document.createElement('span');
        name.textContent = cap(label);
        const track = document.createElement('div');
        track.className = 'bar-track';
        const fill = document.createElement('div');
        fill.className = 'bar-fill';
        track.append(fill);
        const value = document.createElement('span');
        value.className = 'bar-value';
        value.textContent = pct(score);
        row.append(name, track, value);
        setTimeout(() => { fill.style.width = pct(score); }, 30);
        return row;
    });
    $('bars').replaceChildren(...rows);
}

function addVersion(v) {
    state.versions.push(v);
    const b = document.createElement('button');
    b.type = 'button';
    b._v = v;
    b.textContent = `v${state.versions.length}${v.label ? ' · ' + v.label : ''}`;
    b.addEventListener('click', () => !state.busy && show(v));
    $('versions').append(b);
    show(v);
    return v;
}

function addRound(v, target) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'round';
    b.dataset.mood = v.top;
    b._v = v;
    const no = document.createElement('span');
    no.className = 'round-no';
    no.textContent = `Round ${v.round}`;
    const mood = document.createElement('span');
    mood.className = 'round-mood';
    mood.textContent = `${cap(v.top)} ${pct(v.emotions[v.top])}`;
    const verdict = document.createElement('span');
    verdict.className = 'round-verdict' + (v.hit ? ' hit' : '');
    verdict.textContent = v.hit ? `hit ${target}` : `${target} ${pct(v.emotions[target] || 0)}`;
    b.append(no, mood, verdict);
    b.addEventListener('click', () => !state.busy && show(v));
    li.append(b);
    $('rounds').append(li);
    show(v);
}

// ---------- flows ----------

async function writePoem(body, label) {
    const res = await post('/api/write', body);
    $('poemTitle').textContent = '';
    $('poemBody').textContent = '';
    status('');
    let text = '';
    for await (const c of chunks(res)) {
        text += c;
        showText(text);
    }
    const v = addVersion({ text: text.trim(), label, brief: body });
    await analyse(v);
}

async function analyse(v) {
    status('Reading the feeling…');
    try {
        Object.assign(v, await (await post('/api/emotions', { text: v.text })).json());
        if (state.shown === v) showEmotions(v);
        status('');
    } catch (e) {
        status(`Emotion reading unavailable: ${e.message}`, true);
    }
}

async function steerPoem(body) {
    const target = body.target;
    $('steerPanel').hidden = false;
    $('rounds').replaceChildren();
    status(`Writing a first draft, then steering toward ${target}…`);
    const res = await post('/api/steer', body);
    const rounds = [];
    let buf = '';
    for await (const c of chunks(res)) {
        buf += c;
        const lines = buf.split('\n');
        buf = lines.pop();
        for (const line of lines.filter((l) => l.trim())) {
            const ev = JSON.parse(line);
            if (ev.error) throw new Error(ev.error);
            const v = { text: ev.poem, top: ev.top, emotions: ev.emotions, round: ev.round, hit: ev.hit, brief: body };
            rounds.push(v);
            addRound(v, target);
            if (!ev.hit) status(`Round ${ev.round} reads as ${ev.top}. Revising toward ${target}…`);
        }
    }
    if (!rounds.length) throw new Error('No drafts came back.');
    const best = rounds.find((r) => r.hit) || rounds.reduce((a, b) => ((b.emotions[target] || 0) > (a.emotions[target] || 0) ? b : a));
    best.label = `steered · ${target}`;
    addVersion(best);
    status(best.hit
        ? `Landed on ${target} in ${best.round} round${best.round > 1 ? 's' : ''}.`
        : `Closest to ${target} after ${rounds.length} rounds (${pct(best.emotions[target] || 0)}).`);
}

async function run(task) {
    if (state.busy) return;
    state.busy = true;
    stopSpeaking();
    document.querySelectorAll('.primary').forEach((b) => { b.disabled = true; });
    document.querySelector('.poem').classList.add('writing');
    try {
        await task();
    } catch (e) {
        status(e.message, true);
    } finally {
        state.busy = false;
        document.querySelectorAll('.primary').forEach((b) => { b.disabled = false; });
        document.querySelector('.poem').classList.remove('writing');
    }
}

// ---------- composer ----------

function syncMode() {
    const steer = composer.mode.value === 'steer';
    $('moodField').hidden = !steer;
    $('goBtn').textContent = steer ? 'Steer the poem' : 'Write the poem';
    $('modeHint').textContent = steer
        ? 'The poet drafts, a separate critic reads the feeling, and the poet revises until your mood wins (up to 4 rounds).'
        : 'The poem streams in as it is written, then gets an emotion reading.';
    if (steer) setMood(composer.target.value);
}
composer.addEventListener('change', syncMode);

$('prompt').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        composer.requestSubmit();
    }
});

composer.addEventListener('submit', (e) => {
    e.preventDefault();
    const body = Object.fromEntries(new FormData(composer));
    $('empty').hidden = true;
    $('work').hidden = false;
    state.versions = [];
    $('versions').replaceChildren();
    $('steerPanel').hidden = true;
    $('emotionPanel').hidden = true;
    run(() => (body.mode === 'steer' ? steerPoem(body) : writePoem(body, '')));
});

// ---------- refine ----------

function refine(instruction) {
    if (!state.shown || !instruction.trim()) return;
    const body = { ...state.shown.brief, poem: state.shown.text, instruction };
    $('instruction').value = '';
    run(() => writePoem(body, instruction.toLowerCase().slice(0, 24)));
}

$('refine').addEventListener('submit', (e) => {
    e.preventDefault();
    refine($('instruction').value);
});
document.querySelectorAll('.suggestions button').forEach((b) => {
    b.addEventListener('click', () => refine(b.dataset.say));
});

// ---------- read aloud ----------

const speakBtn = $('speakBtn');
function stopSpeaking() {
    if (!('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    speakBtn.setAttribute('aria-pressed', 'false');
    speakBtn.textContent = 'Read aloud';
}
if ('speechSynthesis' in window) {
    speakBtn.addEventListener('click', () => {
        if (speechSynthesis.speaking) return stopSpeaking();
        const { title, body } = split(state.shown.text);
        const u = new SpeechSynthesisUtterance(`${title}.\n\n${body}`);
        u.rate = 0.9;
        u.onend = stopSpeaking;
        speechSynthesis.speak(u);
        speakBtn.setAttribute('aria-pressed', 'true');
        speakBtn.textContent = 'Stop reading';
    });
} else {
    speakBtn.hidden = true;
}

// ---------- copy ----------

$('copyBtn').addEventListener('click', async () => {
    await navigator.clipboard.writeText(state.shown.text);
    $('copyBtn').textContent = 'Copied';
    setTimeout(() => { $('copyBtn').textContent = 'Copy'; }, 1500);
});

// ---------- share card ----------

function wrap(g, text, max) {
    const out = [];
    for (const para of text.split('\n')) {
        let line = '';
        for (const word of para.split(/\s+/).filter(Boolean)) {
            const next = line ? `${line} ${word}` : word;
            if (line && g.measureText(next).width > max) {
                out.push(line);
                line = word;
            } else {
                line = next;
            }
        }
        out.push(line);
    }
    return out;
}

$('cardBtn').addEventListener('click', async () => {
    const v = state.shown;
    const { title, body } = split(v.text);
    await Promise.all(['600 60px Fraunces', '400 36px Fraunces', 'italic 600 40px Fraunces']
        .map((f) => document.fonts.load(f)));

    const W = 1080, H = 1350, P = 96;
    const canvas = Object.assign(document.createElement('canvas'), { width: W, height: H });
    const g = canvas.getContext('2d');
    const palette = { joy: '#d99a1e', love: '#d2547a', sadness: '#3d6fb6', anger: '#c4402f', fear: '#7a56b0', surprise: '#1f9a8a' };
    const mood = palette[v.top] || '#9a4a2f';

    g.fillStyle = '#f6f1e9';
    g.fillRect(0, 0, W, H);
    const glow = g.createRadialGradient(W * 0.85, 0, 0, W * 0.85, 0, W * 0.9);
    glow.addColorStop(0, `${mood}55`);
    glow.addColorStop(1, `${mood}00`);
    g.fillStyle = glow;
    g.fillRect(0, 0, W, H);

    g.fillStyle = '#1f1b16';
    g.textBaseline = 'top';
    g.font = '600 60px Fraunces';
    let y = P;
    for (const line of wrap(g, title, W - 2 * P)) {
        g.fillText(line, P, y);
        y += 72;
    }
    y += 28;

    // Shrink the body font until the whole poem fits above the footer
    const room = H - y - P - 80;
    let size = 38, lines;
    do {
        g.font = `400 ${size}px Fraunces`;
        lines = wrap(g, body, W - 2 * P);
    } while (lines.length * size * 1.55 > room && --size > 16);
    for (const line of lines) {
        g.fillText(line, P, y);
        y += size * 1.55;
    }

    g.fillStyle = mood;
    g.fillRect(P, H - P - 44, 48, 4);
    g.fillStyle = '#1f1b16';
    g.font = 'italic 600 40px Fraunces';
    g.fillText('Poetica', P, H - P - 20);
    if (v.top) {
        g.font = '500 28px "Instrument Sans", sans-serif';
        g.textAlign = 'right';
        g.fillStyle = mood;
        g.fillText(`${cap(v.top)} ${pct(v.emotions[v.top])}`, W - P, H - P - 12);
    }

    canvas.toBlob((blob) => {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'poem'}.png`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    });
});
