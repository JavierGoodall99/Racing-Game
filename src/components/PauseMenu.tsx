import { motion } from 'framer-motion';
import { Play, RotateCcw, LogOut } from 'lucide-react';

interface PauseMenuProps {
  onResume: () => void;
  onRestart: () => void;
  onExit: () => void;
}

export default function PauseMenu({ onResume, onRestart, onExit }: PauseMenuProps) {
  return (
    <div className="absolute inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md font-sans">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        className="flex flex-col items-center"
      >
        <h2 className="text-6xl font-black italic tracking-tighter text-white uppercase italic-racing mb-12">
          PAUSED
        </h2>

        <div className="flex flex-col gap-4 w-64">
          <motion.button
            whileHover={{ scale: 1.05, x: 10 }}
            whileTap={{ scale: 0.95 }}
            onClick={onResume}
            className="flex items-center gap-4 bg-white px-6 py-4 rounded-sm text-black hover:bg-[#E91E63] hover:text-white transition-colors"
          >
            <Play className="w-5 h-5" fill="currentColor" />
            <span className="text-xl font-black italic uppercase">Resume</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05, x: 10 }}
            whileTap={{ scale: 0.95 }}
            onClick={onRestart}
            className="flex items-center gap-4 bg-black/40 border border-white/20 px-6 py-4 rounded-sm text-white hover:bg-white/10 transition-colors"
          >
            <RotateCcw className="w-5 h-5" />
            <span className="text-xl font-black italic uppercase">Restart</span>
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05, x: 10 }}
            whileTap={{ scale: 0.95 }}
            onClick={onExit}
            className="flex items-center gap-4 bg-black/40 border border-white/20 px-6 py-4 rounded-sm text-white hover:bg-red-500/20 hover:border-red-500/50 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            <span className="text-xl font-black italic uppercase">Exit to Menu</span>
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}
