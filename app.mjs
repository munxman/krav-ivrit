import {
  STORAGE_KEY, PACKS, GRADES, MINUTE, day, fresh, restore, enabledTerms,
  dueTerms, planSession, cardMode, schedule, stats, shuffle, choicesFor,
} from './engine.mjs';

const paths = {
  flame: '<path d="M12 22c4 0 7-2.8 7-6.4 0-3-1.6-5.2-3.3-7 .1 2-1.2 2.7-1.2 2.7.2-3-1.5-6.5-3.6-8.3.3 2.7-1 4.6-2.6 6.2C6.1 11.3 5 13.1 5 15.6 5 19.2 8 22 12 22Z"/><path d="M12 22c-2 0-3.3-1.3-3.3-3 0-1.5 1.1-2.8 3.3-4.8 2.2 2 3.3 3.3 3.3 4.8 0 1.7-1.3 3-3.3 3Z"/>',
  layers: '<path d="m12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  speaker: '<path d="M11 4 5 9H2v6h3l6 5V4ZM15 9a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  back: '<path d="m15 6-6 6 6 6"/>',
  commands: '<path d="M3 10v4h4l10 4V6L7 10H3Zm4 4 2 6h3l-2-5m10-5v4"/>',
  numbers: '<path d="M9 3 5 21M19 3l-4 18M3 9h18M2 15h18"/>',
  body: '<circle cx="12" cy="4.5" r="2"/><path d="M4 9h16M12 9v6m0 0-4 6m4-6 4 6"/>',
  strikes: '<path d="M12 22s7-3.5 7-10V5l-7-2-7 2v7c0 6.5 7 10 7 10Z"/><path d="m9 12 2 2 4-4"/>',
  weapons: '<path d="M12 3 3 8l9 5 9-5-9-5Zm-9 5v8l9 5 9-5V8m-9 5v8"/>',
  dojo: '<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2m2-15a3 3 0 0 1 0 6m1 3a4 4 0 0 1 3 4v2"/>',
  courtesy: '<path d="M12 20 4 12a4.5 4.5 0 0 1 6.4-6.4L12 7l1.6-1.4A4.5 4.5 0 0 1 20 12l-8 8Z"/>',
  everyday: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H4l1.5-4a8.5 8.5 0 1 1 15.5-4.5ZM8 11h9m-9 4h5"/>',
};
const icon = name => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]}</svg>`;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[c]);
const view = document.querySelector('#view');
const storageStatus = document.querySelector('#storage-status');
const backupFile = document.querySelector('#backup-file');
const player = document.querySelector('#hebrew-player') || document.createElement('audio');
player.id = 'hebrew-player';
player.preload = 'auto';
player.hidden = true;
player.setAttribute('playsinline', '');
if (!player.isConnected) document.body.append(player);
let synth = null;
try { synth = window.speechSynthesis; } catch { /* Text practice remains available. */ }
const MAX_SESSION = 10 * MINUTE;
const DRILL_TIME = 2 * MINUTE;
const PASS = 16;
let terms = [];
let state = fresh();
let screen = 'home';
let packId;
let session;
let summary;
let voice = null;
let audioError = false;
let audioTest = '';
let activeClip = null;
let clipSequence = 0;
let utterance = null;
let speechTimeout;
let settingMessage = '';
let unsaved = false;

for (const element of document.querySelectorAll('[data-icon]')) {
  element.innerHTML = icon(element.dataset.icon);
}

function storageNotice(text) {
  storageStatus.textContent = text;
  storageStatus.classList.toggle('hidden', !text);
}

function readStorage() {
  const raw = localStorage.getItem(STORAGE_KEY);
  const loaded = raw === null ? fresh() : restore(JSON.parse(raw));
  loaded.settings.audioSource ??= 'clips';
  return loaded;
}

function save(update, replace = false) {
  let latest = state;
  if (!replace && !unsaved) {
    try { latest = readStorage(); } catch { /* Keep working with the in-memory copy. */ }
  }
  state = update(latest);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    unsaved = false;
    storageNotice('');
    return true;
  } catch {
    unsaved = true;
    storageNotice('This browser could not save progress. Export a backup from Settings before closing.');
    return false;
  }
}

try {
  state = readStorage();
} catch {
  storageNotice('Saved progress could not be opened. Import a Krav Ivrit backup from Settings to restore it.');
}

window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY || session || unsaved) return;
  try {
    state = readStorage();
    render();
  } catch {
    storageNotice('Saved progress could not be opened.');
  }
});

function updateVoice() {
  let available = [];
  try { available = synth?.getVoices() ?? []; } catch { /* The system voice test can still work. */ }
  const voices = available.filter(candidate => {
    const language = candidate.lang.toLowerCase().replaceAll('_', '-');
    return language === 'he-il' || language === 'he';
  });
  const next = voices.find(candidate => candidate.localService) || voices[0] || null;
  if (next?.voiceURI === voice?.voiceURI) return;
  voice = next;
  if (state.settings.audioSource === 'system') audioError = false;
  if (!canSpeak() && session?.kind === 'monthly') session.textMode = true;
  if (terms.length) render();
}

function canSpeak() {
  if (state.settings.audioSource === 'clips') return !audioError && Boolean(player.canPlayType('audio/mpeg'));
  return Boolean(synth && typeof window.SpeechSynthesisUtterance === 'function' && !audioError &&
    (state.settings.systemVoiceConfirmed || (voice && (voice.localService || navigator.onLine))));
}

function audioNotice() {
  if (canSpeak()) return '';
  const message = state.settings.audioSource === 'clips'
    ? 'Audio is paused or could not load. Tap Play Hebrew to retry. Written pronunciation is available.'
    : audioError ? 'Hebrew audio did not play. Open Settings to retry the audio test. Written pronunciation is available.'
    : voice ? 'The Hebrew voice needs a connection. Text practice is available offline.'
    : 'Open Settings → Test Hebrew audio to try your installed Hebrew voice. Written pronunciation is available.';
  return `<p class="notice" role="status">${message}</p>`;
}

function stopSpeech() {
  clearTimeout(speechTimeout);
  activeClip = null;
  clipSequence++;
  player.pause();
  audioTest = '';
  const previous = utterance;
  utterance = null;
  if (previous) {
    try { synth?.cancel(); } catch { /* A speech failure must not prevent navigation. */ }
  }
}

function speak(term, multiplier = 1, test = false) {
  if (state.settings.audioSource === 'clips') {
    playClip(term, multiplier, test);
    return;
  }
  speakSystem(term, multiplier, test);
}

function playClip(term, multiplier, test) {
  const retrying = audioError;
  stopSpeech();
  audioError = false;
  const sequence = clipSequence;
  const failed = () => {
    if (sequence !== clipSequence) return;
    stopSpeech();
    audioError = true;
    if (session?.kind === 'monthly') session.textMode = true;
    render();
  };
  activeClip = { failed, test };
  if (test) audioTest = 'playing';
  player.src = new URL(`./audio/${term.id}.mp3`, location.href).href;
  player.playbackRate = Math.round(state.settings.speed * multiplier * 100) / 100;
  player.volume = 1;
  player.muted = false;
  speechTimeout = setTimeout(failed, 15_000);
  try {
    const playback = player.play();
    playback?.then(() => {
      if (sequence !== clipSequence) return;
      clearTimeout(speechTimeout);
      speechTimeout = setTimeout(failed, 30_000);
      if (retrying) render();
    }).catch(failed);
  } catch { failed(); }
}

player.addEventListener('error', () => activeClip?.failed());
player.addEventListener('ended', () => {
  if (!activeClip) return;
  const { test } = activeClip;
  activeClip = null;
  clearTimeout(speechTimeout);
  if (test && screen === 'settings') {
    audioTest = 'played';
    render();
  }
});

function speakSystem(term, multiplier = 1, test = false) {
  if (!test && !canSpeak()) return;
  stopSpeech();
  let current = null;
  const failed = () => {
    if (utterance !== current) return;
    stopSpeech();
    audioError = true;
    if (state.settings.systemVoiceConfirmed) {
      save(latest => ({ ...latest, settings: { ...latest.settings, systemVoiceConfirmed: false } }));
    }
    if (session?.kind === 'monthly') session.textMode = true;
    render();
  };
  try {
    if (!synth) throw new Error('Speech is unavailable');
    current = new SpeechSynthesisUtterance(term.hebrew);
    utterance = current;
    current.voice = test || state.settings.systemVoiceConfirmed ? null : voice;
    current.lang = 'he-IL';
    current.rate = Math.round(state.settings.speed * multiplier * 100) / 100;
  } catch {
    failed();
    return;
  }
  current.onend = () => {
    if (utterance !== current) return;
    clearTimeout(speechTimeout);
    utterance = null;
    if (test && screen === 'settings') {
      audioTest = 'confirm';
      render();
    }
  };
  current.onstart = () => {
    if (utterance !== current) return;
    clearTimeout(speechTimeout);
    speechTimeout = setTimeout(failed, 30_000);
  };
  current.onerror = failed;
  if (test) audioTest = 'playing';
  speechTimeout = setTimeout(failed, 10_000);
  try {
    if (synth.paused) synth.resume();
    synth.speak(current);
  } catch { failed(); }
}

synth?.addEventListener?.('voiceschanged', updateVoice);
window.addEventListener('focus', updateVoice);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) updateVoice();
});
updateVoice();
for (const event of ['online', 'offline']) {
  window.addEventListener(event, () => {
    if (!canSpeak()) {
      stopSpeech();
      if (session?.kind === 'monthly') session.textMode = true;
    }
    if (terms.length) render();
  });
}

const hebrew = (term, always = false) => (always || state.settings.showHebrew)
  ? `<span class="hebrew" lang="he" dir="rtl">${esc(term.hebrew)}</span>` : '';
const pronunciation = term => term.pronunciation?.et
  ? `<p class="pronunciation"><span class="pronunciation-label">Say it</span> <span lang="et">${esc(term.pronunciation.et)}</span></p>` : '';
const pronunciationGuide = `<details class="reading-guide">
  <summary>How to read the pronunciation</summary>
  <p>The hints approximate Hebrew using Estonian spelling. Hyphens separate syllables. CAPITALS mark the stressed syllable in each word.</p>
  <p>Read a, e, i, o and u as in Estonian. The letter j sounds like English y, š sounds like English sh, and ts sounds like the end of cats. Hebrew kh/ch is written h here; make it throaty, like the ch in Bach.</p>
</details>`;
const label = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;
const seconds = ms => Math.max(0, Math.ceil(ms / 1000));
const time = ms => `${Math.floor(seconds(ms) / 60)}:${String(seconds(ms) % 60).padStart(2, '0')}`;
const dateText = value => new Intl.DateTimeFormat('en', {
  dateStyle: 'medium', timeZone: 'UTC',
}).format(new Date(value + 'T12:00:00Z'));
const button = (name, action, type = 'secondary', symbol = '') =>
  `<button class="${type}" type="button" data-action="${action}">${name}${symbol ? icon(symbol) : ''}</button>`;

function renderStats() {
  const now = Date.now();
  const { streak, elapsed, today } = stats(state, now);
  const activeMs = session && day(session.started) === today
    ? Math.min(MAX_SESSION, Math.max(0, now - session.started)) : 0;
  document.querySelector('#streak').textContent = streak;
  document.querySelector('#due').textContent = dueTerms(terms, state, now).length;
  document.querySelector('#minutes').textContent = `${Math.floor((elapsed + activeMs) / MINUTE)} min`;
}

function home() {
  const included = enabledTerms(terms, state);
  const enabled = !state.settings.disabledPacks.includes('commands');
  const currentMonth = day(Date.now()).slice(0, 7);
  const latest = [...state.history].reverse().find(record =>
    record.kind === 'monthly' && record.scored && !record.textMode && record.day.startsWith(currentMonth));
  const monthlyStatus = !enabled ? 'Enable Class commands in Settings to start.'
    : latest ? `This month · ${latest.correct}/20 · ${latest.correct >= PASS ? 'Passed' : 'Keep practicing'}`
    : canSpeak() ? 'Pass at 16 out of 20.' : 'Written practice is available while audio is paused.';
  return `<div class="hero-grid">
    <section class="hero">
      <div class="hero-content">
        <div class="kicker">${icon('clock')} 10-minute practice</div>
        <h1>Hebrew for<br>the next class.</h1>
        <p>Review what’s due, pick up new words, and finish with a quick commands drill.</p>
        <div class="hero-actions">
          <button class="primary" type="button" data-action="start" ${included.length ? '' : 'disabled'}>Start practice ${icon('arrow')}</button>
          <small>${included.length ? 'You can finish after 2 minutes.' : 'Enable a pack in Settings to start.'}</small>
        </div>
      </div>
      <div class="hero-art" aria-hidden="true">
        <div class="flash flash-back"></div>
        <div class="flash flash-front">${icon('speaker')}Yalla<small>let’s go</small></div>
      </div>
    </section>
    <section class="panel monthly">
      <span class="feature-icon">${icon('target')}</span>
      <h2>Monthly check</h2>
      <p>20 class commands with audio and written Hebrew.</p>
      <small>${monthlyStatus}</small>
      <button class="secondary" type="button" data-action="monthly" ${enabled ? '' : 'disabled'}>Start check ${icon('arrow')}</button>
    </section>
  </div>
  <section class="packs" aria-labelledby="packs-title">
    <div class="section-head"><h2 id="packs-title">Study packs</h2><small>${terms.length} terms · offline</small></div>
    <div class="pack-grid">${Object.entries(PACKS).map(([id, name]) => {
      const count = terms.filter(term => term.pack === id).length;
      const off = state.settings.disabledPacks.includes(id);
      return `<button class="pack-card" type="button" data-action="pack" data-pack="${id}">
        <span class="feature-icon">${icon(id)}</span><span><strong>${name}</strong><small>${off ? 'Paused' : label(count, 'term')}</small></span>${icon('chevron')}
      </button>`;
    }).join('')}</div>
  </section>`;
}

function packPage() {
  const packTerms = terms.filter(term => term.pack === packId);
  return `<div class="narrow">
    ${button('Study packs', 'home', 'quiet', 'back')}
    <div class="page-heading"><h1>${PACKS[packId]}</h1><p>${label(packTerms.length, 'term')}</p></div>
    ${pronunciationGuide}
    ${audioNotice()}
    <ul class="panel term-list">${packTerms.map(term => `<li class="term-row">
      <div><strong>${esc(term.translit)}</strong>${hebrew(term)}
      ${pronunciation(term)}
      <p>${esc(term.english)} · ${esc(term.estonian)}${term.verify ? ' · Check usage' : ''}</p></div>
      ${state.settings.audioSource === 'clips' || canSpeak() ? `<button type="button" class="secondary" data-action="term-audio" data-term="${esc(term.id)}" aria-label="Play ${esc(term.translit)}">${icon('speaker')}</button>` : ''}
    </li>`).join('')}</ul>
  </div>`;
}

function settingsPage() {
  const prefs = state.settings;
  return `<div class="narrow">
    <div class="page-heading"><h1>Settings</h1></div>
    ${settingMessage ? `<p class="notice" role="status">${esc(settingMessage)}</p>` : ''}
    <section class="panel settings-card">
      <h2>Practice</h2>
      <label class="setting-row"><span>Daily new items<small>Up to five per session after due reviews.</small></span>
        <input type="number" inputmode="numeric" id="new-limit" min="0" max="50" step="1" required value="${prefs.newLimit}">
      </label>
      <div class="setting-row"><label for="show-hebrew">Show Hebrew script<small>Hearing questions always show the written word.</small></label>
        <label class="switch"><input id="show-hebrew" type="checkbox" role="switch" ${prefs.showHebrew ? 'checked' : ''}></label>
      </div>
      <label class="setting-row"><span>Playback speed</span>
        <select id="audio-speed"><option value="0.75" ${prefs.speed === 0.75 ? 'selected' : ''}>0.75×</option>
        <option value="1" ${prefs.speed === 1 ? 'selected' : ''}>1×</option></select>
      </label>
      <label class="setting-row"><span>Hebrew audio</span>
        <select id="audio-source"><option value="clips" ${prefs.audioSource === 'clips' ? 'selected' : ''}>Built-in recordings</option>
        <option value="system" ${prefs.audioSource === 'system' ? 'selected' : ''}>Phone voice</option></select>
      </label>
      ${audioNotice()}
      ${prefs.audioSource === 'clips' ? `<p class="audio-status">Hebrew recordings for all ${terms.length} terms are included in the offline download.</p>` : canSpeak() ? `<p class="audio-status">Hebrew phone voice enabled${prefs.systemVoiceConfirmed ? '' : voice?.name ? ` · ${esc(voice.name)}` : ''}</p>` : ''}
      <div class="button-group">${button('Test Hebrew audio', 'test-audio', 'secondary', 'speaker')}</div>
      ${audioTest === 'playing' ? '<p class="audio-status" role="status">Playing “shalom” (hello)…</p>' : ''}
      ${audioTest === 'played' ? '<p class="audio-status" role="status">The shalom recording finished. You can replay it with Test Hebrew audio.</p>' : ''}
      ${audioTest === 'confirm' ? `<div class="feedback" role="status">
        <p>Did you hear “shalom” (hello) spoken in Hebrew?</p>
        <div class="button-group">${button('I heard Hebrew', 'audio-confirm', 'primary')}${button('No sound or wrong language', 'audio-reject')}</div>
      </div>` : ''}
      <details class="reading-guide">
        <summary>If audio is silent on iPhone</summary>
        <p>Select Built-in recordings, turn up the media volume and tap Test Hebrew audio. Check whether sound is routed to headphones or another device. You can also <a href="./audio/shalom.mp3" target="_blank" rel="noopener noreferrer">open the shalom audio file</a> in Safari’s media player.</p>
        <p>For the optional Phone voice setting, follow these steps.</p>
        <ol>
          <li>Open iPhone Settings → Accessibility → Read &amp; Speak → Voices. On older iOS versions, look for Spoken Content.</li>
          <li>Choose Hebrew, select a voice and download it if a download button appears.</li>
          <li>Return here, turn up the media volume and tap Test Hebrew audio. Tap I heard Hebrew if the sample plays correctly.</li>
        </ol>
        <p>The test asks iPhone to choose its installed Hebrew voice even when Safari leaves it out of the voice list. If the sample is silent, check the media volume and whether audio is routed to headphones or another device, then test again.</p>
        <p><a href="https://support.apple.com/en-ie/guide/iphone/iph96b214f0/ios" target="_blank" rel="noopener noreferrer">Apple’s voice settings guide</a></p>
      </details>
      <p class="audio-status"><a href="https://github.com/munxman/krav-ivrit/blob/main/audio/README.md" target="_blank" rel="noopener noreferrer">Audio credits</a></p>
      ${pronunciationGuide}
    </section>
    <section class="panel settings-card">
      <h2>Study packs</h2>
      ${Object.entries(PACKS).map(([id, name]) => `<div class="setting-row"><label for="pack-${id}">${name}</label>
        <label class="switch"><input id="pack-${id}" type="checkbox" role="switch" data-pack="${id}"
          ${prefs.disabledPacks.includes(id) ? '' : 'checked'}></label>
      </div>`).join('')}
    </section>
    <section class="panel settings-card">
      <h2>Progress and backup</h2>
      <div class="button-group">${button('Export JSON', 'export')}${button('Import JSON', 'import')}${button('Reset progress', 'reset', 'danger')}</div>
    </section>
  </div>`;
}

function historyPage() {
  const records = [...state.history].reverse();
  return `<div class="narrow"><div class="page-heading"><h1>Practice history</h1></div>
    ${records.length ? `<ul class="panel history-list">${records.map(record => {
      const monthly = record.kind === 'monthly';
      const title = monthly ? record.textMode ? 'Monthly text practice' : 'Monthly check' : 'Daily practice';
      const detail = monthly ? record.scored ? `${record.correct}/20${record.textMode ? '' : record.correct >= PASS ? ' · Passed' : ' · Keep practicing'}`
        : `${record.answered}/20 answered`
        : `${label(record.reviews, 'review')} · ${record.newItems} new · ${record.correct}/${record.answered} drill`;
      return `<li class="term-row"><div><strong>${title}</strong><p>${detail}</p></div><small>${dateText(record.day)} · ${time(record.ms)}</small></li>`;
    }).join('')}</ul>` : '<p class="panel history-empty">Completed practice will appear here.</p>'}
  </div>`;
}

function go(next, { focus = true } = {}) {
  screen = next;
  render();
  if (focus) {
    window.scrollTo(0, 0);
    focusHeading();
  }
}

function focusHeading() {
  const heading = view.querySelector('h1');
  if (!heading) return;
  heading.tabIndex = -1;
  heading.focus({ preventScroll: true });
}

function render() {
  if (!terms.length) return;
  renderStats();
  for (const item of document.querySelectorAll('nav button')) {
    if (screen === item.dataset.action || (screen === 'pack' && item.dataset.action === 'home')) {
      item.setAttribute('aria-current', 'page');
    } else item.removeAttribute('aria-current');
  }
  if (screen === 'session') view.innerHTML = sessionPage();
  else if (screen === 'summary') view.innerHTML = summaryPage();
  else if (screen === 'pack') view.innerHTML = packPage();
  else if (screen === 'settings') view.innerHTML = settingsPage();
  else if (screen === 'history') view.innerHTML = historyPage();
  else view.innerHTML = home();
  view.setAttribute('aria-busy', 'false');
  if (screen === 'session') renderClock();
}

function commandPool() {
  return enabledTerms(terms, state).filter(term => term.pack === 'commands');
}

function refillDrill() {
  const pool = shuffle(session.commandPool);
  if (pool.length > 1 && pool[0].id === session.previousCommand) {
    [pool[0], pool[1]] = [pool[1], pool[0]];
  }
  session.drillQueue = pool;
}

function nextCommand() {
  if (session.drillQueue.length === 0) refillDrill();
  const term = session.drillQueue.shift();
  session.previousCommand = term.id;
  session.card = { term, mode: 'act', choices: choicesFor(term, session.commandPool) };
  session.feedback = null;
  render();
  focusHeading();
  playCurrent();
}

function beginDrill() {
  if (!session.commandPool.length) {
    session.phase = 'done';
    session.card = null;
    if (Date.now() - session.started >= DRILL_TIME) finish();
    else {
      render();
      focusHeading();
    }
    return;
  }
  session.phase = 'drill';
  session.drillUntil = Math.min(session.deadline, Date.now() + DRILL_TIME);
  nextCommand();
}

function nextCard() {
  const next = session.queue.shift();
  if (!next) {
    beginDrill();
    return;
  }
  session.phase = next.phase;
  const mode = cardMode(next.term, state.cards[next.term.id], session.index++);
  session.card = {
    term: next.term, mode, typed: '',
    choices: mode === 'recall' ? [] : choicesFor(next.term, enabledTerms(terms, state)),
  };
  session.feedback = null;
  render();
  focusHeading();
  playCurrent();
}

function start(kind) {
  if (session) return;
  const started = Date.now();
  const commands = commandPool();
  if (kind === 'monthly' && !commands.length) return;
  session = {
    kind, started, deadline: started + MAX_SESSION, commandPool: commands,
    answered: 0, correct: 0, reviews: 0, newItems: 0, index: 0, drillQueue: [],
    queue: kind === 'practice' ? planSession(terms, state, started) : [],
    textMode: kind === 'monthly' && !canSpeak(),
  };
  screen = 'session';
  window.scrollTo(0, 0);
  if (kind === 'monthly') {
    session.phase = 'monthly';
    nextCommand();
  } else nextCard();
}

function rateMultiplier() {
  if (session.phase === 'monthly') return 1;
  if (session.phase !== 'drill') return 1;
  const passed = DRILL_TIME - Math.max(0, session.drillUntil - Date.now());
  return passed >= 80_000 ? 1.25 : passed >= 40_000 ? 1.1 : 1;
}

function playCurrent() {
  const card = session?.card;
  if (!card || card.mode === 'recall') return;
  speak(card.term, rateMultiplier());
}

function feedbackBlock(term, outcome) {
  const result = outcome === undefined ? '' : `<p class="result" data-correct="${outcome}">${outcome ? 'Correct' : 'Answer'}</p>`;
  return `<div class="feedback" role="status">${result}
    <strong>${esc(term.translit)}</strong>${hebrew(term, session?.card?.mode !== 'recall')}
    ${pronunciation(term)}
    <p>${esc(term.english)} · ${esc(term.estonian)}</p>
    ${term.notes ? `<p>${esc(term.notes)}${term.verify ? ' · Check classroom usage' : ''}</p>` : ''}
    <p><i>${esc(term.example.translit)}</i> · ${esc(term.example.english)}</p>
  </div>`;
}

function sessionPage() {
  const { phase, feedback, card } = session;
  const captions = { review: 'Due review', new: 'New item', drill: 'Commands drill', monthly: 'Monthly check', done: 'Practice' };
  const isDrill = phase === 'drill' || phase === 'monthly';
  const hint = phase === 'monthly' ? `${session.answered + 1} / 20 · ${session.textMode ? 'Text practice' : 'Listening & reading'}`
    : card ? `${captions[phase]} · ${PACKS[card.term.pack]}` : captions[phase];
  const caption = phase === 'drill' ? `Commands drill · ${session.correct}/${session.answered} correct` : hint;
  let content;
  if (phase === 'done') {
    content = '<h1>Practice complete</h1><p>Your cards are saved. You can finish when the two-minute timer ends.</p>';
  } else if (isDrill && feedback) {
    content = `<h1>${feedback.correct ? 'Correct' : 'Answer'}</h1><p>${esc(card.term.translit)} · ${esc(card.term.english)}</p>${pronunciation(card.term)}`;
  } else if (feedback) {
    content = `<h1>${card.mode === 'recall' ? 'How well did you know it?' : 'Review the answer'}</h1>
      ${card.mode === 'recall' && card.typed.trim() ? `<p>You typed <strong>${esc(card.typed.trim())}</strong></p>` : ''}
      ${feedbackBlock(card.term, feedback.correct)}
      ${state.settings.audioSource === 'clips' || canSpeak() ? button('Play Hebrew', 'term-audio-current', 'secondary', 'speaker') : ''}
      ${card.mode === 'recall' ? `<div class="grades">${GRADES.map(grade => button(grade, 'grade-' + grade, grade === 'Good' ? 'primary' : 'secondary')).join('')}</div>`
        : `<div class="button-group">${button('Continue', 'next', 'primary full', 'arrow')}</div>`}`;
  } else if (card.mode === 'recall') {
    content = `<h1>${esc(card.term.english)}</h1><p>Say it in Hebrew, or type the Latin transliteration.</p>
      <form id="recall-form">
        <input class="recall-input" aria-label="Your transliteration" autocomplete="off" autocapitalize="off"
          spellcheck="false" maxlength="180" placeholder="Type an answer (optional)" value="${esc(card.typed)}">
        <button class="primary full" type="submit">Reveal answer ${icon('arrow')}</button>
      </form>`;
  } else {
    const prompt = card.mode === 'act' ? 'What’s the command?' : 'What did you hear?';
    content = `${audioNotice()}<h1>${prompt}</h1>
      <div class="heard-word">
        <p class="heard-translit">${esc(card.term.translit)}</p>
        <p>${hebrew(card.term, true)}</p>
        ${pronunciation(card.term)}
      </div>
      ${canSpeak() ? `<button class="secondary listen" type="button" data-action="play">${icon('speaker')} Play Hebrew</button>`
        : `<p>Choose the matching meaning.</p>${state.settings.audioSource === 'clips' ? button('Play Hebrew', 'play', 'secondary listen', 'speaker') : ''}`}
      <div class="choices">${card.choices.map(choice => `<button class="choice" type="button"
        data-action="choose" data-term="${esc(choice.id)}">${esc(choice.english)}</button>`).join('')}</div>
      ${isDrill ? '' : button('I don’t know', 'unknown', 'quiet')}`;
  }
  return `<div class="narrow"><div class="session-top">
    <button class="quiet" type="button" data-action="finish" id="finish">End session</button>
    <span class="timer" id="timer"></span>
  </div>
  <div class="progress-track" role="progressbar" aria-label="Session progress" aria-valuemin="0" aria-valuemax="100" id="progress-track">
    <div class="progress-fill" id="progress-fill"></div>
  </div>
  <section class="panel session-card">
    <p class="kicker">${caption}</p>${content}
  </section></div>`;
}

function renderClock() {
  const now = Date.now();
  const elapsed = now - session.started;
  const drilling = session.phase === 'drill';
  const until = drilling ? session.drillUntil : session.deadline;
  const timer = view.querySelector('#timer');
  if (!timer) return;
  timer.textContent = `${time(until - now)} ${drilling ? 'drill' : 'left'}`;
  const progress = Math.max(0, Math.min(100, session.kind === 'monthly' ? session.answered * 5
    : Math.floor((drilling ? 1 - (until - now) / DRILL_TIME : elapsed / MAX_SESSION) * 100)));
  view.querySelector('#progress-track').setAttribute('aria-valuenow', progress);
  view.querySelector('#progress-fill').style.width = `${progress}%`;
}

function recordCard(grade) {
  const { term, mode } = session.card;
  save(latest => ({
    ...latest, cards: { ...latest.cards, [term.id]: schedule(latest.cards[term.id], grade, mode) },
  }));
  if (session.phase === 'new') session.newItems++;
  else session.reviews++;
}

function choose(termId) {
  if (!session?.card || session.feedback) return;
  const correct = session.card.term.id === termId;
  stopSpeech();
  if (session.phase === 'monthly') {
    session.answered++;
    if (correct) session.correct++;
    if (session.answered >= 20) finish();
    else nextCommand();
  } else if (session.phase === 'drill') {
    session.answered++;
    if (correct) session.correct++;
    session.feedback = { correct };
    render();
    const current = session;
    setTimeout(() => {
      if (session === current && session.phase === 'drill' && !advanceClock()) nextCommand();
    }, 650);
  } else {
    recordCard(correct ? 'Good' : 'Again');
    session.feedback = { correct };
    render();
    focusHeading();
  }
}

function finish({ draw = true } = {}) {
  if (!session) return;
  const now = Date.now();
  const { started, kind, reviews, newItems, correct, answered, textMode } = session;
  const ms = Math.max(0, Math.min(MAX_SESSION, now - started));
  const scored = kind === 'monthly' && answered === 20;
  summary = { day: day(started), at: now, ms, kind, reviews, newItems, correct, answered, scored,
    textMode: kind === 'monthly' && textMode };
  session = null;
  stopSpeech();
  if (reviews || newItems || answered) {
    save(latest => ({ ...latest, history: [...latest.history, summary] }));
  }
  if (draw) go('summary');
  else screen = 'home';
}

function summaryPage() {
  const monthly = summary.kind === 'monthly';
  const title = monthly ? summary.textMode ? 'Monthly text practice' : 'Monthly check' : 'Practice summary';
  let score = '';
  if (monthly) {
    const result = summary.scored ? summary.textMode ? `${summary.correct}/20 correct`
      : `${summary.correct}/20 · ${summary.correct >= PASS ? 'Passed' : 'Keep practicing'}`
      : `${summary.answered}/20 answered`;
    score = `<div class="summary-score"><strong>${result}</strong>
      <span>${summary.textMode ? 'Try Test Hebrew audio in Settings before your next listening check.' : 'Pass threshold · 16/20 (80%)'}</span></div>`;
  } else {
    score = `<p class="summary-line">${label(summary.reviews, 'review')} · ${summary.newItems} new</p>
      ${summary.answered ? `<div class="summary-score"><strong>${summary.correct}/${summary.answered} correct</strong><span>Commands drill</span></div>` : ''}`;
  }
  return `<div class="narrow panel session-card"><div class="kicker">${icon('clock')} ${time(summary.ms)} practiced</div>
    <h1>${title}</h1>${score}<div class="button-group">${button('Back to today', 'home', 'primary', 'arrow')}${button('View history', 'history')}</div></div>`;
}

function advanceClock() {
  if (!session) return false;
  const now = Date.now();
  if (now >= session.deadline || (session.phase === 'drill' && now >= session.drillUntil) ||
      (session.phase === 'done' && now - session.started >= DRILL_TIME)) {
    finish();
    return true;
  }
  if (session.kind === 'practice' && session.commandPool.length && ['review', 'new'].includes(session.phase) &&
      now >= session.deadline - DRILL_TIME) {
    stopSpeech();
    beginDrill();
    return true;
  }
  return false;
}

setInterval(() => {
  if (session && !advanceClock()) renderClock();
  if (terms.length) renderStats();
}, 500);
window.addEventListener('pagehide', () => {
  if (session) finish({ draw: false });
  stopSpeech();
});
window.addEventListener('pageshow', event => {
  updateVoice();
  if (event.persisted) render();
});

document.addEventListener('input', event => {
  if (session?.card && event.target.matches('.recall-input')) session.card.typed = event.target.value;
});

view.addEventListener('submit', event => {
  if (event.target.id !== 'recall-form') return;
  event.preventDefault();
  if (advanceClock() || !session?.card || session.feedback) return;
  session.feedback = {};
  render();
  focusHeading();
});

function exportBackup() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `krav-ivrit-${day(Date.now())}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

backupFile.addEventListener('change', async () => {
  const [file] = backupFile.files;
  backupFile.value = '';
  if (!file) return;
  try {
    if (file.size > 5_000_000) throw new Error('This backup is too large.');
    const imported = restore(JSON.parse(await file.text()));
    imported.settings.systemVoiceConfirmed = false;
    if (session || !window.confirm('Replace your Krav Ivrit progress and settings with this backup?')) return;
    settingMessage = save(() => imported, true) ? 'Backup restored.' : 'Backup opened for this tab.';
  } catch (error) {
    settingMessage = error instanceof SyntaxError ? 'This file does not contain valid JSON.' : error.message;
  }
  render();
});

view.addEventListener('change', event => {
  const input = event.target;
  const patch = prefs => {
    if (input.id === 'new-limit') {
      if (!input.validity.valid) {
        input.value = prefs.newLimit;
        settingMessage = 'Enter a whole number from 0 to 50.';
        render();
        return prefs;
      }
      return { ...prefs, newLimit: Number(input.value) };
    }
    if (input.id === 'show-hebrew') return { ...prefs, showHebrew: input.checked };
    if (input.id === 'audio-speed') return { ...prefs, speed: Number(input.value) };
    if (input.id === 'audio-source') return { ...prefs, audioSource: input.value };
    const { pack } = input.dataset;
    const disabledPacks = prefs.disabledPacks.filter(id => id !== pack);
    if (!input.checked) disabledPacks.push(pack);
    return { ...prefs, disabledPacks };
  };
  if (!['new-limit', 'show-hebrew', 'audio-speed', 'audio-source'].includes(input.id) && !input.dataset.pack) return;
  if (input.id === 'audio-source') {
    stopSpeech();
    audioError = false;
  }
  settingMessage = '';
  save(latest => ({ ...latest, settings: patch(latest.settings) }));
  if (input.id === 'audio-source') render();
  renderStats();
});

document.addEventListener('click', event => {
  const control = event.target.closest('button[data-action]');
  if (!control || control.disabled || !terms.length) return;
  const { action, pack, term } = control.dataset;
  if (['home', 'history', 'settings', 'pack'].includes(action)) {
    if (session) finish({ draw: false });
    stopSpeech();
    if (action === 'pack') packId = pack;
    settingMessage = '';
    go(action);
    return;
  }
  if (session && advanceClock()) return;
  if (action === 'start') start('practice');
  else if (action === 'monthly') start('monthly');
  else if (action === 'finish') finish();
  else if (action === 'play') playCurrent();
  else if (action === 'term-audio-current') speak(session.card.term);
  else if (action === 'term-audio') speak(terms.find(item => item.id === term));
  else if (action === 'test-audio') {
    audioError = false;
    updateVoice();
    speak(terms.find(item => item.id === 'shalom') || terms[0], 1, true);
    render();
  } else if (action === 'audio-confirm' && audioTest === 'confirm') {
    audioTest = '';
    audioError = false;
    save(latest => ({ ...latest, settings: { ...latest.settings, systemVoiceConfirmed: true } }));
    render();
  } else if (action === 'audio-reject' && audioTest === 'confirm') {
    stopSpeech();
    audioError = true;
    save(latest => ({ ...latest, settings: { ...latest.settings, systemVoiceConfirmed: false } }));
    render();
  } else if (action === 'choose') choose(term);
  else if (action === 'unknown') choose(null);
  else if (action === 'next' && session?.feedback) {
    stopSpeech();
    nextCard();
  } else if (action.startsWith('grade-') && session?.feedback && session.card.mode === 'recall') {
    stopSpeech();
    recordCard(action.slice(6));
    nextCard();
  } else if (action === 'export') exportBackup();
  else if (action === 'import') backupFile.click();
  else if (action === 'reset' && window.confirm('Reset Krav Ivrit cards, streak and session history?')) {
    settingMessage = save(latest => ({ ...fresh(), settings: latest.settings })) ? 'Progress reset.' : 'Progress reset in this tab.';
    render();
  }
});

async function load() {
  try {
    const response = await fetch('./data/terms.json');
    if (!response.ok) throw new Error('Could not load practice packs.');
    terms = await response.json();
    if (!Array.isArray(terms) || !terms.length) throw new Error('No practice packs found.');
    render();
  } catch {
    view.setAttribute('aria-busy', 'false');
    view.innerHTML = '<p class="notice">Practice packs could not load. Connect to the internet and reload the app.</p>';
  }
}

async function prepareOffline() {
  const status = document.querySelector('#offline-status');
  if (!('serviceWorker' in navigator)) {
    status.textContent = 'Offline caching unavailable';
    return;
  }
  const check = () => {
    const controller = navigator.serviceWorker.controller;
    if (!controller) return;
    const channel = new MessageChannel();
    const timeout = setTimeout(() => {
      channel.port1.close();
      if (status.dataset.ready !== 'true') status.textContent = 'Updating offline audio…';
    }, 3000);
    channel.port1.onmessage = event => {
      clearTimeout(timeout);
      channel.port1.close();
      if (event.data?.version >= 5 && event.data.audio) {
        status.textContent = 'Ready for offline practice';
        status.dataset.ready = 'true';
      }
    };
    controller.postMessage({ type: 'offline-status' }, [channel.port2]);
  };
  try {
    status.textContent = 'Downloading Hebrew audio for offline use…';
    navigator.serviceWorker.addEventListener('controllerchange', check);
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
    check();
  } catch {
    status.textContent = 'Offline caching unavailable';
  }
}

load();
prepareOffline();
