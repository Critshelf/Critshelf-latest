import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, X, Loader2, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import Papa from 'papaparse';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';
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

  const fetchWikidata = async (bggId: string, title: string) => {
    const endpoint = "https://query.wikidata.org/sparql?format=json";
    const sparql = `
      SELECT ?image ?minPlayers ?maxPlayers WHERE {
        ?item wdt:P2339 "${bggId}".
        OPTIONAL { ?item wdt:P18 ?image. }
        OPTIONAL { ?item wdt:P1872 ?minPlayers. }
        OPTIONAL { ?item wdt:P1873 ?maxPlayers. }
      } LIMIT 1
    `;
    
    try {
      const response = await fetch(`${endpoint}&query=${encodeURIComponent(sparql)}`);
      if (!response.ok) throw new Error('Wikidata response not ok');
      const data = await response.json();
      const result = data.results.bindings[0];

      if (!result) return null;

      let imageUrl = '';
      if (result.image) {
        // Extract filename from URL (e.g., http://commons.wikimedia.org/wiki/Special:FilePath/FileName.jpg)
        const fullUrl = result.image.value;
        const filename = fullUrl.split('/').pop();
        imageUrl = `https://commons.wikimedia.org/wiki/Special:FilePath/${filename}`;
      }

      return {
        image: imageUrl || `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(title)}`,
        minPlayers: result.minPlayers ? parseInt(result.minPlayers.value) : undefined,
        maxPlayers: result.maxPlayers ? parseInt(result.maxPlayers.value) : undefined,
      };
    } catch (error) {
      console.error('Wikidata fetch error:', error);
      return null;
    }
  };

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
        setProgress({ total, current: 0, status: 'Analyzing collection...', successCount: 0, errorCount: 0 });

        const missingGamesQueue: any[] = [];
        const existingGamesMap = new Map<string, any>();

        // Step 1: Initial Firestore Check
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const bggId = String(row.objectid || row['Object ID'] || row['ObjectID'] || '');
          const objectname = row.objectname || row['Object Name'] || row['ObjectName'] || '';
          
          if (!bggId || !objectname) {
            setProgress(prev => prev ? { ...prev, current: i + 1 } : null);
            continue;
          }

          setProgress(prev => prev ? { ...prev, current: i + 1, status: `Analyzing: ${objectname}` } : null);

          try {
            const gamesQuery = query(collection(db, 'games'), where('bggId', '==', bggId));
            const gamesSnap = await getDocs(gamesQuery);
            
            if (!gamesSnap.empty) {
              existingGamesMap.set(bggId, {
                id: gamesSnap.docs[0].id,
                data: gamesSnap.docs[0].data()
              });
            } else {
              missingGamesQueue.push({ bggId, objectname, row });
            }
          } catch (error) {
            console.error(`Check error for ${objectname}:`, error);
          }
        }

        const totalToFetch = missingGamesQueue.length;
        let remainingCount = totalToFetch;

        // Step 2: Implement Batch Processing with Countdown
        const BATCH_SIZE = 100;
        for (let i = 0; i < missingGamesQueue.length; i += BATCH_SIZE) {
          const currentBatch = missingGamesQueue.slice(i, i + BATCH_SIZE);
          
          setProgress(prev => prev ? { 
            ...prev, 
            status: `Importing... ${remainingCount} missing games left to fetch from Wikidata.` 
          } : null);

          await Promise.all(currentBatch.map(async (item) => {
            try {
              const wikiData = await fetchWikidata(item.bggId, item.objectname);
              const gameId = `bgg_${item.bggId}`;
              const gameData = {
                title: item.objectname,
                coverImage: wikiData?.image || `https://api.dicebear.com/9.x/shapes/svg?seed=${encodeURIComponent(item.objectname)}`,
                minPlayers: wikiData?.minPlayers || 1,
                maxPlayers: wikiData?.maxPlayers || 4,
                playTime: "60",
                bggId: item.bggId,
                hasHighResArt: false,
                isApproved: false,
                status: 'pending',
                createdAt: serverTimestamp()
              };

              await setDoc(doc(db, 'games', gameId), gameData);
              
              // Notify Discord about new game
              try {
                await fetch('/api/webhooks/new-game', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    gameId: gameId,
                    gameTitle: item.objectname,
                    bggId: item.bggId,
                    importedBy: user.uid
                  })
                });
              } catch (notifyError) {
                console.error("Failed to notify Discord about new game:", notifyError);
              }

              existingGamesMap.set(item.bggId, { id: gameId, data: gameData });
            } catch (error) {
              console.error(`Wikidata fetch/save error for ${item.objectname}:`, error);
            }
          }));

          remainingCount -= currentBatch.length;
          console.log(`Wikidata Batch Complete. Processed: ${currentBatch.length}. Remaining items to fetch: ${remainingCount}`);
        }

        // Step 3: Finalize User Collections
        setProgress(prev => prev ? { ...prev, status: 'Finalizing collection...' } : null);
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const bggId = String(row.objectid || row['Object ID'] || row['ObjectID'] || '');
          const objectname = row.objectname || row['Object Name'] || row['ObjectName'] || '';
          const bggRating = typeof row.rating === 'number' ? row.rating : 0;
          const isOwned = row.own === 1 || row['Own'] === 1;
          const isWishlist = row.wishlist === 1 || row['Wishlist'] === 1;

          if (!bggId || !objectname) continue;

          const gameInfo = existingGamesMap.get(bggId);
          if (!gameInfo) {
            setProgress(prev => prev ? { ...prev, current: i + 1, errorCount: prev.errorCount + 1 } : null);
            continue;
          }

          try {
            const shelf = isWishlist && !isOwned ? 'wishlist' : 'owned';
            const userCollId = `${user.uid}_${gameInfo.id}`;
            
            await setDoc(doc(db, 'userCollections', userCollId), {
              userId: user.uid,
              gameId: gameInfo.id,
              gameTitle: gameInfo.data.title,
              gameCover: gameInfo.data.coverImage,
              shelf: shelf,
              addedAt: serverTimestamp()
            });

            if (bggRating > 0) {
              const reviewId = `${user.uid}_${gameInfo.id}`;
              await setDoc(doc(db, 'reviews', reviewId), {
                gameId: gameInfo.id,
                userId: user.uid,
                userName: user.displayName || 'Gamer',
                userAvatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
                score: bggRating,
                createdAt: serverTimestamp()
              }, { merge: true });
            }

            setProgress(prev => prev ? { ...prev, current: i + 1, successCount: prev.successCount + 1 } : null);
          } catch (error) {
            console.error(`Error finalizing ${objectname}:`, error);
            setProgress(prev => prev ? { ...prev, current: i + 1, errorCount: prev.errorCount + 1 } : null);
          }
        }

        setProgress(prev => prev ? { ...prev, status: 'Import complete!' } : null);
        setIsImporting(false);
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
