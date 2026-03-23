import seedrandom from 'seedrandom';
import { differenceInDays } from 'date-fns';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameMode = 'daily' | 'infinite';

export interface TargetWordData {
  word: string;
  definition: string;
  phonetic: string;
  audioUrl: string | null;
}

interface DatamuseWord {
  word?: string;
  tags?: string[];
}

interface DictionaryEntry {
  phonetic?: string;
  phonetics?: Array<{ audio?: string }>;
  meanings?: Array<{
    definitions?: Array<{ definition?: string }>;
  }>;
}

interface CandidateWord {
  word: string;
  frequency: number;
}

const DAILY_API_VERSION = 'daily-v3';
const DATAMUSE_MAX_RESULTS = 100;
const WORD_FETCH_ATTEMPTS = 8;
const MAX_DICTIONARY_CHECKS_PER_ATTEMPT = 4;
const MIN_WORD_LENGTH = 4;
const MAX_WORD_LENGTH = 15;
const dictionaryCache = new Map<string, TargetWordData | null>();

const parseFrequency = (tags?: string[]) => {
  if (!Array.isArray(tags)) return null;
  const freqTag = tags.find((tag) => tag.startsWith('f:'));
  if (!freqTag) return null;
  const value = Number(freqTag.slice(2));
  return Number.isFinite(value) ? value : null;
};

const extractCandidates = (data: DatamuseWord[]) => {
  return data
    .map((item) => {
      const word = item.word?.toLowerCase() ?? '';
      const frequency = parseFrequency(item.tags);
      return { word, frequency };
    })
    .filter(
      (item): item is CandidateWord =>
        item.word.length >= MIN_WORD_LENGTH &&
        item.word.length <= MAX_WORD_LENGTH &&
        /^[a-z]+$/.test(item.word) &&
        item.frequency !== null,
    );
};

const shuffleWithRng = <T,>(list: T[], rng: () => number) => {
  const shuffled = [...list];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
};

const selectDifficultyBand = (candidates: CandidateWord[], difficulty: Difficulty) => {
  const sorted = [...candidates].sort((a, b) => b.frequency - a.frequency);
  if (sorted.length === 0) return [];

  const n = sorted.length;
  const easyEnd = Math.max(1, Math.ceil(n / 3));
  const mediumStart = Math.floor(n / 3);
  const mediumEnd = Math.max(mediumStart + 1, Math.ceil((2 * n) / 3));
  const hardStart = Math.max(0, Math.floor((2 * n) / 3));

  const easyBand = sorted.slice(0, easyEnd);
  const mediumBand = sorted.slice(mediumStart, mediumEnd);
  const hardBand = sorted.slice(hardStart);

  if (difficulty === 'easy') return easyBand.length > 0 ? easyBand : sorted;
  if (difficulty === 'medium') return mediumBand.length > 0 ? mediumBand : sorted;
  return hardBand.length > 0 ? hardBand : sorted;
};

const getSeededPattern = (seed: string) => {
  const rng = seedrandom(seed);
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const prefixLength = rng() < 0.35 ? 2 : 1;
  let prefix = '';

  for (let i = 0; i < prefixLength; i++) {
    prefix += alphabet[Math.floor(rng() * alphabet.length)];
  }

  return `${prefix}*`;
};

const getRandomPattern = () => {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const prefixLength = Math.random() < 0.25 ? 2 : 1;
  let prefix = '';

  for (let i = 0; i < prefixLength; i++) {
    prefix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }

  return `${prefix}*`;
};

const fetchDatamuseCandidates = async (pattern: string, signal?: AbortSignal) => {
  const res = await fetch(
    `https://api.datamuse.com/words?sp=${pattern}&max=${DATAMUSE_MAX_RESULTS}&md=f`,
    { signal },
  );
  if (!res.ok) {
    throw new Error(`Datamuse request failed with status ${res.status}.`);
  }

  const data = (await res.json()) as DatamuseWord[];
  if (!Array.isArray(data)) return [];
  return extractCandidates(data);
};

const fetchDictionaryWord = async (
  word: string,
  signal?: AbortSignal,
): Promise<TargetWordData | null> => {
  if (dictionaryCache.has(word)) {
    return dictionaryCache.get(word) ?? null;
  }

  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`, {
    signal,
  });
  if (res.status === 404) {
    dictionaryCache.set(word, null);
    return null;
  }
  if (!res.ok) {
    throw new Error(`Dictionary request failed with status ${res.status}.`);
  }

  const data = (await res.json()) as DictionaryEntry[];
  const entry = data[0];
  const definition = entry?.meanings?.[0]?.definitions?.[0]?.definition?.trim();
  if (!definition) {
    dictionaryCache.set(word, null);
    return null;
  }

  const audioUrl = entry?.phonetics?.find((item) => Boolean(item.audio))?.audio ?? null;

  const result = {
    word,
    definition,
    phonetic: entry?.phonetic ?? '',
    audioUrl,
  };
  dictionaryCache.set(word, result);
  return result;
};

const chooseDictionaryBackedWord = async (
  candidates: CandidateWord[],
  rng: () => number,
  signal?: AbortSignal,
) => {
  const shuffled = shuffleWithRng(candidates, rng).slice(0, MAX_DICTIONARY_CHECKS_PER_ATTEMPT);
  for (const candidate of shuffled) {
    const dictionaryWord = await fetchDictionaryWord(candidate.word, signal);
    if (dictionaryWord) return dictionaryWord;
  }
  return null;
};

const getDailyWord = async (difficulty: Difficulty, signal?: AbortSignal) => {
  const daysSinceEpoch = differenceInDays(new Date(), new Date(1970, 0, 1));
  const seedBase = `${DAILY_API_VERSION}-${difficulty}-${daysSinceEpoch}`;

  for (let attempt = 0; attempt < WORD_FETCH_ATTEMPTS; attempt++) {
    const pattern =
      attempt === WORD_FETCH_ATTEMPTS - 1
        ? '*'
        : getSeededPattern(`${seedBase}-pattern-${attempt}`);
    const candidates = await fetchDatamuseCandidates(pattern, signal);
    const band = selectDifficultyBand(candidates, difficulty);
    const dailyWord = await chooseDictionaryBackedWord(
      band,
      seedrandom(`${seedBase}-pick-${attempt}`),
      signal,
    );
    if (dailyWord) return dailyWord;
  }

  throw new Error('Unable to fetch a daily dictionary-backed word.');
};

const getInfiniteWord = async (difficulty: Difficulty, signal?: AbortSignal) => {
  for (let attempt = 0; attempt < WORD_FETCH_ATTEMPTS; attempt++) {
    const pattern = attempt >= WORD_FETCH_ATTEMPTS - 2 ? '*' : getRandomPattern();
    const candidates = await fetchDatamuseCandidates(pattern, signal);
    const band = selectDifficultyBand(candidates, difficulty);
    const infiniteWord = await chooseDictionaryBackedWord(band, Math.random, signal);
    if (infiniteWord) return infiniteWord;
  }

  throw new Error('Unable to fetch an infinite dictionary-backed word.');
};

export const getTargetWord = async (
  difficulty: Difficulty,
  mode: GameMode,
  signal?: AbortSignal,
): Promise<TargetWordData> => {
  if (mode === 'daily') {
    return getDailyWord(difficulty, signal);
  }
  return getInfiniteWord(difficulty, signal);
};
