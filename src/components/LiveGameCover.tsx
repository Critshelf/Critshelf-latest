import { useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";
import { Dices } from "lucide-react";
import { cn } from "../lib/utils";

interface LiveGameCoverProps {
  gameId?: string;
  initialCover?: string | null;
  alt: string;
  containerClassName?: string;
  imageClassName?: string;
  isApprovalPending?: boolean;
}

export default function LiveGameCover({
  gameId,
  initialCover,
  alt,
  containerClassName,
  imageClassName,
  isApprovalPending,
}: LiveGameCoverProps) {
  const [src, setSrc] = useState<string | null>(
    initialCover ? String(initialCover).replace(/^http:\/\//i, 'https://').replace(/^\/\//, 'https://') : null
  );
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!gameId) return;
    let isMounted = true;
    
    const fetchLatestCover = async () => {
      try {
        const snap = await getDoc(doc(db, "games", gameId));
        if (isMounted && snap.exists()) {
          const data = snap.data();
          const latestUrl = data.customImageApproved ? data.coverImage : (data.coverImage || data.thumbnail);
          if (latestUrl) {
            setSrc(String(latestUrl).replace(/^http:\/\//i, 'https://').replace(/^\/\//, 'https://'));
            setFailed(false);
          }
        }
      } catch (err) {
        // silently ignore
      }
    };

    fetchLatestCover();

    return () => {
      isMounted = false;
    };
  }, [gameId]);

  return (
    <div className={cn("relative bg-white/5 flex items-center justify-center overflow-hidden shrink-0", containerClassName)}>
      <Dices className="w-1/2 h-1/2 text-emerald-accent/50 absolute z-0" />
      {src && !failed && (
        <img
          src={src}
          alt={alt}
          className={cn("w-full h-full object-cover relative z-10", isApprovalPending ? "blur-md opacity-50 grayscale" : "", imageClassName)}
          referrerPolicy="no-referrer"
          onError={(e) => {
            setFailed(true);
            e.currentTarget.style.display = 'none';
          }}
        />
      )}
    </div>
  );
}
