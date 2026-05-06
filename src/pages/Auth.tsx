import React, { useEffect, useState } from 'react';
import { useUser } from '../contexts/UserContext';
import { useNavigate } from 'react-router-dom';
import { Dices, LogIn, Sparkles, Mail, Lock, User, Loader2, AlertTriangle, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Auth() {
  const { user, signInWithGoogle, signInWithEmail, signUpWithEmail, loading } = useUser();
  const navigate = useNavigate();

  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user && !loading) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setIsSubmitting(true);

    try {
      if (isSignUp) {
        if (!username) {
          throw new Error('Username is required for signup');
        }
        await signUpWithEmail(email, password, username);
      } else {
        await signInWithEmail(email, password);
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      
      if (error.code === 'auth/operation-not-allowed') {
        setAuthError("DEVELOPER ERROR: Email/Password Auth is not enabled. Go to your Firebase Console -> Authentication -> Sign-in Method and enable 'Email/Password'.");
      } else if (error.code === 'auth/wrong-password') {
        setAuthError("Incorrect password. Please try again.");
      } else if (error.code === 'auth/user-not-found') {
        setAuthError("No account found with this email.");
      } else if (error.code === 'auth/email-already-in-use') {
        setAuthError("This email is already in use. Try logging in instead.");
      } else if (error.code === 'auth/invalid-email') {
        setAuthError("Please enter a valid email address.");
      } else if (error.code === 'auth/weak-password') {
        setAuthError("Password should be at least 6 characters.");
      } else {
        setAuthError(error.message || "An unexpected error occurred. Please try again.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-charcoal flex items-center justify-center p-6 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-accent/5 via-transparent to-transparent">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <motion.div 
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-16 h-16 bg-gold-accent/10 rounded-2xl flex items-center justify-center mx-auto border border-gold-accent/20 shadow-2xl shadow-gold-accent/10 mb-6"
          >
            <Dices className="w-8 h-8 text-gold-accent" />
          </motion.div>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <h1 className="text-3xl font-black text-white mb-2 tracking-tight">CritShelf</h1>
            <p className="text-white/40 text-sm font-medium leading-relaxed">
              {isSignUp ? 'Create your tabletop legacy.' : 'Welcome back to the vault.'}
            </p>
          </motion.div>
        </div>

        <motion.div 
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl space-y-6"
        >
          {authError && (
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl flex gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
              <p className="text-rose-500 text-xs font-bold leading-relaxed">{authError}</p>
            </motion.div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4">
            {isSignUp && (
              <div className="relative group">
                <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                  <User className="w-4 h-4 text-white/20 group-focus-within:text-emerald-accent transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Username"
                  required={isSignUp}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-5 text-white font-bold text-sm focus:outline-none focus:border-emerald-accent focus:ring-4 focus:ring-emerald-accent/10 transition-all placeholder:text-white/10"
                />
              </div>
            )}

            <div className="relative group">
              <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                <Mail className="w-4 h-4 text-white/20 group-focus-within:text-emerald-accent transition-colors" />
              </div>
              <input
                type="email"
                placeholder="Email Address"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-5 text-white font-bold text-sm focus:outline-none focus:border-emerald-accent focus:ring-4 focus:ring-emerald-accent/10 transition-all placeholder:text-white/10"
              />
            </div>

            <div className="relative group">
              <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
                <Lock className="w-4 h-4 text-white/20 group-focus-within:text-emerald-accent transition-colors" />
              </div>
              <input
                type="password"
                placeholder="Password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-5 text-white font-bold text-sm focus:outline-none focus:border-emerald-accent focus:ring-4 focus:ring-emerald-accent/10 transition-all placeholder:text-white/10"
              />
            </div>

            <button 
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-emerald-accent text-charcoal py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl shadow-emerald-accent/20 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 disabled:scale-100"
            >
              {isSubmitting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  {isSignUp ? 'Create Account' : 'Sign In'}
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-white/5"></div>
            </div>
            <div className="relative flex justify-center text-xs font-black uppercase tracking-widest leading-none">
              <span className="bg-charcoal px-4 text-white/20">OR</span>
            </div>
          </div>

          <button 
            type="button"
            onClick={signInWithGoogle}
            className="w-full bg-white/5 border border-white/10 text-white py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-3 hover:bg-white hover:text-charcoal transition-all active:scale-95 group"
          >
            <img 
               src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" 
               alt="Google" 
               className="w-5 h-5"
            />
            Continue with Google
          </button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => {
                setIsSignUp(!isSignUp);
                setAuthError(null);
              }}
              className="text-white/40 hover:text-emerald-accent text-xs font-bold transition-colors"
            >
              {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          </div>
        </motion.div>

        <div className="mt-8 text-center space-y-4">
          <p className="text-[10px] text-white/20 font-black uppercase tracking-[0.2em]">
            Secured by Firebase Authentication
          </p>
        </div>
      </div>
    </div>
  );
}
