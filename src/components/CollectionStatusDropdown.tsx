import { useState, useEffect } from 'react';
import { useUser } from '../contexts/UserContext';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { doc, setDoc, onSnapshot, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import { Plus, Check, ChevronDown, Loader2, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { logSocialActivity } from '../lib/socialActivityLogger';

interface CollectionStatusDropdownProps {
  gameId: string;
  gameTitle: string;
  gameCover: string;
  isArtApproved?: boolean;
  categories?: string[];
  minPlayers?: number;
  maxPlayers?: number;
  playTime?: string | number | null;
  isExpansion?: boolean;
  size?: 'sm' | 'md';
  dropdownPosition?: 'top' | 'bottom';
}

export default function CollectionStatusDropdown({ 
  gameId, 
  gameTitle, 
  gameCover,
  isArtApproved = false,
  categories = [],
  minPlayers,
  maxPlayers,
  playTime,
  isExpansion = false,
  size = 'md',
  dropdownPosition = 'top'
}: CollectionStatusDropdownProps) {
  const { user, profile, refreshProfile, userGroupIds } = useUser();
  const [collectionStatus, setCollectionStatus] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);
  const [addingToShelf, setAddingToShelf] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      setCollectionStatus(null);
      return;
    }
    const unsub = onSnapshot(doc(db, 'userCollections', `${user.uid}_${gameId}`), (snap) => {
      setCollectionStatus(snap.exists() ? snap.data().shelf : null);
      setLoading(false);
    }, (error) => {
      console.error("Collection status error:", error);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid, gameId]);

  const shelves = [
    { id: 'owned', label: 'Owned', color: 'bg-emerald-500' },
    { id: 'wishlist', label: 'Wishlist', color: 'bg-rose-500' },
  ];

  const addToCollection = async (shelfId: string) => {
    if (!user) {
      alert('Please sign in to add games to your collection!');
      return;
    }

    setAddingToShelf(shelfId);
    try {
      await setDoc(doc(db, 'userCollections', `${user.uid}_${gameId}`), {
        userId: user.uid,
        gameId: gameId,
        gameTitle: gameTitle,
        gameTitleLowercase: gameTitle.toLowerCase(),
        gameCover: gameCover,
        isArtApproved: isArtApproved,
        categories: categories || [],
        minPlayers: minPlayers || null,
        maxPlayers: maxPlayers || null,
        playTime: playTime || null,
        isExpansion: isExpansion,
        shelf: shelfId,
        addedAt: serverTimestamp(),
      });

      logSocialActivity({
        type: 'COLLECTION_ADD',
        actorId: user.uid,
        actorName: user.displayName || 'Anonymous',
        targetId: gameId,
        targetName: gameTitle,
        metadata: {
          gameCover: gameCover,
          isArtApproved: isArtApproved,
          shelf: shelfId
        }
      });

      if (refreshProfile) await refreshProfile();
      setShowMenu(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `userCollections/${user.uid}_${gameId}`);
    } finally {
      setAddingToShelf(null);
    }
  };

  const removeFromCollection = async () => {
    if (!user) return;
    
    setAddingToShelf('removing');
    try {
      await deleteDoc(doc(db, 'userCollections', `${user.uid}_${gameId}`));
      if (refreshProfile) await refreshProfile();
      setShowMenu(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `userCollections/${user.uid}_${gameId}`);
    } finally {
      setAddingToShelf(null);
    }
  };

  if (loading && !collectionStatus) return (
    <div className={cn(
      "animate-pulse bg-white/5 rounded-2xl",
      size === 'sm' ? "w-24 h-8" : "w-40 h-12"
    )} />
  );

  return (
    <div className="relative">
      <button 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className={cn(
          "flex items-center gap-2 rounded-2xl font-black transition-all border backdrop-blur-md active:scale-95 text-[10px] uppercase tracking-widest whitespace-nowrap",
          size === 'sm' ? "px-3 py-2" : "px-4 md:px-6 py-3 md:py-4",
          collectionStatus 
            ? (collectionStatus === 'owned' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400")
            : "bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10"
        )}
      >
        {collectionStatus ? (
          <>
            <Check className={cn(size === 'sm' ? "w-3 h-3" : "w-3 h-3 md:w-4 md:h-4")} />
            <span className={cn(size === 'sm' ? "hidden" : "hidden sm:inline")}>
              {size === 'sm' ? '' : 'In Collection:'}
            </span> {collectionStatus === 'owned' ? 'Owned' : 'Wishlist'}
          </>
        ) : (
          <>
            <Plus className={cn(size === 'sm' ? "w-3 h-3" : "w-3 h-3 md:w-4 md:h-4")} />
            {size !== 'sm' && "Add to Collection"}
            {size === 'sm' && "Shelf"}
          </>
        )}
        <ChevronDown className={cn(size === 'sm' ? "w-3 h-3" : "w-3 h-3 md:w-4 md:h-4", "transition-transform", showMenu && "rotate-180")} />
      </button>

      <AnimatePresence>
        {showMenu && (
          <motion.div
            initial={{ opacity: 0, y: dropdownPosition === 'top' ? 10 : -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: dropdownPosition === 'top' ? 10 : -10, scale: 0.95 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "absolute left-0 w-64 bg-charcoal rounded-3xl shadow-2xl p-3 z-[100] border border-white/10",
              dropdownPosition === 'top' ? "bottom-full mb-3" : "top-full mt-3"
            )}
          >
            <div className="space-y-1">
              {shelves.map((shelf) => (
                <button
                  key={shelf.id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    addToCollection(shelf.id);
                  }}
                  disabled={addingToShelf === shelf.id}
                  className={cn(
                    "w-full flex items-center justify-between p-3 rounded-2xl transition-all group/item",
                    collectionStatus === shelf.id ? "bg-white/5" : "hover:bg-white/5"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("w-3 h-3 rounded-full", shelf.color, collectionStatus === shelf.id && "ring-2 ring-white/20")} />
                    <span className={cn(
                      "font-black text-sm uppercase tracking-widest text-left",
                      collectionStatus === shelf.id ? "text-white" : "text-white/40 group-hover/item:text-white"
                    )}>
                      {shelf.label}
                      {collectionStatus === shelf.id && " (Active)"}
                    </span>
                  </div>
                  {addingToShelf === shelf.id ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-accent" />
                  ) : collectionStatus === shelf.id ? (
                    <Check className="w-4 h-4 text-emerald-accent" />
                  ) : (
                    <Plus className="w-4 h-4 text-white/10 group-hover/item:text-emerald-accent transition-colors" />
                  )}
                </button>
              ))}
              
              {collectionStatus && (
                <div className="pt-2 mt-2 border-t border-white/5">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      removeFromCollection();
                    }}
                    disabled={addingToShelf === 'removing'}
                    className="w-full flex items-center gap-3 p-3 rounded-2xl hover:bg-rose-500/10 text-rose-500/60 hover:text-rose-500 transition-all group/remove"
                  >
                    {addingToShelf === 'removing' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <X className="w-4 h-4" />
                    )}
                    <span className="font-black text-[10px] uppercase tracking-[0.2em] text-left">Remove from Collection</span>
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
