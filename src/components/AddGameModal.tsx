import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Image as ImageIcon, Users, Clock, CheckCircle2, Loader2, Search as SearchIcon } from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs, limit } from 'firebase/firestore';
import { useUser } from '../contexts/UserContext';
import { notifyNewGameSubmission } from '../services/discordService';
import { Game } from './GameCard';
import { cn } from '../lib/utils';

interface AddGameModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTitle?: string;
  onSuccess: () => void;
}

const AddGameModal: React.FC<AddGameModalProps> = ({ isOpen, onClose, initialTitle = '', onSuccess }) => {
  const { user, profile } = useUser();
  const [formData, setFormData] = useState({
    title: initialTitle,
    minPlayers: 2,
    maxPlayers: 4,
    playTime: 60,
    coverImage: '',
    isExpansion: false,
    baseGameId: ''
  });
  const [baseGameSearch, setBaseGameSearch] = useState('');
  const [baseGameOptions, setBaseGameOptions] = useState<Game[]>([]);
  const [isSearchingBase, setIsSearchingBase] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (formData.isExpansion && !formData.baseGameId) {
      alert('Please select a base game for this expansion!');
      return;
    }

    setIsSubmitting(true);

    try {
      const path = 'games';
      const gameData = {
        ...formData,
        name_lowercase: formData.title.toLowerCase(),
        playTime: formData.playTime.toString(),
        createdAt: serverTimestamp(),
        submittedBy: user.uid,
        submittedByName: profile?.displayName || user.displayName || 'Gamer',
        trending: false,
        isVerified: false,
        isApproved: false, // Strict pending state
        isExpansion: formData.isExpansion,
        baseGameId: formData.isExpansion ? formData.baseGameId : null,
        status: 'pending',
        hasHighResArt: formData.coverImage ? true : false
      };
      
      const docRef = await addDoc(collection(db, path), gameData);

      // Discord Notification via dedicated service
      await notifyNewGameSubmission({
        id: docRef.id,
        title: formData.title,
        minPlayers: formData.minPlayers,
        maxPlayers: formData.maxPlayers,
        playTime: formData.playTime,
        coverImage: formData.coverImage,
        submittedBy: profile?.displayName || user.displayName || 'Gamer',
        userId: user.uid
      });

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onSuccess();
        onClose();
        setFormData({
          title: '',
          minPlayers: 2,
          maxPlayers: 4,
          playTime: 60,
          coverImage: ''
        });
      }, 2000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'games');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-charcoal rounded-[3rem] shadow-2xl overflow-hidden border border-white/10"
          >
            {isSuccess ? (
              <div className="p-12 text-center relative">
                <button 
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose();
                  }}
                  className="absolute top-6 right-6 z-50 cursor-pointer text-white/20 hover:text-white transition-colors p-3 bg-white/10 hover:bg-white/20 rounded-xl border border-white/10 shadow-lg"
                  aria-label="Close modal"
                >
                  <X className="w-6 h-6" />
                </button>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="w-24 h-24 bg-emerald-accent/10 rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-emerald-accent/20"
                >
                  <CheckCircle2 className="w-12 h-12 text-emerald-accent" />
                </motion.div>
                <h2 className="text-3xl font-black text-white mb-2">Awesome!</h2>
                <p className="text-white/40 font-bold">Thanks for expanding the library! 🎲✨</p>
              </div>
            ) : (
              <>
                <div className="bg-white/5 p-8 text-white relative overflow-hidden border-b border-white/10">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-accent/5 rounded-full -mr-16 -mt-16" />
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    className="absolute top-6 right-6 z-50 cursor-pointer text-white/20 hover:text-white transition-colors p-3 bg-white/10 hover:bg-white/20 rounded-xl border border-white/10 shadow-lg"
                    aria-label="Close modal"
                  >
                    <X className="w-6 h-6" />
                  </button>
                  <div className="relative flex items-center gap-4">
                    <div className="w-12 h-12 bg-emerald-accent/10 rounded-2xl flex items-center justify-center backdrop-blur-md border border-emerald-accent/20">
                      <Plus className="w-6 h-6 text-emerald-accent" />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black tracking-tight">Add a New Game</h2>
                      <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Help the community grow</p>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black text-white/20 uppercase tracking-widest ml-2">Game Title</label>
                    <input
                      required
                      type="text"
                      placeholder="e.g. Wingspan, Gloomhaven..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 px-6 focus:border-emerald-accent outline-none transition-all font-bold text-white placeholder:text-white/10"
                      value={formData.title}
                      onChange={e => setFormData({ ...formData, title: e.target.value })}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-white/20 uppercase tracking-widest ml-2">Min Players</label>
                      <div className="relative">
                        <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                        <input
                          required
                          type="number"
                          min="1"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 focus:border-emerald-accent outline-none transition-all font-bold text-white"
                          value={formData.minPlayers}
                          onChange={e => setFormData({ ...formData, minPlayers: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-white/20 uppercase tracking-widest ml-2">Max Players</label>
                      <div className="relative">
                        <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                        <input
                          required
                          type="number"
                          min="1"
                          className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 focus:border-emerald-accent outline-none transition-all font-bold text-white"
                          value={formData.maxPlayers}
                          onChange={e => setFormData({ ...formData, maxPlayers: parseInt(e.target.value) })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-white/20 uppercase tracking-widest ml-2">Playtime (Minutes)</label>
                    <div className="relative">
                      <Clock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                      <input
                        required
                        type="number"
                        min="1"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 focus:border-emerald-accent outline-none transition-all font-bold text-white"
                        value={formData.playTime}
                        onChange={e => setFormData({ ...formData, playTime: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-black text-white/20 uppercase tracking-widest ml-2">Image URL</label>
                    <div className="relative">
                      <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                      <input
                        required
                        type="url"
                        placeholder="https://..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 focus:border-emerald-accent outline-none transition-all font-bold text-white placeholder:text-white/10"
                        value={formData.coverImage}
                        onChange={e => setFormData({ ...formData, coverImage: e.target.value })}
                      />
                    </div>
                  </div>

                  {/* Expansion Toggle */}
                  <div className="space-y-4 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between px-2">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                          formData.isExpansion ? "bg-emerald-accent/20 text-emerald-accent" : "bg-white/5 text-white/20"
                        )}>
                          <Plus className={cn("w-5 h-5", formData.isExpansion && "rotate-45")} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-white">This is an expansion</p>
                          <p className="text-[10px] font-bold text-white/20 uppercase tracking-widest leading-none mt-1">Requires a base game</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, isExpansion: !prev.isExpansion, baseGameId: '' }))}
                        className={cn(
                          "w-12 h-6 rounded-full transition-all relative overflow-hidden",
                          formData.isExpansion ? "bg-emerald-accent" : "bg-white/10"
                        )}
                      >
                        <motion.div
                          animate={{ x: formData.isExpansion ? 24 : 4 }}
                          className="absolute left-0 top-1 w-4 h-4 bg-white rounded-full shadow-lg"
                        />
                      </button>
                    </div>

                    <AnimatePresence>
                      {formData.isExpansion && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-4 overflow-hidden"
                        >
                          <div className="space-y-2">
                            <label className="text-xs font-black text-white/20 uppercase tracking-widest ml-2">Link to Base Game</label>
                            <div className="relative">
                              <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                              <input
                                type="text"
                                placeholder="Search our database for the base game..."
                                className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-12 pr-6 focus:border-emerald-accent outline-none transition-all font-bold text-white text-sm"
                                value={baseGameSearch}
                                onChange={async (e) => {
                                  const search = e.target.value;
                                  setBaseGameSearch(search);
                                  if (search.length >= 2) {
                                    setIsSearchingBase(true);
                                    try {
                                      const q = query(
                                        collection(db, 'games'),
                                        where('isApproved', '==', true),
                                        where('isExpansion', '==', false),
                                        where('name_lowercase', '>=', search.toLowerCase()),
                                        where('name_lowercase', '<=', search.toLowerCase() + '\uf8ff'),
                                        limit(5)
                                      );
                                      const snap = await getDocs(q);
                                      setBaseGameOptions(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game)));
                                    } catch (err) {
                                      console.error("Base game search error:", err);
                                    } finally {
                                      setIsSearchingBase(false);
                                    }
                                  } else {
                                    setBaseGameOptions([]);
                                  }
                                }}
                              />
                              {isSearchingBase && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                  <Loader2 className="w-4 h-4 text-emerald-accent animate-spin" />
                                </div>
                              )}
                            </div>

                            {baseGameOptions.length > 0 && (
                              <div className="bg-charcoal/50 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
                                {baseGameOptions.map(game => (
                                  <button
                                    key={game.id}
                                    type="button"
                                    onClick={() => {
                                      setFormData(prev => ({ ...prev, baseGameId: game.id }));
                                      setBaseGameSearch(game.title);
                                      setBaseGameOptions([]);
                                    }}
                                    className={cn(
                                      "w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors border-b last:border-0 border-white/5",
                                      formData.baseGameId === game.id && "bg-emerald-accent/10 border-l-2 border-l-emerald-accent"
                                    )}
                                  >
                                    <img src={game.coverImage || undefined} className="w-8 h-8 rounded shrink-0 object-cover" />
                                    <div className="min-w-0">
                                      <p className="text-xs font-black text-white truncate">{game.title}</p>
                                      <p className="text-[9px] font-bold text-white/20 uppercase tracking-widest">{game.publisher}</p>
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button
                    disabled={isSubmitting}
                    type="submit"
                    className="w-full bg-gold-accent text-charcoal py-5 rounded-2xl font-black text-lg shadow-lg hover:shadow-gold-accent/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        Adding Game...
                      </>
                    ) : (
                      <>
                        <Plus className="w-6 h-6" />
                        Add to Database
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

export default AddGameModal;
