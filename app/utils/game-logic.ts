import seedrandom from 'seedrandom';
import { differenceInDays } from 'date-fns';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameMode = 'daily' | 'infinite';

interface DatamuseWord {
  word: string;
}

const DAILY_API_VERSION = 'daily-v2';
const DATAMUSE_MAX_RESULTS = 100;
const DATAMUSE_DAILY_ATTEMPTS = 5;
const DATAMUSE_INFINITE_ATTEMPTS = 5;

const getDifficultyParams = (diff: Difficulty) => {
  switch (diff) {
    case 'easy':
      return { minLen: 4, maxLen: 6 };
    case 'medium':
      return { minLen: 7, maxLen: 10 };
    case 'hard':
      return { minLen: 11, maxLen: 15 };
  }
};

const extractCleanWords = (
  data: DatamuseWord[],
  minLen: number,
  maxLen: number,
) => {
  return data
    .map((item) => item.word)
    .filter(
      (word) =>
        typeof word === 'string' &&
        /^[a-zA-Z]+$/.test(word) &&
        word.length >= minLen &&
        word.length <= maxLen,
    );
};

const getRandomPattern = (min: number, max: number) => {
  const length = Math.floor(Math.random() * (max - min + 1)) + min;
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const startChar = alphabet[Math.floor(Math.random() * alphabet.length)];
  return startChar + '?'.repeat(length - 1);
};

const getPatternFromSeed = (difficulty: Difficulty, seed: string) => {
  const { minLen, maxLen } = getDifficultyParams(difficulty);
  const rng = seedrandom(seed);
  const length = Math.floor(rng() * (maxLen - minLen + 1)) + minLen;
  const alphabet = 'abcdefghijklmnopqrstuvwxyz';
  const prefixLength = difficulty === 'easy' ? 1 : 2;

  let prefix = '';
  for (let i = 0; i < prefixLength; i++) {
    prefix += alphabet[Math.floor(rng() * alphabet.length)];
  }

  return prefix + '?'.repeat(Math.max(0, length - prefixLength));
};

async function fetchSeededDailyWord(
  difficulty: Difficulty,
  seedBase: string,
  signal?: AbortSignal,
): Promise<string | null> {
  const { minLen, maxLen } = getDifficultyParams(difficulty);

  for (let attempt = 0; attempt < DATAMUSE_DAILY_ATTEMPTS; attempt++) {
    const pattern = getPatternFromSeed(difficulty, `${seedBase}-pattern-${attempt}`);

    try {
      const res = await fetch(
        `https://api.datamuse.com/words?sp=${pattern}&max=${DATAMUSE_MAX_RESULTS}&md=f`,
        { signal },
      );
      if (!res.ok) throw new Error('Daily API failed');

      const data = (await res.json()) as DatamuseWord[];
      const cleanWords = extractCleanWords(data, minLen, maxLen);
      if (cleanWords.length === 0) continue;

      const pickRng = seedrandom(`${seedBase}-pick-${attempt}`);
      const index = Math.floor(pickRng() * cleanWords.length);
      return cleanWords[index];
    } catch (e) {
      if (signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
        throw e;
      }
    }
  }

  return null;
}

async function fetchInfiniteWord(
  difficulty: Difficulty,
  signal?: AbortSignal,
): Promise<string | null> {
  const { minLen, maxLen } = getDifficultyParams(difficulty);

  for (let attempt = 0; attempt < DATAMUSE_INFINITE_ATTEMPTS; attempt++) {
    const pattern = getRandomPattern(minLen, maxLen);

    try {
      const res = await fetch(
        `https://api.datamuse.com/words?sp=${pattern}&max=20&md=f`,
        { signal },
      );
      if (!res.ok) throw new Error('Infinite API failed');

      const data = (await res.json()) as DatamuseWord[];
      if (!Array.isArray(data) || data.length === 0) continue;

      const cleanWords = extractCleanWords(data, minLen, maxLen);
      if (cleanWords.length === 0) continue;

      const randomIndex = Math.floor(Math.random() * cleanWords.length);
      return cleanWords[randomIndex];
    } catch (e) {
      if (signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
        throw e;
      }
    }
  }

  return null;
}

export const getTargetWord = async (
  difficulty: Difficulty,
  mode: GameMode,
  signal?: AbortSignal,
): Promise<string> => {
  if (mode === 'daily') {
    const daysSinceEpoch = differenceInDays(new Date(), new Date(1970, 0, 1));
    const dailySeed = `${DAILY_API_VERSION}-${difficulty}-${daysSinceEpoch}`;
    const dailyApiWord = await fetchSeededDailyWord(difficulty, dailySeed, signal);
    if (dailyApiWord) return dailyApiWord;
    throw new Error('Unable to fetch a daily word from Datamuse.');
  }

  const apiWord = await fetchInfiniteWord(difficulty, signal);
  if (apiWord) return apiWord;
  throw new Error('Unable to fetch an infinite word from Datamuse.');
};
