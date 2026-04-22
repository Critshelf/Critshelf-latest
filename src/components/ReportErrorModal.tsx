import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertTriangle, Send, Loader2, CheckCircle2, Flag } from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { useUser } from '../contexts/UserContext';

interface ReportErrorModalProps {
  isOpen: boolean;
  onClose: () => void;
  gameId: string;
  gameTitle: string;
}

const CATEGORIES = ["Missing Data", "Incorrect Data", "Broken Art", "Other"];

const ReportErrorModal: React.FC<ReportErrorModalProps> = ({ isOpen, onClose, gameId, gameTitle }) => {
  const { user } = useUser();
  const [category, setCategory] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || description.length < 10) return;

    setIsSubmitting(true);
    try {
      const reportData = {
        gameId,
        gameTitle,
        category,
        description,
        reportedBy: user?.uid || 'anonymous',
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'errorReports'), reportData);

      // Trigger Discord Webhook via Server API
      fetch('/api/webhooks/discord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...reportData,
          createdAt: undefined // Let server handle timestamp for simplicity or pass raw
        })
      }).catch(err => console.error("Webhook notification failed:", err));

      setIsSuccess(true);
      setTimeout(() => {
        onClose();
        // Reset state after closing
        setTimeout(() => {
          setIsSuccess(false);
          setCategory('');
          setDescription('');
        }, 300);
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'errorReports');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isValid = category !== '' && description.length >= 10;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-charcoal/60 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-charcoal border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden"
          >
            {isSuccess ? (
              <div className="p-12 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-20 h-20 bg-emerald-accent/20 rounded-full flex items-center justify-center mx-auto mb-6"
                >
                  <CheckCircle2 className="w-10 h-10 text-emerald-accent" />
                </motion.div>
                <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Report Received!</h2>
                <p className="text-white/40 font-medium">Thanks for the heads up! Our team will look into it.</p>
              </div>
            ) : (
              <>
                <div className="p-8 border-b border-white/5 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-rose-500/10 rounded-lg">
                      <Flag className="w-5 h-5 text-rose-500" />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white tracking-tight">Report an Error</h2>
                      <p className="text-xs font-bold text-white/30 uppercase tracking-widest">{gameTitle}</p>
                    </div>
                  </div>
                  <button onClick={onClose} className="p-2 text-white/20 hover:text-white transition-colors">
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-4 ml-1">
                      Category
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCategory(cat)}
                          className={cn(
                            "py-3 px-4 rounded-xl text-xs font-bold transition-all border",
                            category === cat 
                              ? "bg-gold-accent/10 border-gold-accent text-gold-accent" 
                              : "bg-white/5 border-white/5 text-white/40 hover:bg-white/10"
                          )}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-[0.2em] text-white/30 mb-4 ml-1">
                      Problem Details
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Please describe the issue in detail..."
                      className="w-full h-32 bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-medium placeholder:text-white/20 focus:outline-none focus:border-gold-accent/30 transition-all resize-none"
                    />
                    <div className="mt-2 flex justify-end">
                      <span className={cn(
                        "text-[10px] font-bold uppercase tracking-tighter",
                        description.length >= 10 ? "text-emerald-accent/50" : "text-white/20"
                      )}>
                        {description.length}/10 chars min
                      </span>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={!isValid || isSubmitting}
                    className="w-full bg-gold-accent hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed text-charcoal font-black py-4 rounded-2xl shadow-xl transition-all flex items-center justify-center gap-3 group"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5 group-hover:translate-x-1 group-hover:-translate-y-1 transition-transform" />
                        Submit Report
                      </>
                    )}
                  </button>
                </form>
              </>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

export default ReportErrorModal;
