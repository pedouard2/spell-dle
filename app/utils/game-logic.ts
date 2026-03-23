import seedrandom from 'seedrandom';
import { differenceInDays } from 'date-fns';

// Keep a small backup list for Daily mode & API fallbacks
export const STATIC_WORD_DATABASE = [
  // Easy
  { word: 'friend', rank: 150 }, { word: 'really', rank: 200 },
  { word: 'people', rank: 100 }, { word: 'because', rank: 300 },
  // Medium
  { word: 'thorough', rank: 2500 }, { word: 'character', rank: 2200 },
  { word: 'separate', rank: 2100 }, { word: 'license', rank: 2300 },
  // Hard
  { word: 'bureaucracy', rank: 5500 }, { word: 'miscellaneous', rank: 6000 },
  { word: 'conscientious', rank: 8000 }, { word: 'supersede', rank: 7500 },
];

export type Difficulty = 'easy' | 'medium' | 'hard';
export type GameMode = 'daily' | 'infinite';

interface DatamuseWord {
  word: string;
}

const getDifficultyParams = (diff: Difficulty) => {
  // Config for Datamuse API
  // sp = spelling pattern (? = wildcards)
  // frequency threshold (f value in Datamuse is weird, simpler to trust length + randomness)
  switch (diff) {
    case 'easy': 
      return { minLen: 4, maxLen: 6 };
    case 'medium': 
      return { minLen: 7, maxLen: 10 };
    case 'hard': 
      return { minLen: 11, maxLen: 15 };
  }
};

// Helper: Generate a random string of '?' for the API query
const getRandomPattern = (min: number, max: number) => {
  const length = Math.floor(Math.random() * (max - min + 1)) + min;
  // We fix the first letter to ensure variety, otherwise API always returns 'a' words first
  const alphabet = "abcdefghijklmnopqrstuvwxyz";
  const startChar = alphabet[Math.floor(Math.random() * alphabet.length)];
  return startChar + '?'.repeat(length - 1);
};

// New Async Function to get word from API
async function fetchInfiniteWord(
  difficulty: Difficulty,
  signal?: AbortSignal,
): Promise<string | null> {
  const { minLen, maxLen } = getDifficultyParams(difficulty);
  const pattern = getRandomPattern(minLen, maxLen);
  
  try {
    // datamuse api: sp = spelling pattern, max = 20 results, md=f (frequency metadata)
    const res = await fetch(
      `https://api.datamuse.com/words?sp=${pattern}&max=20&md=f`,
      { signal },
    );
    if (!res.ok) throw new Error('API Failed');
    
    const data = (await res.json()) as DatamuseWord[];
    if (!Array.isArray(data) || data.length === 0) return null;

    // Filter out words that contain spaces or hyphens
    const cleanWords = data.filter(
      (item) => typeof item.word === 'string' && /^[a-zA-Z]+$/.test(item.word),
    );
    
    if (cleanWords.length === 0) return null;

    // Pick a random one from the results
    const randomIndex = Math.floor(Math.random() * cleanWords.length);
    return cleanWords[randomIndex].word;
  } catch (e) {
    if (signal?.aborted || (e instanceof DOMException && e.name === 'AbortError')) {
      throw e;
    }
    console.error("API Error, using fallback", e);
    return null;
  }
}

// Updated Main Function (Now Async)
export const getTargetWord = async (
  difficulty: Difficulty,
  mode: GameMode,
  signal?: AbortSignal,
): Promise<string> => {
  
  // 1. DAILY MODE (Keep Static/Seeded)
  if (mode === 'daily') {
    const minRank = difficulty === 'easy' ? 0 : difficulty === 'medium' ? 1000 : 5000;
    const maxRank = difficulty === 'easy' ? 1000 : difficulty === 'medium' ? 5000 : 100000;
    
    // Filter local db
    const eligible = STATIC_WORD_DATABASE.filter(w => w.rank >= minRank && w.rank <= maxRank);
    const pool = eligible.length > 0 ? eligible : STATIC_WORD_DATABASE; // Fallback to all if empty

    const daysSinceEpoch = differenceInDays(new Date(), new Date(1970, 0, 1));
    const seed = `${difficulty}-${daysSinceEpoch}`;
    const rng = seedrandom(seed);
    const index = Math.floor(rng() * pool.length);
    
    return pool[index].word;
  }

  // 2. INFINITE MODE (API)
  const apiWord = await fetchInfiniteWord(difficulty, signal);
  if (apiWord) return apiWord;

  // 3. FALLBACK (If API fails)
  const randomFallback = STATIC_WORD_DATABASE[Math.floor(Math.random() * STATIC_WORD_DATABASE.length)];
  return randomFallback.word;
};
