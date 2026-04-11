import { useEffect, useRef, useState } from 'react';
import { GameEngine, GameState } from './game/GameEngine';
import { Zap } from 'lucide-react';
import { motion } from 'framer-motion';

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<GameEngine | null>(null);
  
  const [gameState, setGameState] = useState<GameState>({
    speed: 0,
    nitro: 100,
    distance: 0,
    gameOver: false,
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
            <div className="flex flex-col items-center">
              <motion.div 
                className="flex items-baseline gap-1"
                animate={{ 
                  scale: gameState.speed > 280 ? [1, 1.05, 1] : 1 
                }}
                transition={{ repeat: Infinity, duration: 0.1 }}
              >
                <span className="text-7xl font-black font-mono tracking-tighter italic italic-racing">
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

          {/* Top Badge */}
          <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-30">
            <motion.div 
              animate={{ 
                backgroundColor: gameState.speed > 280 ? '#FF5722' : '#000000',
                scale: gameState.speed > 280 ? 1.1 : 1
              }}
              className="px-4 py-1.5 text-white text-[9px] font-black uppercase tracking-[0.5em] rounded-sm skew-x-[-15deg] border border-white/20 shadow-2xl"
            >
              {gameState.speed > 280 ? 'OVERDRIVE' : gameState.speed > 180 ? 'VELOCITY' : 'CRUISE'}
            </motion.div>
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
    </div>
  );
}
