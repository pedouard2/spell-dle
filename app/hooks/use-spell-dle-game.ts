import { useCallback, useEffect, useRef, useState } from 'react';
import { Difficulty, GameMode, getTargetWord } from '@/app/utils/game-logic';

export interface DictionaryData {
  audioUrl: string | null;
  definition: string;
  phonetic: string;
}

export interface WordResult {
  word: string;
  difficulty: Difficulty;
  misspellings: string[];
}

export type GameStatus = 'loading' | 'playing' | 'won' | 'completed' | 'error';

export function useSpellDleGame() {
  const [hasStarted, setHasStarted] = useState(false);
  const [mode, setMode] = useState<GameMode>('daily');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [targetWord, setTargetWord] = useState('');
  const [wordData, setWordData] = useState<DictionaryData | null>(null);
  const [userInput, setUserInput] = useState('');
  const [status, setStatus] = useState<GameStatus>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [feedback, setFeedback] = useState('');
  const [shake, setShake] = useState(false);
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());
  const [currentMisspellings, setCurrentMisspellings] = useState<string[]>([]);
  const [history, setHistory] = useState<WordResult[]>([]);
  const [roundKey, setRoundKey] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadRequestIdRef = useRef(0);
  const shakeTimeoutRef = useRef<number | null>(null);

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    window.speechSynthesis.cancel();
  }, []);

  const resetGame = useCallback(() => {
    stopAudio();
    if (shakeTimeoutRef.current !== null) {
      window.clearTimeout(shakeTimeoutRef.current);
      shakeTimeoutRef.current = null;
    }
    setDifficulty('easy');
    setTargetWord('');
    setWordData(null);
    setUserInput('');
    setErrorMsg('');
    setFeedback('');
    setShake(false);
    setRevealedIndices(new Set());
    setCurrentMisspellings([]);
    setHistory([]);
    setStatus('loading');
    setRoundKey((prev) => prev + 1);
  }, [stopAudio]);

  const loadWord = useCallback(
    async (signal: AbortSignal) => {
      const requestId = ++loadRequestIdRef.current;
      const isCurrentRequest = () => !signal.aborted && requestId === loadRequestIdRef.current;

      setStatus('loading');
      setErrorMsg('');
      setFeedback('');
      setUserInput('');
      setCurrentMisspellings([]);
      setWordData(null);

      let wordResult: Awaited<ReturnType<typeof getTargetWord>>;
      try {
        wordResult = await getTargetWord(difficulty, mode, signal);
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        if (!isCurrentRequest()) return;
        console.error(err);
        setErrorMsg(
          err instanceof Error
            ? err.message
            : 'Unable to load a word right now. Please check your connection and try again.',
        );
        setStatus('error');
        return;
      }

      if (!isCurrentRequest()) return;
      setTargetWord(wordResult.word);
      setRevealedIndices(new Set());
      setWordData({
        audioUrl: wordResult.audioUrl,
        definition: wordResult.definition,
        phonetic: wordResult.phonetic,
      });
      setStatus('playing');
    },
    [difficulty, mode],
  );

  useEffect(() => {
    if (!hasStarted) return;

    const controller = new AbortController();
    stopAudio();
    const timeoutId = window.setTimeout(() => {
      void loadWord(controller.signal);
    }, 0);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
      stopAudio();
    };
  }, [difficulty, hasStarted, loadWord, roundKey, stopAudio]);

  const playAudio = useCallback(() => {
    stopAudio();
    if (wordData?.audioUrl) {
      const audio = new Audio(wordData.audioUrl);
      audioRef.current = audio;
      audio.play().catch((error) => console.log('Audio blocked:', error));
      return;
    }

    if (targetWord) {
      const msg = new SpeechSynthesisUtterance(targetWord);
      msg.lang = 'en-US';
      window.speechSynthesis.speak(msg);
    }
  }, [stopAudio, targetWord, wordData]);

  useEffect(() => {
    if (status !== 'playing' || !wordData || !hasStarted) return;

    playAudio();
    const timeoutId = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timeoutId);
  }, [hasStarted, playAudio, status, wordData]);

  const nextWord = useCallback(() => {
    stopAudio();

    if (mode === 'infinite') {
      setRoundKey((prev) => prev + 1);
      return;
    }

    if (difficulty === 'easy') {
      setDifficulty('medium');
    } else if (difficulty === 'medium') {
      setDifficulty('hard');
    } else {
      setStatus('completed');
    }
  }, [difficulty, mode, stopAudio]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (status === 'won' && e.key === 'Enter') {
        e.preventDefault();
        nextWord();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nextWord, status]);

  const switchMode = useCallback(
    (nextMode: GameMode) => {
      if (nextMode === mode) return;
      setMode(nextMode);
      resetGame();
    },
    [mode, resetGame],
  );

  const setDifficultyForInfinite = useCallback(
    (nextDifficulty: Difficulty) => {
      if (mode !== 'infinite') return;
      setDifficulty(nextDifficulty);
    },
    [mode],
  );

  const revealLetter = useCallback(() => {
    if (status !== 'playing') return;
    const hiddenIndices = targetWord
      .split('')
      .map((_, i) => i)
      .filter((i) => !revealedIndices.has(i));

    if (hiddenIndices.length > 0) {
      const randomIndex = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
      setRevealedIndices((prev) => new Set(prev).add(randomIndex));
      inputRef.current?.focus();
    }
  }, [revealedIndices, status, targetWord]);

  const updateUserInput = useCallback((value: string) => {
    setUserInput(value);
    setFeedback('');
  }, []);

  const submitGuess = useCallback(() => {
    if (status !== 'playing') return;

    const guess = userInput.trim().toLowerCase();
    const target = targetWord.toLowerCase();

    if (!guess) {
      setFeedback('Enter a spelling first');
      return;
    }

    if (guess === target) {
      setHistory((prev) => [
        ...prev,
        { word: targetWord, difficulty, misspellings: currentMisspellings },
      ]);
      setStatus('won');
      setFeedback('');
      return;
    }

    if (!currentMisspellings.includes(guess)) {
      setCurrentMisspellings((prev) => [...prev, guess]);
    }
    setFeedback('Incorrect spelling');
    setShake(true);

    if (shakeTimeoutRef.current !== null) {
      window.clearTimeout(shakeTimeoutRef.current);
    }
    shakeTimeoutRef.current = window.setTimeout(() => {
      setShake(false);
      shakeTimeoutRef.current = null;
    }, 500);
  }, [currentMisspellings, difficulty, status, targetWord, userInput]);

  const startGame = useCallback(() => {
    setHasStarted(true);
    resetGame();
  }, [resetGame]);

  useEffect(() => {
    return () => {
      stopAudio();
      if (shakeTimeoutRef.current !== null) {
        window.clearTimeout(shakeTimeoutRef.current);
      }
    };
  }, [stopAudio]);

  return {
    inputRef,
    hasStarted,
    mode,
    difficulty,
    targetWord,
    wordData,
    userInput,
    status,
    errorMsg,
    feedback,
    shake,
    revealedIndices,
    history,
    startGame,
    resetGame,
    switchMode,
    setDifficultyForInfinite,
    playAudio,
    revealLetter,
    updateUserInput,
    submitGuess,
    nextWord,
  };
}
