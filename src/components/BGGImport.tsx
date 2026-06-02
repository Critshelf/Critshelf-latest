import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, X, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import Papa from 'papaparse';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, doc, setDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { useUser } from '../contexts/UserContext';

interface BGGImportProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ImportProgress {
  total: number;
  current: number;
  status: string;
  successCount: number;
  errorCount: number;
}

export default function BGGImport({ isOpen, onClose }: BGGImportProps) {
  const { user } = useUser();
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState<ImportProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setIsImporting(true);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      dynamicTyping: true,
      complete: async (results) => {
        const rows = results.data as any[];
        const total = rows.length;
        setProgress({ total, current: 0, status: 'Starting batch import...', successCount: 0, errorCount: 0 });

        // Blind Upsert Logic: Zero Reads
        // We use deterministic IDs for games and user collection items
        // Game ID: bgg_{bggId}
        // User Collection ID: {userId}_bgg_{bggId}

        const BATCH_LIMIT = 400; // Safe limit below 500
        let batch = writeBatch(db);
        let opCount = 0;

        try {
          for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const bggIdRaw = row.objectid || row['Object ID'] || row['ObjectID'] || '';
            const bggId = String(bggIdRaw).trim();
            const objectname = row.objectname || row['Object Name'] || row['ObjectName'] || '';
            const bggRating = typeof row.rating === 'number' ? row.rating : 0;
            const isOwned = row.own === 1 || row['Own'] === 1;
            const isWishlist = row.wishlist === 1 || row['Wishlist'] === 1;

            if (!bggId || !objectname) {
              setProgress(prev => prev ? { ...prev, current: i + 1 } : null);
              continue;
            }

            const gameId = `bgg_${bggId}`;
            const shelf = isWishlist && !isOwned ? 'wishlist' : 'owned';
            const userCollId = `${user.uid}_${gameId}`;
            const reviewId = `${user.uid}_${gameId}`;

            // 1. Game Document (Blind Upsert)
            // We use merge: true so we don't overwrite detailed info if it already exists
            const gameRef = doc(db, 'games', gameId);
            batch.set(gameRef, {
              title: objectname,
              name_lowercase: objectname.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
              bggId: bggId,
              isApproved: true, // Auto-approve BGG imports
              status: 'published',
              // Add placeholders to satisfy validation if rules get tighter
              coverImage: row.image || 'https://images.unsplash.com/photo-1610819013583-67021be397e7?auto=format&fit=crop&q=80&w=400',
              playTime: '30-60 min',
              updatedAt: serverTimestamp()
            }, { merge: true });
            opCount++;

            // 2. User Collection Document (Blind Upsert)
            const collRef = doc(db, 'userCollections', userCollId);
            batch.set(collRef, {
              userId: user.uid,
              gameId: gameId,
              gameTitle: objectname,
              gameTitleLowercase: objectname.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
              gameCover: row.image || 'https://images.unsplash.com/photo-1610819013583-67021be397e7?auto=format&fit=crop&q=80&w=400',
              shelf: shelf,
              categories: [], // Placeholder for future data
              minPlayers: null,
              maxPlayers: null,
              playTime: null,
              isExpansion: false,
              addedAt: serverTimestamp()
            }, { merge: true });
            opCount++;

            // 3. Optional Rating (Blind Upsert)
            if (bggRating > 0) {
              const reviewRef = doc(db, 'reviews', reviewId);
              batch.set(reviewRef, {
                gameId: gameId,
                userId: user.uid,
                userName: user.displayName || 'Gamer',
                userAvatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
                score: bggRating,
                text: 'Imported from BGG', // REQUIRED by rules
                createdAt: serverTimestamp()
              }, { merge: true });
              opCount++;
            }

            // Commit batch when approaching limit
            if (opCount >= BATCH_LIMIT) {
              await batch.commit();
              batch = writeBatch(db);
              opCount = 0;
              setProgress(prev => prev ? { 
                ...prev, 
                current: i + 1, 
                successCount: i + 1,
                status: `Processed ${i + 1} of ${total} games...` 
              } : null);
            }
          }

          // Final commit
          if (opCount > 0) {
            await batch.commit();
          }

          setProgress(prev => prev ? { 
            ...prev, 
            current: total, 
            successCount: total, 
            status: 'All games synced successfully!' 
          } : null);

        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, 'batch_bgg_import');
          setProgress(prev => prev ? { ...prev, status: 'Import failed due to database error.', errorCount: 1 } : null);
        } finally {
          setIsImporting(false);
        }
      },
      error: (error) => {
        console.error('CSV Parse Error:', error);
        setIsImporting(false);
        alert('Error parsing CSV file.');
      }
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          />
          
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-lg bg-charcoal border border-white/10 rounded-[2.5rem] shadow-2xl overflow-hidden p-8"
          >
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-accent/10 rounded-2xl flex items-center justify-center border border-emerald-accent/20">
                  <Upload className="w-6 h-6 text-emerald-accent" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-white tracking-tight">Import from BGG</h2>
                  <p className="text-white/40 text-xs font-bold uppercase tracking-widest">Connect your history</p>
                </div>
              </div>
              <button 
                onClick={onClose}
                className="p-2 hover:bg-white/5 rounded-xl text-white/40 hover:text-white transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              {!progress ? (
                <>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-white/10 rounded-[2rem] p-12 text-center cursor-pointer hover:border-emerald-accent/50 hover:bg-emerald-accent/5 transition-all group"
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept=".csv"
                      onChange={handleFileUpload}
                    />
                    <div className="w-16 h-16 bg-white/5 rounded-3xl flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform">
                      <FileText className="w-8 h-8 text-white/20 group-hover:text-emerald-accent transition-colors" />
                    </div>
                    <h3 className="text-white font-black text-lg mb-2">Select BGG CSV</h3>
                    <p className="text-white/30 text-sm font-medium">Click to browse your computer</p>
                  </div>
                  
                  <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                    <h4 className="text-[10px] font-black text-white/60 uppercase tracking-widest mb-4">How to export from BGG:</h4>
                    <ul className="space-y-3">
                      {[
                        "Go to BoardGameGeek.com",
                        "Go to your Collection",
                        "Scroll to bottom and click 'Export'",
                        "Upload the generated .csv file here"
                      ].map((step, idx) => (
                        <li key={idx} className="flex gap-4 text-xs font-bold text-white/40">
                          <span className="text-emerald-accent">{idx + 1}.</span>
                          {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : (
                <div className="space-y-8">
                  <div className="p-8 bg-white/5 rounded-[2rem] border border-white/10 text-center">
                    {isImporting ? (
                      <Loader2 className="w-12 h-12 text-emerald-accent animate-spin mx-auto mb-6" />
                    ) : progress.errorCount > 0 ? (
                      <AlertCircle className="w-12 h-12 text-rose-500 mx-auto mb-6" />
                    ) : (
                      <CheckCircle2 className="w-12 h-12 text-emerald-accent mx-auto mb-6" />
                    )}
                    
                    <h3 className="text-xl font-black text-white mb-2">
                      {isImporting ? 'Importing Games...' : 'Import Complete!'}
                    </h3>
                    <p className="text-white/40 font-bold text-[10px] uppercase tracking-[0.2em] mb-6">
                      {progress.status}
                    </p>

                    <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden mb-8">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${(progress.current / progress.total) * 100}%` }}
                        className="h-full bg-emerald-accent"
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-1">
                        <div className="text-2xl font-black text-white">{progress.total}</div>
                        <div className="text-[8px] font-black text-white/20 uppercase tracking-widest">Total</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-black text-emerald-accent">{progress.successCount}</div>
                        <div className="text-[8px] font-black text-emerald-accent/40 uppercase tracking-widest">Success</div>
                      </div>
                      <div className="space-y-1">
                        <div className="text-2xl font-black text-rose-500">{progress.errorCount}</div>
                        <div className="text-[8px] font-black text-rose-500/40 uppercase tracking-widest">Failed</div>
                      </div>
                    </div>
                  </div>

                  {!isImporting && (
                    <button 
                      onClick={onClose}
                      className="w-full bg-emerald-accent text-charcoal py-4 rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl hover:shadow-emerald-accent/20 transition-all active:scale-95"
                    >
                      Return to Collection
                    </button>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
