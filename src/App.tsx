import { useEffect, useRef, useState } from 'react';
import { GameEngine, GameState } from './game/GameEngine';
import { Trophy, Timer, RefreshCw, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  
  const [gameState, setGameState] = useState<GameState>({
    score: 0,
    timeLeft: 60,
    gameOver: false,
    gameWon: false,
    speed: 0,
    nitro: 100,
    multiplier: 1,
    distance: 0
  });

  const initGame = () => {
    if (engineRef.current) {
      engineRef.current.cleanup();
    }
    if (canvasRef.current) {
      engineRef.current = new GameEngine(canvasRef.current, setGameState);
    }
  };

  useEffect(() => {
    initGame();
    
    const handleResize = () => {
      if (engineRef.current) {
        engineRef.current.resize(window.innerWidth, window.innerHeight);
      }
    };
    
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (engineRef.current) {
        engineRef.current.cleanup();
      }
    };
  }, []);

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#87CEEB] font-sans selection:bg-[#E91E63] selection:text-white">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full block" />
      
      {/* HUD Overlay - Lighter */}
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-transparent to-white/10" />
      
      {/* Noise Texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.02] mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>

      <div className="absolute top-0 left-0 w-full p-8 flex justify-between items-start pointer-events-none">
        <div className="flex gap-6">
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl p-5 flex items-center gap-4 text-black shadow-xl"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#E91E63] to-[#C2185B] flex items-center justify-center shadow-[0_0_20px_rgba(233,30,99,0.3)]">
              <Trophy className="w-6 h-6 text-white" />
            </div>
            <div className="flex flex-col pr-4">
              <span className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-bold">Score</span>
              <span className="text-3xl font-black font-mono leading-none tracking-tighter">{gameState.score}</span>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl p-5 flex items-center gap-4 text-black shadow-xl"
          >
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${gameState.timeLeft <= 10 ? 'bg-gradient-to-br from-red-500 to-red-700 shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse' : 'bg-gradient-to-br from-black/5 to-black/10 border border-black/5'}`}>
              <Timer className={`w-6 h-6 ${gameState.timeLeft <= 10 ? 'text-white' : 'text-black/80'}`} />
            </div>
            <div className="flex flex-col pr-4">
              <span className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-bold">Time</span>
              <span className={`text-3xl font-black font-mono leading-none tracking-tighter ${gameState.timeLeft <= 10 ? 'text-red-600' : ''}`}>
                {gameState.timeLeft}s
              </span>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl p-5 flex items-center gap-4 text-black shadow-xl"
          >
            <div className="w-12 h-12 rounded-2xl bg-black/5 flex items-center justify-center">
              <span className="text-xl font-black text-[#E91E63]">x{gameState.multiplier.toFixed(1)}</span>
            </div>
            <div className="flex flex-col pr-4">
              <span className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-bold">Multiplier</span>
              <span className="text-3xl font-black font-mono leading-none tracking-tighter text-[#E91E63]">COMBO</span>
            </div>
          </motion.div>
        </div>

        <div className="flex flex-col gap-4 items-end">
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl p-6 text-black shadow-xl min-w-[240px]"
          >
            <div className="flex items-center justify-between mb-4 border-b border-black/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-black/5 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-[#E91E63]" />
                </div>
                <span className="font-bold tracking-widest uppercase text-xs text-black/80">Telemetry</span>
              </div>
              <span className="text-[10px] font-black text-[#E91E63]">{gameState.speed > 200 ? 'EXTREME' : 'STABLE'}</span>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-bold">Speed</span>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black font-mono tracking-tighter">{gameState.speed}</span>
                  <span className="text-sm font-bold text-black/40">KM/H</span>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-bold">Nitro</span>
                  <span className="text-[10px] font-black text-black/60">{Math.round(gameState.nitro)}%</span>
                </div>
                <div className="h-2 w-full bg-black/5 rounded-full overflow-hidden">
                  <motion.div 
                    className="h-full bg-gradient-to-r from-[#E91E63] to-[#FF5722]"
                    animate={{ width: `${gameState.nitro}%` }}
                  />
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white/80 backdrop-blur-xl border border-white/20 rounded-3xl p-4 text-black shadow-xl w-full"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] uppercase tracking-[0.2em] text-black/40 font-bold">Festival Hub</span>
              <span className="text-[10px] font-black text-black/60">{Math.round(gameState.distance)}%</span>
            </div>
            <div className="h-1.5 w-full bg-black/5 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-black"
                animate={{ width: `${gameState.distance}%` }}
              />
            </div>
          </motion.div>
        </div>
      </div>

      {/* Controls Hint - Bottom Left */}
      <div className="absolute bottom-8 left-8 pointer-events-none">
        <div className="flex flex-col gap-2">
          <div className="flex gap-2 text-[10px] font-mono tracking-widest uppercase text-black opacity-50">
            <span className="px-2 py-1 border border-black/20 rounded">W A S D</span>
            <span className="px-2 py-1 border border-black/20 rounded">Space</span>
            <span className="px-2 py-1 border border-black/20 rounded bg-black text-white">Shift (Nitro)</span>
          </div>
          <span className="text-[10px] font-bold text-[#E91E63] animate-pulse uppercase tracking-widest">Dodge traffic for near-miss bonus!</span>
        </div>
      </div>

      {/* Game Over / Win Screen */}
      <AnimatePresence>
        {(gameState.gameOver || gameState.gameWon) && (
          <motion.div 
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(20px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            className="absolute inset-0 bg-white/40 flex items-center justify-center z-50"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="relative w-full max-w-2xl p-12 flex flex-col items-center text-center bg-white/90 rounded-[4rem] shadow-2xl border border-white/50"
            >
              {/* Decorative background glow */}
              <div className={`absolute inset-0 blur-[100px] opacity-20 -z-10 ${gameState.gameWon ? 'bg-[#E91E63]' : 'bg-red-500'}`} />

              {gameState.gameWon ? (
                <>
                  <motion.div 
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", delay: 0.2 }}
                    className="w-32 h-32 rounded-full bg-gradient-to-br from-[#E91E63] to-[#C2185B] flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(233,30,99,0.4)]"
                  >
                    <Trophy className="w-16 h-16 text-white" />
                  </motion.div>
                  <h2 className="text-7xl font-black text-black mb-4 tracking-tighter uppercase">Festival Legend</h2>
                  <p className="text-xl text-black/60 mb-12 font-light tracking-wide">You've conquered the Horizon.</p>
                </>
              ) : (
                <>
                  <motion.div 
                    initial={{ scale: 0, rotate: -180 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", delay: 0.2 }}
                    className="w-32 h-32 rounded-full bg-gradient-to-br from-red-500 to-red-800 flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(239,68,68,0.4)]"
                  >
                    <Timer className="w-16 h-16 text-white" />
                  </motion.div>
                  <h2 className="text-7xl font-black text-black mb-4 tracking-tighter uppercase">Out of Time</h2>
                  <p className="text-xl text-black/60 mb-12 font-light tracking-wide">The festival moves on without you.</p>
                </>
              )}

              <div className="flex gap-16 mb-16 w-full justify-center">
                <div className="text-center">
                  <div className="text-xs text-black/40 uppercase tracking-[0.2em] font-bold mb-2">Final Score</div>
                  <div className="text-6xl font-black font-mono text-black tracking-tighter">{gameState.score}</div>
                </div>
              </div>

              <motion.button 
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={initGame}
                className="group relative px-12 py-5 bg-black text-white font-black uppercase tracking-widest text-sm rounded-full overflow-hidden transition-all hover:shadow-[0_0_40px_rgba(0,0,0,0.2)]"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
                <span className="relative flex items-center gap-3">
                  <RefreshCw className="w-5 h-5" />
                  Restart Festival
                </span>
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
