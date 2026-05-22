import React from 'react';
import { Sparkles, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-white/5 bg-charcoal/50 backdrop-blur-md pb-24 md:pb-8 pt-8">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-white/40">
          <Sparkles className="w-4 h-4 text-emerald-accent/70" />
          <span className="text-sm font-black uppercase tracking-widest">CritShelf</span>
        </div>
        
        <div className="flex items-center gap-1.5 text-xs font-bold text-white/30 uppercase tracking-widest">
          Crafted with <Heart className="w-3 h-3 text-red-500/70" /> for tabletop
        </div>

        <div className="flex gap-6 text-xs font-bold uppercase tracking-widest text-white/30">
          <Link to="/settings/privacy" className="hover:text-white/60 transition-colors">Privacy</Link>
          <a href="#" className="hover:text-white/60 transition-colors">Terms</a>
        </div>
      </div>
    </footer>
  );
}
