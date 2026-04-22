import React, { useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import { Dices, LogIn, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export default function Auth() {
  const { user, signInWithGoogle, loading } = useUser();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && !loading) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-accent/5 via-transparent to-transparent">
      <div className="max-w-md w-full">
        <div className="text-center mb-12">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-20 h-20 bg-gold-accent/10 rounded-3xl flex items-center justify-center mx-auto border border-gold-accent/20 shadow-2xl shadow-gold-accent/10 mb-8"
          >
            <Dices className="w-10 h-10 text-gold-accent" />
          </motion.div>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <h1 className="text-4xl font-black text-white mb-4 tracking-tight">CritShelf</h1>
            <p className="text-white/40 text-lg font-medium leading-relaxed">
              Your tabletop legacy starts here. Join the community of critics and collectors.
            </p>
          </motion.div>
        </div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 border border-white/10 rounded-[3rem] p-8 shadow-2xl space-y-8"
        >
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-4 bg-white/[0.02] rounded-2xl border border-white/5">
              <div className="w-10 h-10 bg-emerald-accent/10 rounded-xl flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-emerald-accent" />
              </div>
              <div className="text-left">
                <p className="text-white text-sm font-black">Track Everything</p>
                <p className="text-white/30 text-xs">Plays, ratings, and rotations</p>
              </div>
            </div>
            <div className="flex items-center gap-4 p-4 bg-white/[0.02] rounded-2xl border border-white/5">
              <div className="w-10 h-10 bg-purple-500/10 rounded-xl flex items-center justify-center shrink-0">
                <LogIn className="w-5 h-5 text-purple-500" />
              </div>
              <div className="text-left">
                <p className="text-white text-sm font-black">Social Sync</p>
                <p className="text-white/30 text-xs">See what your crew is playing</p>
              </div>
            </div>
          </div>

          <button 
            onClick={signInWithGoogle}
            className="w-full bg-white text-charcoal py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 shadow-xl hover:bg-emerald-accent transition-all active:scale-95 group"
          >
            <img 
               src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
               alt="Google" 
               className="w-5 h-5"
            />
            Sign In with Google
          </button>
          
          <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.2em] text-center">
            One-tap authentication
          </p>
        </motion.div>
      </div>
    </div>
  );
}
