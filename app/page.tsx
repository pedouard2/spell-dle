'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Volume2, Calendar, Infinity as InfinityIcon, Loader2, ArrowRight, 
  CheckCircle2, XCircle, RotateCcw, Trophy, Eye 
} from 'lucide-react';
import { getTargetWord, Difficulty, GameMode } from '@/app/utils/game-logic'; 

// --- Levenshtein Distance Algorithm ---
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
          Math.min(matrix[i][j - 1] + 1, matrix[i - 1][j] + 1)
        );
      }
    }
  }
  return matrix[b.length][a.length];
};

interface DictionaryData {
  audioUrl: string | null;
  definition: string;
  phonetic: string;
}

interface WordResult {
  word: string;
  difficulty: Difficulty;
  misspellings: string[];
}

export default function SpellDle() {
  // --- Game Config ---
  const [hasStarted, setHasStarted] = useState(false);
  const [mode, setMode] = useState<GameMode>('daily');
  
  // --- Round State ---
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [targetWord, setTargetWord] = useState('');
  const [wordData, setWordData] = useState<DictionaryData | null>(null);
  
  // --- User State ---
  const [userInput, setUserInput] = useState('');
  const [status, setStatus] = useState<'loading' | 'playing' | 'won' | 'completed'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [feedback, setFeedback] = useState('');
  const [shake, setShake] = useState(false);
  
  // --- Hint State ---
  const [revealedIndices, setRevealedIndices] = useState<Set<number>>(new Set());
  
  // --- Score Tracking ---
  const [currentMisspellings, setCurrentMisspellings] = useState<string[]>([]);
  const [history, setHistory] = useState<WordResult[]>([]);
  
  // --- Refs ---
  const inputRef = useRef<HTMLInputElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // --- Reset & Loops ---
  useEffect(() => { resetGame(); }, [mode]);

  useEffect(() => {
    // Reset hints on new word
    setRevealedIndices(new Set());
  }, [targetWord]);

  useEffect(() => {
    if (hasStarted && status !== 'completed') {
      const controller = new AbortController();
      stopAudio();
      loadWord(controller.signal);
      return () => { controller.abort(); stopAudio(); };
    }
  }, [difficulty, hasStarted]);

  useEffect(() => {
    if (status === 'playing' && wordData && hasStarted) {
      playAudio();
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [status, wordData, hasStarted]);

  // --- Logic: Navigation (Wrapped in useCallback) ---
  const handleNext = useCallback(() => {
    stopAudio();
    if (difficulty === 'easy') {
        setDifficulty('medium');
    } else if (difficulty === 'medium') {
        setDifficulty('hard');
    } else {
        // HARD Logic
        if (mode === 'infinite') {
            setDifficulty('easy'); // Loop back
        } else {
            setStatus('completed'); // End Daily
        }
    }
  }, [difficulty, mode]);

  // --- Logic: Keyboard "Enter" to Advance ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only advance if won and Enter is pressed
      if (status === 'won' && e.key === 'Enter') {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status, handleNext]);


  // --- Logic: Word Loading ---
  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    window.speechSynthesis.cancel();
  };

  const resetGame = () => {
    setDifficulty('easy');
    setHistory([]);
    setStatus('loading');
    setCurrentMisspellings([]);
    if (hasStarted) {
       const controller = new AbortController();
       loadWord(controller.signal);
    }
  };

  const loadWord = async (signal: AbortSignal, retryCount = 0) => {
    setStatus('loading');
    setErrorMsg('');
    setFeedback('');
    setUserInput('');
    setCurrentMisspellings([]);
    setWordData(null);

    try {
      const word = await getTargetWord(difficulty, mode);
      if (!word) { setErrorMsg("No words generated."); return; }

      setTargetWord(word);

      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`, { signal });

      // Retry on 404
      if (res.status === 404) {
        if (retryCount < 3) {
            console.log(`Word "${word}" rejected (404). Retrying... ${retryCount + 1}/3`);
            return loadWord(signal, retryCount + 1);
        } else {
            throw new Error("Could not find a valid dictionary word after 3 attempts.");
        }
      }

      if (!res.ok) throw new Error('Failed to fetch definition');

      const data = await res.json();
      const entry = data[0];
      const audioEntry = entry.phonetics.find((p: any) => p.audio !== '')?.audio;
      
      setWordData({
        audioUrl: audioEntry || null,
        definition: entry.meanings[0]?.definitions[0]?.definition || "Definition unavailable",
        phonetic: entry.phonetic || ""
      });
      setStatus('playing');

    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error(err);
      
      setWordData({ 
        audioUrl: null, 
        definition: "Definition unavailable (Offline Mode)", 
        phonetic: "" 
      });
      setStatus('playing');
    }
  };

  const playAudio = () => {
    stopAudio();
    if (wordData?.audioUrl) {
      const audio = new Audio(wordData.audioUrl);
      audioRef.current = audio;
      audio.play().catch(e => console.log("Audio blocked:", e));
    } else {
      const msg = new SpeechSynthesisUtterance(targetWord);
      msg.lang = 'en-US';
      window.speechSynthesis.speak(msg);
    }
  };

  // --- Logic: Hints ---
  const revealLetter = () => {
    if (status !== 'playing') return;
    const hiddenIndices = targetWord.split('').map((_, i) => i).filter(i => !revealedIndices.has(i));
    if (hiddenIndices.length > 0) {
      const randomIndex = hiddenIndices[Math.floor(Math.random() * hiddenIndices.length)];
      setRevealedIndices(prev => new Set(prev).add(randomIndex));
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (status !== 'playing') return;

    const guess = userInput.trim().toLowerCase();
    const target = targetWord.toLowerCase();

    if (guess === target) {
      setHistory(prev => [...prev, { word: targetWord, difficulty, misspellings: currentMisspellings }]);
      setStatus('won');
      setFeedback('');
    } else {
      if (!currentMisspellings.includes(guess)) {
        setCurrentMisspellings(prev => [...prev, guess]);
      }
      setFeedback('Incorrect spelling');
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  // Helper render for " _ _ a _ _ "
  const renderMaskedWord = () => {
    return targetWord.split('').map((char, i) => (
      <span key={i} className={`w-8 h-10 border-b-2 flex items-center justify-center text-xl font-mono mx-0.5 transition-colors ${revealedIndices.has(i) ? 'border-indigo-500 text-indigo-600 font-bold' : 'border-slate-300 text-slate-300'}`}>
        {revealedIndices.has(i) ? char : '_'}
      </span>
    ));
  };

  // --- Screens ---
  if (!hasStarted) {
    return (
      <main className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-slate-900">
        <div className="text-center space-y-8 animate-in fade-in zoom-in duration-500">
          <h1 className="text-6xl font-black tracking-tighter">SPELL-DLE</h1>
          <p className="text-xl text-slate-500 font-medium">Can you spell the unspellable?</p>
          <button onClick={() => { setHasStarted(true); resetGame(); }} className="px-10 py-4 bg-slate-900 text-white font-bold rounded-full text-xl hover:scale-105 transition-transform">
            Start Game
          </button>
        </div>
      </main>
    );
  }

  if (status === 'completed') {
    return (
      <main className="h-screen w-full flex flex-col items-center justify-center bg-slate-900 text-white p-4 overflow-y-auto">
        <div className="w-full max-w-lg bg-white text-slate-900 rounded-3xl p-8 shadow-2xl animate-in zoom-in duration-300 my-auto">
          <div className="text-center mb-8">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-3xl font-black mb-2">Well Done!</h2>
            <p className="text-slate-500">Here is how you did.</p>
          </div>
          <div className="space-y-6 mb-8 max-h-[50vh] overflow-y-auto pr-2">
             {history.map((item, idx) => (
               <div key={idx} className="bg-slate-50 rounded-xl border border-slate-100 overflow-hidden">
                 <div className="flex justify-between items-center p-4 bg-white border-b border-slate-100">
                   <div>
                     <div className="text-xs font-bold uppercase text-slate-400">{item.difficulty}</div>
                     <div className="font-bold text-xl capitalize">{item.word}</div>
                   </div>
                   <div className={`px-3 py-1 rounded-full text-sm font-bold ${item.misspellings.length === 0 ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                     {item.misspellings.length === 0 ? 'Perfect' : `${item.misspellings.length} attempts`}
                   </div>
                 </div>
                 {item.misspellings.length > 0 && (
                   <div className="p-3 bg-slate-50 text-sm space-y-2">
                     <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Misspellings:</div>
                     {item.misspellings.map((wrong, i) => {
                       const dist = getEditDistance(wrong, item.word);
                       return (
                         <div key={i} className="flex justify-between items-center bg-white px-3 py-2 rounded border border-slate-200 text-slate-600 font-mono">
                           <span className="line-through decoration-red-400 decoration-2">{wrong}</span>
                           <span className="text-xs bg-slate-100 px-2 py-1 rounded text-slate-500 font-sans font-bold">
                             Dist: {dist}
                           </span>
                         </div>
                       );
                     })}
                   </div>
                 )}
               </div>
             ))}
          </div>
          <button onClick={resetGame} className="w-full py-4 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 flex items-center justify-center gap-2">
            <RotateCcw size={20} /> Play Again
          </button>
        </div>
      </main>
    );
  }

  // --- Main Game Loop ---
  return (
    <main className="h-screen w-full flex flex-col bg-slate-50 text-slate-900 font-sans overflow-hidden">
      
      {/* Header */}
      <header className="flex-none p-6 flex justify-between items-center z-10">
        <h1 className="font-black text-xl tracking-wider text-slate-900">SPELL-DLE</h1>
        <div className="flex gap-1 bg-slate-200/50 p-1 rounded-full">
           {(['easy', 'medium', 'hard'] as Difficulty[]).map((level) => (
             <div key={level} className={`px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${difficulty === level ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400'}`}>
               {level}
             </div>
           ))}
        </div>
      </header>

      {/* Game Content */}
      <section className="flex-1 flex flex-col items-center justify-center w-full max-w-2xl mx-auto px-6 relative">
        {status === 'loading' ? (
          <Loader2 className="animate-spin text-slate-300" size={48} />
        ) : errorMsg ? (
          <div className="text-red-500 text-xl font-medium">{errorMsg}</div>
        ) : (
          <div className="w-full flex flex-col items-center gap-8 animate-in fade-in duration-500">
            
            {/* Audio Button */}
            <button onClick={playAudio} className="group relative flex items-center justify-center w-24 h-24 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white transition-all duration-300 shadow-sm">
              <Volume2 size={40} />
            </button>

            {/* Definition Container */}
            <div className="text-center max-w-xl min-h-[100px] flex flex-col items-center justify-center gap-3">
              <p className="text-2xl md:text-3xl font-serif text-slate-700 leading-normal">"{wordData?.definition}"</p>
            </div>

            {/* Game Input Area */}
            <div className="w-full max-w-lg relative min-h-[140px] flex flex-col items-center gap-6"> 
              
              {/* Hint Toolbar */}
              {status === 'playing' && (
                <div className="flex gap-3">
                    <button 
                        onClick={revealLetter}
                        className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full text-slate-600 text-xs font-bold uppercase tracking-wider hover:bg-slate-50 hover:border-indigo-200 transition-all shadow-sm"
                    >
                        <Eye size={14} /> Reveal Letter
                    </button>
                </div>
              )}

              {/* Masked Preview */}
              {status === 'playing' && (
                <div className="flex justify-center flex-wrap">
                    {renderMaskedWord()}
                </div>
              )}

              {status === 'won' ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center animate-in fade-in slide-in-from-bottom-4 duration-500 bg-slate-50/90 backdrop-blur-sm z-20 rounded-xl">
                  <div className="flex items-center gap-3 text-3xl font-bold text-green-600 mb-6">
                    <CheckCircle2 size={32} /> <span className="capitalize">{targetWord}</span>
                  </div>
                  <button onClick={handleNext} className="px-8 py-3 bg-slate-900 text-white font-bold rounded-full hover:bg-slate-800 flex items-center gap-2 transition-all shadow-lg hover:scale-105">
                     {difficulty === 'hard' && mode !== 'infinite' ? 'Finish Game' : 'Next Word'} <ArrowRight size={18} />
                  </button>
                  <span className="text-xs text-slate-400 mt-4 font-mono">Press [Enter] to continue</span>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="w-full">
                  <input
                    ref={inputRef}
                    type="text"
                    value={userInput}
                    onChange={(e) => { setUserInput(e.target.value); setFeedback(''); }}
                    placeholder="Type spelling..."
                    className={`w-full bg-transparent border-b-4 text-center text-4xl md:text-5xl py-4 font-mono text-slate-900 placeholder:text-slate-200 outline-none transition-all ${shake ? 'border-red-400 text-red-500 animate-shake' : 'border-slate-200 focus:border-slate-900'}`}
                    autoFocus
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                  />
                  {feedback && (
                    <div className="text-center mt-4 text-red-500 font-bold flex items-center justify-center gap-2 animate-in fade-in">
                       <XCircle size={16} /> {feedback}
                    </div>
                  )}
                </form>
              )}
            </div>
          </div>
        )}
      </section>

      {/* Footer */}
      <footer className="flex-none p-6 flex justify-center pb-8 z-10">
        <div className="flex bg-white rounded-full p-1 shadow-lg border border-slate-100">
           <button onClick={() => setMode('daily')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${mode === 'daily' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
             <Calendar size={16}/> Daily
           </button>
           <button onClick={() => setMode('infinite')} className={`px-6 py-2 rounded-full text-sm font-bold transition-all flex items-center gap-2 ${mode === 'infinite' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}>
             <InfinityIcon size={16}/> Infinite
           </button>
        </div>
      </footer>
    </main>
  );
}