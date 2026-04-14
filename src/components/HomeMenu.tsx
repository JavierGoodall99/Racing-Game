import { motion } from 'framer-motion';
import { Play, Settings, Trophy, Info, Map } from 'lucide-react';

interface HomeMenuProps {
  onStart: () => void;
}

export default function HomeMenu({ onStart }: HomeMenuProps) {
  return (
    <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black overflow-hidden font-sans">
      {/* Background Elements */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-[#E91E63] blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[#00E5FF] blur-[150px] rounded-full animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {/* Noise Texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col items-center max-w-7xl w-full px-8">
        {/* Top Label */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mb-4"
        >
          <span className="text-[10px] font-black uppercase tracking-[1em] text-white/40">Apex Circuit Series</span>
        </motion.div>

        {/* Massive Title */}
        <div className="relative mb-16">
          <motion.h1 
            initial={{ scale: 0.8, opacity: 0, rotateX: 45 }}
            animate={{ scale: 1, opacity: 1, rotateX: 0 }}
            transition={{ type: "spring", damping: 12, stiffness: 100 }}
            className="text-[15vw] font-black italic tracking-tighter leading-[0.8] text-white uppercase italic-racing"
          >
            APEX
          </motion.h1>
          <motion.div 
            initial={{ x: -100, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ delay: 0.3, type: "spring" }}
            className="absolute -bottom-4 right-0 bg-[#E91E63] px-6 py-2 skew-x-[-15deg]"
          >
            <span className="text-2xl font-black italic text-white uppercase tracking-widest">Velocity</span>
          </motion.div>
        </div>

        {/* Menu Options */}
        <div className="flex flex-col gap-6 w-full max-w-md">
          <motion.button
            whileHover={{ scale: 1.05, skewX: -10 }}
            whileTap={{ scale: 0.95 }}
            onClick={onStart}
            className="group relative flex items-center justify-between bg-white px-8 py-6 rounded-sm overflow-hidden transition-all hover:bg-[#E91E63]"
          >
            <div className="flex items-center gap-4 z-10">
              <Play className="w-6 h-6 text-black group-hover:text-white" fill="currentColor" />
              <span className="text-2xl font-black italic uppercase text-black group-hover:text-white">Start Racing</span>
            </div>
            <div className="absolute right-[-20px] top-1/2 -translate-y-1/2 opacity-10 group-hover:opacity-20 transition-opacity">
               <Play className="w-32 h-32 text-black" fill="currentColor" />
            </div>
          </motion.button>

          <div className="grid grid-cols-2 gap-4">
            {[
              { icon: Settings, label: 'Settings' },
              { icon: Info, label: 'About' }
            ].map((item, i) => (
              <motion.button
                key={item.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + (i * 0.1) }}
                whileHover={{ y: -5, backgroundColor: 'rgba(255,255,255,0.1)' }}
                className="flex flex-col items-center justify-center gap-2 p-4 border border-white/10 rounded-sm backdrop-blur-sm transition-colors"
              >
                <item.icon className="w-5 h-5 text-white/60" />
                <span className="text-[9px] font-black uppercase tracking-widest text-white/40">{item.label}</span>
              </motion.button>
            ))}
          </div>
        </div>

        {/* Footer Info */}
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute bottom-12 left-12 right-12 flex justify-between items-end border-t border-white/10 pt-8"
        >
          <div className="flex flex-col">
            <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1">Current Version</span>
            <span className="text-xs font-mono text-white/40">v2.4.0-STABLE</span>
          </div>
          <div className="flex gap-8">
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1">Engine Status</span>
              <span className="text-xs font-mono text-[#00E5FF]">OPTIMIZED</span>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest mb-1">Server Latency</span>
              <span className="text-xs font-mono text-white/40">12MS</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Decorative Lines */}
      <div className="absolute top-0 left-1/4 w-px h-full bg-white/5" />
      <div className="absolute top-0 right-1/4 w-px h-full bg-white/5" />
      <div className="absolute top-1/2 left-0 w-full h-px bg-white/5" />
    </div>
  );
}
