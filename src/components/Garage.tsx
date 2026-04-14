import { motion } from 'framer-motion';
import { ChevronLeft, PaintBucket, Zap, Shield, Activity } from 'lucide-react';

interface GarageProps {
  onBack: () => void;
  selectedColor: string;
  onSelectColor: (color: string) => void;
  onNext?: () => void;
}

const COLORS = [
  { id: 'orange', hex: '#FF5722', name: 'Apex Orange' },
  { id: 'pink', hex: '#E91E63', name: 'Neon Pink' },
  { id: 'cyan', hex: '#00E5FF', name: 'Cyber Cyan' },
  { id: 'green', hex: '#00FF00', name: 'Toxic Green' },
  { id: 'purple', hex: '#9C27B0', name: 'Midnight Purple' },
  { id: 'white', hex: '#FFFFFF', name: 'Ghost White' },
  { id: 'black', hex: '#111111', name: 'Stealth Black' },
];

export default function Garage({ onBack, selectedColor, onSelectColor, onNext }: GarageProps) {
  return (
    <div className="absolute inset-0 z-[100] flex bg-black overflow-hidden font-sans text-white">
      {/* Background Elements */}
      <div className="absolute inset-0 opacity-20 pointer-events-none">
        <motion.div 
          animate={{ backgroundColor: selectedColor }}
          transition={{ duration: 0.5 }}
          className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] blur-[200px] rounded-full" 
        />
      </div>

      {/* Noise Texture */}
      <div className="absolute inset-0 pointer-events-none opacity-[0.05] mix-blend-overlay" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}></div>

      {/* Left Panel - Navigation & Stats */}
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
            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-white/40 block mb-2">Vehicle Customization</span>
            <h1 className="text-6xl font-black italic tracking-tighter uppercase italic-racing mb-12">
              GARAGE
            </h1>
          </motion.div>

          {/* Fake Stats for Gamification */}
          <div className="flex flex-col gap-6">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/40 border-b border-white/10 pb-2">Vehicle Specs</span>
            
            {[
              { icon: Zap, label: 'Top Speed', value: 85 },
              { icon: Activity, label: 'Acceleration', value: 92 },
              { icon: Shield, label: 'Handling', value: 78 },
            ].map((stat, i) => (
              <motion.div 
                key={stat.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + (i * 0.1) }}
                className="flex flex-col gap-2"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-white/80">
                    <stat.icon className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">{stat.label}</span>
                  </div>
                  <span className="text-xs font-mono font-bold">{stat.value}</span>
                </div>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${stat.value}%` }}
                    transition={{ delay: 0.5 + (i * 0.1), duration: 1, type: "spring" }}
                    className="h-full bg-white"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="pt-8 border-t border-white/10">
          <span className="text-[10px] font-bold text-white/20 uppercase tracking-widest block mb-1">Active Chassis</span>
          <span className="text-sm font-mono text-white/80 mb-8 block">V8-APEX INTERCEPTOR</span>

          {onNext && (
            <motion.button
              whileHover={{ scale: 1.05, x: 10 }}
              whileTap={{ scale: 0.95 }}
              onClick={onNext}
              className="w-full bg-white text-black py-4 px-6 rounded-sm flex items-center justify-between group shadow-[0_0_30px_rgba(255,255,255,0.2)]"
            >
              <span className="text-sm font-black italic uppercase tracking-wider">Select Track</span>
              <ChevronLeft className="w-5 h-5 rotate-180 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          )}
        </div>
      </div>

      {/* Right Panel - Color Selection */}
      <div className="relative z-10 flex-1 p-12 flex flex-col justify-center items-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
          className="w-full max-w-2xl"
        >
          <div className="flex items-center gap-3 mb-8">
            <PaintBucket className="w-5 h-5 text-white/60" />
            <h2 className="text-xl font-black italic uppercase tracking-widest">Paint Shop</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {COLORS.map((color, i) => {
              const isSelected = selectedColor === color.hex;
              return (
                <motion.button
                  key={color.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + (i * 0.05) }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onSelectColor(color.hex)}
                  className={`relative flex flex-col items-start p-4 rounded-lg border transition-all overflow-hidden ${
                    isSelected 
                      ? 'border-white bg-white/10 shadow-[0_0_30px_rgba(255,255,255,0.1)]' 
                      : 'border-white/10 bg-black/40 hover:bg-white/5 hover:border-white/30'
                  }`}
                >
                  {/* Color Preview */}
                  <div 
                    className="w-full h-24 rounded-md mb-4 shadow-inner"
                    style={{ backgroundColor: color.hex }}
                  />
                  
                  <span className="text-[10px] font-bold uppercase tracking-widest text-white/60 mb-1">Color</span>
                  <span className="text-sm font-black italic uppercase tracking-wider">{color.name}</span>

                  {isSelected && (
                    <motion.div 
                      layoutId="activeColor"
                      className="absolute inset-0 border-2 border-white rounded-lg pointer-events-none"
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
