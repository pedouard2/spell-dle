'use client';

import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Eye,
  Infinity as InfinityIcon,
  Loader2,
  RotateCcw,
  Trophy,
  Volume2,
  XCircle,
} from 'lucide-react';
import { Difficulty } from '@/app/utils/game-logic';
import { useSpellDleGame, WordResult } from '@/app/hooks/use-spell-dle-game';

const DIFFICULTY_LEVELS: Difficulty[] = ['easy', 'medium', 'hard'];

const getEditDistance = (a: string, b: string) => {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1),
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

function CompletionView({ history, onReset }: { history: WordResult[]; onReset: () => void }) {
  return (
    <main className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white p-4 overflow-y-auto">
      <div className="w-full max-w-lg bg-white text-slate-900 rounded-3xl p-8 shadow-2xl animate-in zoom-in duration-300 my-auto">
        <div className="text-center mb-8">
          <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-3xl font-black mb-2">Well Done!</h2>
          <p className="text-slate-500">Here is how you did.</p>
        </div>

        <ul className="space-y-6 mb-8 max-h-[50vh] overflow-y-auto pr-2" aria-label="Game summary by difficulty">
          {history.map((item, idx) => (
            <li key={idx} className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
              <div className="flex justify-between items-center p-4 bg-white border-b border-slate-100">
                <div>
                  <div className="text-xs font-bold uppercase text-slate-400">{item.difficulty}</div>
                  <div className="font-bold text-xl capitalize">{item.word}</div>
                </div>
                <div
                  className={`px-3 py-1 rounded-full text-sm font-bold ${
                    item.misspellings.length === 0
                      ? 'bg-green-100 text-green-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {item.misspellings.length === 0 ? 'Perfect' : `${item.misspellings.length} attempts`}
                </div>
              </div>

              {item.misspellings.length > 0 && (
                <div className="p-3 bg-slate-50 text-sm space-y-2">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Misspellings:
                  </div>
                  {item.misspellings.map((wrong, i) => {
                    const dist = getEditDistance(wrong, item.word);
                    return (
                      <div
                        key={i}
                        className="flex justify-between items-center bg-white px-3 py-2 rounded border border-slate-200 text-slate-600 font-mono"
                      >
                        <span className="line-through decoration-red-400 decoration-2">{wrong}</span>
                        <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 font-sans font-bold">
                          Dist: {dist}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onReset}
          className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 flex items-center justify-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-700"
        >
          <RotateCcw size={20} /> Play Again
        </button>
      </div>
    </main>
  );
}

export default function SpellDle() {
  const {
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
  } = useSpellDleGame();

  const maskedPattern = targetWord
    .split('')
    .map((char, index) => (revealedIndices.has(index) ? char : '_'))
    .join(' ');
  const hasFeedback = Boolean(feedback);
  const liveAnnouncement =
    status === 'loading'
      ? 'Loading next word.'
      : status === 'won'
        ? 'Correct spelling. Use next word to continue.'
        : status === 'error'
          ? errorMsg
          : hasFeedback
            ? feedback
            : '';

  if (!hasStarted) {
    return (
      <main className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-slate-900">
        <div className="text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <h1 className="text-6xl font-black tracking-tighter">SPELL-DLE</h1>
          <p className="text-xl text-slate-500 font-medium">Can you spell the unspellable?</p>
          <button
            type="button"
            onClick={startGame}
            className="px-10 py-4 bg-slate-900 text-white font-bold rounded-full text-xl hover:scale-105 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-700"
          >
            Start Game
          </button>
        </div>
      </main>
    );
  }

  if (status === 'completed') {
    return <CompletionView history={history} onReset={resetGame} />;
  }

  return (
    <main className="h-screen w-full flex flex-col bg-slate-50 text-slate-900 font-sans overflow-hidden">
      <header className="flex-none p-6 flex justify-between items-center z-10">
        <h1 id="game-title" className="font-black text-xl tracking-wider text-slate-900">
          SPELL-DLE
        </h1>

        <div role="radiogroup" aria-label="Difficulty" className="flex gap-1 bg-slate-200/50 p-1 rounded-full">
          {DIFFICULTY_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              role="radio"
              aria-checked={difficulty === level}
              aria-disabled={mode !== 'infinite'}
              onClick={() => setDifficultyForInfinite(level)}
              disabled={mode !== 'infinite'}
              className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-700 ${
                difficulty === level ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'
              } ${mode === 'infinite' ? 'cursor-pointer' : 'cursor-default'}`}
            >
              {level}
            </button>
          ))}
        </div>
      </header>

      <section
        className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-6 relative"
        aria-labelledby="game-title"
      >
        <p className="sr-only" aria-live="polite">
          {liveAnnouncement}
        </p>

        {status === 'loading' ? (
          <div role="status" aria-live="polite">
            <Loader2 className="animate-spin text-slate-300" size={48} />
            <span className="sr-only">Loading word</span>
          </div>
        ) : status === 'error' ? (
          <div className="text-red-500 text-xl font-medium" role="alert">
            {errorMsg}
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-8 animate-in fade-in duration-500">
            <button
              type="button"
              onClick={playAudio}
              className="group relative flex items-center justify-center w-24 h-24 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all duration-300 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-600"
              aria-label="Play pronunciation"
            >
              <Volume2 size={40} />
            </button>

            <div className="text-center max-w-xl min-h-[100px] flex flex-col items-center justify-center gap-3">
              <p className="text-2xl md:text-3xl font-serif text-slate-700 leading-normal">
                &ldquo;{wordData?.definition}&rdquo;
              </p>
            </div>

            <div className="w-full max-w-lg relative min-h-[140px] flex flex-col items-center gap-6">
              {status === 'playing' && (
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={revealLetter}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-slate-600 text-xs font-bold uppercase tracking-wider hover:bg-slate-50 hover:border-indigo-200 transition-all shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-600"
                    aria-label="Reveal one letter"
                  >
                    <Eye size={14} /> Reveal Letter
                  </button>
                </div>
              )}

              {status === 'playing' && (
                <>
                  <p id="masked-pattern" className="sr-only">
                    Current pattern: {maskedPattern}
                  </p>
                  <div className="flex justify-center flex-wrap" aria-hidden="true">
                    {targetWord.split('').map((char, i) => (
                      <span
                        key={i}
                        className={`w-8 h-10 border-b-2 flex items-center justify-center text-xl font-mono mx-0.5 transition-colors ${
                          revealedIndices.has(i)
                            ? 'border-indigo-500 text-indigo-600 font-bold'
                            : 'border-slate-300 text-slate-300'
                        }`}
                      >
                        {revealedIndices.has(i) ? char : '_'}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {status === 'won' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-500 bg-slate-50/90 backdrop-blur-sm z-20 rounded-xl">
                  <div className="flex items-center gap-3 text-3xl font-bold text-green-600 mb-6">
                    <CheckCircle2 size={32} /> <span className="capitalize">{targetWord}</span>
                  </div>
                  <button
                    type="button"
                    onClick={nextWord}
                    className="px-8 py-3 bg-slate-900 text-white font-bold rounded-full hover:bg-slate-800 flex items-center gap-2 transition-all shadow-lg hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-slate-700"
                  >
                    {difficulty === 'hard' && mode !== 'infinite' ? 'Finish Game' : 'Next Word'}{' '}
                    <ArrowRight size={18} />
                  </button>
                  <span className="text-xs text-slate-400 mt-4 font-mono">Press [Enter] to continue</span>
                </div>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    submitGuess();
                  }}
                  className="w-full"
                >
                  <label htmlFor="spelling-input" className="sr-only">
                    Type your spelling guess
                  </label>
                  <input
                    id="spelling-input"
                    ref={inputRef}
                    type="text"
                    value={userInput}
                    onChange={(e) => updateUserInput(e.target.value)}
                    placeholder="Type spelling..."
                    className={`w-full bg-transparent border-b-4 text-center text-4xl md:text-5xl py-4 font-mono text-slate-900 placeholder:text-slate-200 outline-none transition-all ${
                      shake ? 'border-red-400 text-red-500 animate-shake' : 'border-slate-200 focus:border-slate-900'
                    }`}
                    autoFocus
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck={false}
                    aria-describedby={hasFeedback ? 'spelling-feedback' : 'masked-pattern'}
                    aria-invalid={hasFeedback}
                  />
                  {hasFeedback && (
                    <div
                      id="spelling-feedback"
                      className="text-center mt-4 text-red-500 font-bold flex items-center justify-center gap-2 animate-in fade-in"
                      role="status"
                      aria-live="polite"
                    >
                      <XCircle size={16} /> {feedback}
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>
        )}
      </section>

      <footer className="flex-none p-6 flex justify-center pb-8 z-10">
        <div role="radiogroup" aria-label="Game mode" className="flex bg-white rounded-full p-1 shadow-lg border border-slate-100">
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'daily'}
            onClick={() => switchMode('daily')}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-600 ${
              mode === 'daily' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <Calendar size={16} /> Daily
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={mode === 'infinite'}
            onClick={() => switchMode('infinite')}
            className={`px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-indigo-600 ${
              mode === 'infinite' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            <InfinityIcon size={16} /> Infinite
          </button>
        </div>
      </footer>
    </main>
  );
}
