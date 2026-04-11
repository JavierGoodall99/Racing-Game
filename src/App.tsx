import { useEffect, useRef, useState } from 'react';
import { GameEngine, GameState } from './game/GameEngine';
import { Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import HomeMenu from './components/HomeMenu';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const [isStarted, setIsStarted] = useState(false);
  
  const [gameState, setGameState] = useState<GameState>({
    speed: 0,
    nitro: 100,
    distance: 0,
    laps: 0,
    lastLapTime: 0,
    bestLapTime: 0,
    currentLapTime: 0,
    gameOver: false,
  });

  const formatTime = (seconds: number) => {
    if (seconds === 0) return "--:--.--";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
  };

  const initGame = () => {
    if (engineRef.current) {
      engineRef.current.cleanup();
    }
    if (canvasRef.current) {
      engineRef.current = new GameEngine(canvasRef.current, setGameState);
    }
  };

  const handleStart = () => {
    setIsStarted(true);
    initGame();
  };

  useEffect(() => {
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
    <div className="relative w-screen h-screen overflow-hidden bg-black font-sans selection:bg-[#E91E63] selection:text-white">
      <AnimatePresence>
        {!isStarted && (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1, filter: 'blur(20px)' }}
            transition={{ duration: 0.8, ease: [0.43, 0.13, 0.23, 0.96] }}
            className="absolute inset-0 z-[100]"
          >
            <HomeMenu onStart={handleStart} />
          </motion.div>
        )}
      </AnimatePresence>

      <canvas ref={canvasRef} className={`absolute inset-0 w-full h-full block transition-opacity duration-1000 ${isStarted ? 'opacity-100' : 'opacity-0'}`} />
      
      {isStarted && (
        <>
          {/* HUD Overlay - Lighter */}
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-transparent via-transparent to-white/10" />
          
          {/* Noise Texture */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.02] mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>

          {/* Global Lap Counter - Top Center */}
          <div className="absolute top-12 left-1/2 -translate-x-1/2 pointer-events-none z-50">
            <motion.div 
              key={gameState.laps}
              initial={{ y: -50, opacity: 0, scale: 0.8 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              className="flex flex-col items-center"
            >
              <div className="bg-black/90 backdrop-blur-xl border border-white/20 px-10 py-4 rounded-2xl skew-x-[-10deg] shadow-2xl flex flex-col items-center">
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-[#E91E63] mb-1">Current Lap</span>
                <div className="flex items-baseline gap-4">
                  <span className="text-5xl font-black text-white italic tracking-tighter">LAP {gameState.laps + 1}</span>
                  <span className="text-2xl font-mono font-bold text-white/60">{formatTime(gameState.currentLapTime)}</span>
                </div>
              </div>
              
              {/* Lap Time History */}
              <div className="mt-4 flex gap-4">
                <div className="bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-lg skew-x-[-10deg] flex flex-col items-center">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-white/40">Last Lap</span>
                  <span className="text-sm font-mono font-bold text-white">{formatTime(gameState.lastLapTime)}</span>
                </div>
                <div className="bg-[#E91E63]/20 backdrop-blur-md border border-[#E91E63]/30 px-4 py-2 rounded-lg skew-x-[-10deg] flex flex-col items-center">
                  <span className="text-[8px] font-bold uppercase tracking-widest text-[#E91E63]">Best Lap</span>
                  <span className="text-sm font-mono font-bold text-white">{formatTime(gameState.bestLapTime)}</span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Gamified Telemetry - Bottom Right */}
          <div className="absolute bottom-12 right-12 pointer-events-none">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative w-72 h-72 flex items-center justify-center"
            >
              {/* Main Gauge Container - Glassmorphism */}
              <div className="absolute inset-0 bg-black/40 backdrop-blur-md rounded-full border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] overflow-hidden">
                {/* Inner Glow based on speed */}
                <motion.div 
                  className="absolute inset-0 opacity-30"
                  animate={{ 
                    background: gameState.speed > 250 
                      ? 'radial-gradient(circle at center, #FF5722 0%, transparent 70%)' 
                      : 'radial-gradient(circle at center, #E91E63 0%, transparent 70%)'
                  }}
                />
              </div>

              {/* SVG Gauges */}
              <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90 relative z-10">
                {/* Tachometer Ticks */}
                <g className="opacity-20">
                  {Array.from({ length: 21 }).map((_, i) => {
                    const angle = (i * 12) - 30; // 240 degree span
                    const isMajor = i % 5 === 0;
                    return (
                      <line
                        key={i}
                        x1={100 + Math.cos((angle * Math.PI) / 180) * 85}
                        y1={100 + Math.sin((angle * Math.PI) / 180) * 85}
                        x2={100 + Math.cos((angle * Math.PI) / 180) * (isMajor ? 75 : 80)}
                        y2={100 + Math.sin((angle * Math.PI) / 180) * (isMajor ? 75 : 80)}
                        stroke="white"
                        strokeWidth={isMajor ? 2 : 1}
                      />
                    );
                  })}
                </g>

                {/* Speed Track (Background) */}
                <path
                  d="M 30 100 A 70 70 0 1 1 170 100"
                  fill="none"
                  stroke="white"
                  strokeWidth="12"
                  strokeLinecap="round"
                  className="opacity-5"
                  transform="rotate(30 100 100)"
                />

                {/* Speed Gauge (Active) */}
                <motion.path
                  d="M 30 100 A 70 70 0 1 1 170 100"
                  fill="none"
                  stroke={gameState.speed > 250 ? '#FF5722' : '#E91E63'}
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray="330"
                  animate={{ 
                    strokeDashoffset: 330 - (Math.min(gameState.speed, 350) / 350) * 330 
                  }}
                  className="drop-shadow-[0_0_8px_rgba(233,30,99,0.8)]"
                  transform="rotate(30 100 100)"
                  transition={{ type: "spring", damping: 15, stiffness: 80 }}
                />

                {/* Nitro Bar (Circular) */}
                <circle
                  cx="100" cy="100" r="55"
                  fill="none"
                  stroke="white"
                  strokeWidth="4"
                  strokeDasharray="260 345"
                  strokeLinecap="round"
                  className="opacity-5"
                  transform="rotate(45 100 100)"
                />
                <motion.circle
                  cx="100" cy="100" r="55"
                  fill="none"
                  stroke="#00E5FF"
                  strokeWidth="4"
                  strokeDasharray="345"
                  animate={{ 
                    strokeDashoffset: 345 - (gameState.nitro / 100) * 260 
                  }}
                  strokeLinecap="round"
                  className="drop-shadow-[0_0_5px_#00E5FF]"
                  transform="rotate(45 100 100)"
                  transition={{ type: "spring", damping: 20, stiffness: 100 }}
                />
              </svg>

              {/* Readout - Centered */}
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white z-20">
                <div className="flex flex-col items-center mt-4">
                  <motion.div 
                    className="flex items-baseline gap-1"
                    animate={{ 
                      scale: gameState.speed > 280 ? [1, 1.05, 1] : 1 
                    }}
                    transition={{ repeat: Infinity, duration: 0.1 }}
                  >
                    <span className="text-7xl font-black font-mono tracking-tighter italic italic-racing drop-shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                      {gameState.speed}
                    </span>
                  </motion.div>
                  <span className="text-[10px] font-black uppercase tracking-[0.4em] text-white/40 -mt-2">KM/H</span>
                </div>
                
                <div className="mt-6 flex flex-col items-center gap-1">
                  <div className="flex items-center gap-2">
                    <Zap className={`w-3 h-3 ${gameState.nitro > 20 ? 'text-[#00E5FF] animate-pulse' : 'text-red-500'}`} />
                    <span className="text-[9px] font-black font-mono text-white/60 uppercase tracking-widest">Boost {Math.round(gameState.nitro)}%</span>
                  </div>
                  {/* Small Nitro Bar */}
                  <div className="w-20 h-1 bg-white/10 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-[#00E5FF]"
                      animate={{ width: `${gameState.nitro}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Distance Counter - Bottom */}
              <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-white/30 font-mono text-[10px] tracking-[0.2em] uppercase">
                DST: {Math.floor(gameState.distance / 1000)}KM
              </div>
            </motion.div>
          </div>

          {/* Controls Hint - Bottom Left */}
          <div className="absolute bottom-8 left-8 pointer-events-none">
            <div className="flex flex-col gap-2">
              <div className="flex gap-2 text-[10px] font-mono tracking-widest uppercase text-black opacity-50">
                <span className="px-2 py-1 border border-black/20 rounded">W A S D</span>
                <span className="px-2 py-1 border border-black/20 rounded">Space</span>
                <span className="px-2 py-1 border border-black/20 rounded bg-black text-white">Shift (Nitro)</span>
                <span className="px-2 py-1 border border-[#E91E63]/40 rounded bg-[#E91E63] text-white">R (Reset)</span>
              </div>
              <span className="text-[10px] font-bold text-[#E91E63] animate-pulse uppercase tracking-widest">Stuck? Press R to Reset!</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
