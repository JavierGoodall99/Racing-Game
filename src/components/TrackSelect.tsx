import { motion } from 'framer-motion';
import { ChevronLeft, Map } from 'lucide-react';

interface TrackSelectProps {
  onBack: () => void;
  selectedTrack: string;
  onSelectTrack: (trackId: string) => void;
}

const TRACKS = [
  { id: 'circle', name: 'Apex Circuit', description: 'High-speed circular track. Perfect for top speed testing.', difficulty: 'Easy' },
  { id: 'oval', name: 'Neon Oval', description: 'Elongated oval with long straights and tight curves.', difficulty: 'Medium' },
];

export default function TrackSelect({ onBack, selectedTrack, onSelectTrack }: TrackSelectProps) {
  return (
    <div className="absolute inset-0 z-[100] flex bg-black overflow-hidden font-sans text-white">
      {/* Background Elements */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-[#00E5FF] blur-[200px] rounded-full" />
      </div>

      {/* Noise Texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>

      {/* Left Panel - Navigation */}
      <div className="relative z-10 w-1/3 min-w-[400px] border-r border-white/10 bg-black/40 backdrop-blur-xl p-12 flex flex-col justify-between">
        <div>
          <button 
            onClick={onBack}
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-16 group"
          >
            <ChevronLeft className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
            <span className="text-[10px] font-black uppercase tracking-widest">Back to Menu</span>
          </button>

          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/40 block mb-2">Location Selection</span>
            <h1 className="text-6xl font-black italic tracking-tighter uppercase italic-racing mb-12">
              TRACKS
            </h1>
          </motion.div>
        </div>
      </div>

      {/* Right Panel - Track Selection */}
      <div className="relative z-10 flex-1 p-12 flex flex-col justify-center items-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-3xl"
        >
          <div className="flex items-center gap-3 mb-8">
            <Map className="w-5 h-5 text-white/60" />
            <h2 className="text-xl font-black italic uppercase tracking-widest">Available Circuits</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {TRACKS.map((track, i) => {
              const isSelected = selectedTrack === track.id;
              return (
                <motion.button
                  key={track.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + (i * 0.1) }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSelectTrack(track.id)}
                  className={`relative flex flex-col items-start p-6 rounded-lg border transition-all overflow-hidden text-left ${
                    isSelected 
                      ? 'border-[#00E5FF] bg-white/10 shadow-[0_0_30px_rgba(0,229,255,0.1)]' 
                      : 'border-white/10 bg-black/40 hover:bg-white/5 hover:border-white/30'
                  }`}
                >
                  <div className="flex justify-between w-full mb-2">
                    <span className="text-2xl font-black italic uppercase tracking-wider">{track.name}</span>
                    <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${
                      track.difficulty === 'Easy' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'
                    }`}>
                      {track.difficulty}
                    </span>
                  </div>
                  
                  <p className="text-sm text-white/60 mb-6">{track.description}</p>

                  {/* Track Preview SVG */}
                  <div className="w-full h-32 bg-black/50 rounded-md border border-white/5 flex items-center justify-center">
                    {track.id === 'circle' ? (
                      <svg viewBox="-100 -100 200 200" className="w-24 h-24">
                        <circle cx="0" cy="0" r="80" fill="none" stroke={isSelected ? "#00E5FF" : "white"} strokeWidth="8" className={isSelected ? "opacity-100" : "opacity-40"} />
                      </svg>
                    ) : (
                      <svg viewBox="-150 -100 300 200" className="w-32 h-24">
                        <ellipse cx="0" cy="0" rx="120" ry="60" fill="none" stroke={isSelected ? "#00E5FF" : "white"} strokeWidth="8" className={isSelected ? "opacity-100" : "opacity-40"} />
                      </svg>
                    )}
                  </div>

                  {isSelected && (
                    <motion.div 
                      layoutId="activeTrack"
                      className="absolute inset-0 border-2 border-[#00E5FF] rounded-lg pointer-events-none"
                    />
                  )}
                </motion.button>
              );
            })}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
