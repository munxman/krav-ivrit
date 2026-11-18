// Scheduling and interleaving adapted from Study Pocket's basics-engine.js
// and guided-session-model.js. Calendar helpers adapted from study-chain.js.
export const STORAGE_KEY = 'krav-ivrit:progress:v1';
export const PACKS = {
  commands: 'Class commands', numbers: 'Numbers 1–10', body: 'Body parts',
  strikes: 'Strikes & defences', weapons: 'Weapons', dojo: 'Roles & dojo',
  courtesy: 'Courtesy', everyday: 'Everyday phrases',
};
export const GRADES = ['Again', 'Hard', 'Good', 'Easy'];
export const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;
const calendar = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Europe/Tallinn', year: 'numeric', month: '2-digit', day: '2-digit',
});
export const day = timestamp => calendar.format(timestamp);
const ordinal = date => Date.parse(date + 'T12:00:00Z') / DAY;
const shift = (date, amount) => new Date((ordinal(date) + amount) * DAY).toISOString().slice(0, 10);

export function fresh() {
  return {
    app: 'krav-ivrit', version: 1, cards: {}, history: [],
    settings: { newLimit: 5, showHebrew: false, speed: 1, disabledPacks: [], systemVoiceConfirmed: false },
  };
}

export function enabledTerms(terms, state) {
  return terms.filter(term => !state.settings.disabledPacks.includes(term.pack));
}

export function dueTerms(terms, state, now = Date.now()) {
  return enabledTerms(terms, state)
    .filter(term => Object.hasOwn(state.cards, term.id) && state.cards[term.id].due <= now)
    .sort((a, b) => state.cards[a.id].due - state.cards[b.id].due);
}

function interleave(queue, previousPack) {
  const result = [];
  while (queue.length) {
    const different = queue.findIndex(term => term.pack !== previousPack);
    const [term] = queue.splice(Math.max(0, different), 1);
    result.push(term);
    previousPack = term.pack;
  }
  return result;
}

export function planSession(terms, state, now = Date.now()) {
  const reviews = interleave(dueTerms(terms, state, now));
  const today = day(now);
  const remaining = Math.max(0, state.settings.newLimit -
    Object.values(state.cards).filter(card => card.introduced === today).length);
  const unseen = enabledTerms(terms, state).filter(term => !Object.hasOwn(state.cards, term.id));
  const introduced = interleave(unseen, reviews.at(-1)?.pack).slice(0, Math.min(5, remaining));
  return [
    ...reviews.map(term => ({ term, phase: 'review' })),
    ...introduced.map(term => ({ term, phase: 'new' })),
  ];
}

export function cardMode(term, card, index) {
  const pool = term.pack === 'commands' ? ['act', 'recall'] : ['hear', 'recall'];
  if (!card) return pool[index % pool.length];
  return [...pool].sort((a, b) => (card.modes[a] || 0) - (card.modes[b] || 0))[0];
}

export function schedule(previous, grade, mode, now = Date.now()) {
  const card = previous || { introduced: day(now), ease: 2.5, interval: 0, repetitions: 0, attempts: 0, modes: {} };
  const quality = { Again: 1, Hard: 3, Good: 4, Easy: 5 }[grade];
  let ease = Math.max(1.3, Math.min(3.5, card.ease + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)));
  let repetitions = card.repetitions + 1;
  let interval;
  switch (grade) {
    case 'Again':
      repetitions = 0;
      interval = 10 * MINUTE;
      break;
    case 'Hard':
      interval = Math.max(DAY, Math.round(card.interval * 1.2 / DAY) * DAY);
      break;
    case 'Good':
    case 'Easy': {
      const days = card.interval / DAY;
      const next = days < 1 ? 1 : card.repetitions <= 1 ? 3 : days * ease;
      interval = Math.round(grade === 'Easy' ? Math.max(3, next * 1.3) : next) * DAY;
      break;
    }
    default:
      throw new Error('Unknown grade');
  }
  interval = Math.min(365 * DAY, interval);
  return {
    ...card, due: now + interval, interval, ease, repetitions, attempts: card.attempts + 1,
    modes: { ...card.modes, [mode]: now },
  };
}

export function stats(state, now = Date.now()) {
  const today = day(now);
  const totals = new Map();
  for (const session of state.history) {
    totals.set(session.day, (totals.get(session.day) || 0) + session.ms);
  }
  let current = totals.has(today) ? today : shift(today, -1);
  let streak = 0;
  while (totals.has(current)) {
    streak++;
    current = shift(current, -1);
  }
  return { streak, elapsed: totals.get(today) || 0, today };
}

export function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function choicesFor(term, pool, limit = 4) {
  const labels = new Set([term.english]);
  const result = [term];
  const candidates = [
    ...shuffle(pool.filter(item => item.pack === term.pack)),
    ...shuffle(pool.filter(item => item.pack !== term.pack)),
  ];
  for (const candidate of candidates) {
    if (result.length >= limit) break;
    if (labels.has(candidate.english)) continue;
    labels.add(candidate.english);
    result.push(candidate);
  }
  return shuffle(result);
}

const isObject = value => value && typeof value === 'object' && !Array.isArray(value);
const natural = value => Number.isSafeInteger(value) && value >= 0;
const validDay = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(ordinal(value)) && shift(value, 0) === value;

export function restore(raw) {
  if (!isObject(raw) || raw.app !== 'krav-ivrit' || raw.version !== 1 ||
      !isObject(raw.cards) || !Array.isArray(raw.history) || !isObject(raw.settings)) {
    throw new Error('Choose a Krav Ivrit version 1 backup.');
  }
  const { settings } = raw;
  if (!natural(settings.newLimit) || settings.newLimit > 50 ||
      typeof settings.showHebrew !== 'boolean' || ![0.75, 1].includes(settings.speed) ||
      (settings.systemVoiceConfirmed !== undefined && typeof settings.systemVoiceConfirmed !== 'boolean') ||
      !Array.isArray(settings.disabledPacks) || !settings.disabledPacks.every(id => Object.hasOwn(PACKS, id))) {
    throw new Error('The backup contains invalid settings.');
  }
  const cards = {};
  for (const [id, card] of Object.entries(raw.cards)) {
    if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(id) || !isObject(card) ||
        !validDay(card.introduced) || !natural(card.due) || !natural(card.interval) ||
        !Number.isFinite(card.ease) || card.ease < 1.3 || card.ease > 3.5 ||
        !natural(card.repetitions) || !natural(card.attempts) || !isObject(card.modes)) {
      throw new Error('The backup contains an invalid review schedule.');
    }
    const modes = {};
    for (const mode of ['hear', 'act', 'recall']) {
      if (card.modes[mode] === undefined) continue;
      if (!natural(card.modes[mode])) throw new Error('The backup contains invalid practice dates.');
      modes[mode] = card.modes[mode];
    }
    const { introduced, due, interval, ease, repetitions, attempts } = card;
    cards[id] = { introduced, due, interval, ease, repetitions, attempts, modes };
  }
  const history = raw.history.map(record => {
    if (!isObject(record)) throw new Error('The backup contains invalid session history.');
    const { day: date, at, ms, kind, reviews, newItems, answered, correct, scored, textMode = false } = record;
    if (!validDay(date) || !natural(at) || at > 253402214399999 ||
        !natural(ms) || ms > 10 * MINUTE || !['practice', 'monthly'].includes(kind) ||
        ![reviews, newItems, answered, correct].every(natural) || correct > answered ||
        typeof scored !== 'boolean' || typeof textMode !== 'boolean' ||
        (kind === 'monthly' && (answered > 20 || scored !== (answered === 20))) ||
        (kind === 'practice' && (scored || textMode))) {
      throw new Error('The backup contains invalid session history.');
    }
    return { day: date, at, ms, kind, reviews, newItems, answered, correct, scored, textMode };
  });
  const { newLimit, showHebrew, speed, disabledPacks, systemVoiceConfirmed = false } = settings;
  return { app: 'krav-ivrit', version: 1, cards, history,
    settings: { newLimit, showHebrew, speed, disabledPacks: [...new Set(disabledPacks)], systemVoiceConfirmed } };
}
