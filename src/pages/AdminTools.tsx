import { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, getDocs, writeBatch, doc, getDoc, deleteDoc, updateDoc, query, where, orderBy, startAfter, limit, serverTimestamp, getCountFromServer } from 'firebase/firestore';
import { useUser } from '../contexts/UserContext';
import { cn } from '../lib/utils';
import { Shield, CheckCircle2, Loader2, AlertTriangle, Trash2, Search, Eraser, AlertCircle, Database, Check, RefreshCw, Clock as ClockIcon } from 'lucide-react';

export default function AdminTools() {
  const { profile } = useUser();
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [progress, setProgress] = useState(0);

  const bulkVerifyAllGames = async () => {
    if (loading) return;
    setLoading(true);
    setStatus({ type: null, message: '' });
    setProgress(0);

    try {
      const gamesRef = collection(db, 'games');
      const qTotal = query(gamesRef, where('isApproved', '!=', true));
      const totalSnap = await getCountFromServer(qTotal);
      const totalToVerify = totalSnap.data().count;

      if (totalToVerify === 0) {
        setStatus({ type: 'success', message: 'All games in the vault are already verified!' });
        setLoading(false);
        return;
      }

      let processed = 0;
      let lastDoc = null;

      while (processed < totalToVerify) {
        let q = query(gamesRef, where('isApproved', '!=', true), limit(500));
        if (lastDoc) {
          q = query(gamesRef, where('isApproved', '!=', true), startAfter(lastDoc), limit(500));
        }

        const snapshot = await getDocs(q);
        if (snapshot.empty) break;

        const batch = writeBatch(db);
        snapshot.docs.forEach(gameDoc => {
          const data = gameDoc.data();
          batch.update(gameDoc.ref, { 
            isApproved: true,
            needsVerification: false,
            name_lowercase: (data.title || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
            updatedAt: serverTimestamp()
          });
        });

        await batch.commit();
        processed += snapshot.docs.length;
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        setProgress((processed / totalToVerify) * 100);
      }

      setStatus({ type: 'success', message: `Vault Secured! Successfully verified ${processed} games.` });
      localStorage.removeItem('cachedRecentGames_v5');
    } catch (error: any) {
      console.error("Bulk verification error:", error);
      setStatus({ type: 'error', message: error.message || 'Failed to complete bulk verification.' });
    } finally {
      setLoading(false);
    }
  };

  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const [syncProgress, setSyncProgress] = useState(0);
  const [syncLoading, setSyncLoading] = useState(false);
  
  // Audit & Cleanup States
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditProgress, setAuditProgress] = useState(0);
  const [flaggedGames, setFlaggedGames] = useState<any[]>([]);
  const [fetchingFlagged, setFetchingFlagged] = useState(false);
  const [hasMoreFlagged, setHasMoreFlagged] = useState(true);
  const [lastFlaggedDoc, setLastFlaggedDoc] = useState<any>(null);

  // Metadata Hydration States
  const [hydrationLoading, setHydrationLoading] = useState(false);
  const [hydrationStatus, setHydrationStatus] = useState('Idle');
  const [lastVisibleDoc, setLastVisibleDoc] = useState<any>(null);
  const [hydratedCount, setHydratedCount] = useState(0);

  // Stats
  const [totalGamesCount, setTotalGamesCount] = useState<number | null>(null);

  // Patch audienceIds using following array
  const [patchLoading, setPatchLoading] = useState(false);
  const [patchStatus, setPatchStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  const [selfInvitePatchLoading, setSelfInvitePatchLoading] = useState(false);
  const [selfInvitePatchStatus, setSelfInvitePatchStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  const scanMissingPlayIds = async () => {
    try {
      const snap = await getDocs(query(collection(db, 'activities'), where('type', '==', 'LOG_PLAY'), limit(10)));
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() as any }));
      console.log('LOG_PLAY ACTIVITIES DUMP:', docs.map(d => ({
        id: d.id,
        targetId: d.targetId,
        metadata: d.metadata
      })));
      alert(`Found ${docs.length} LOG_PLAY. Check console.`);
    } catch(e: any) {
      alert("Error: " + e.message);
    }
  };

  const [playBackfillLoading, setPlayBackfillLoading] = useState(false);
  const [playBackfillStatus, setPlayBackfillStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  const runPlayIdBackfill = async () => {
    if (playBackfillLoading) return;
    setPlayBackfillLoading(true);
    setPlayBackfillStatus({ type: null, message: 'Finding missing playIds...' });

    try {
      // 1. Fetch activities with missing playId
      const actSnap = await getDocs(query(collection(db, 'activities'), where('type', '==', 'LOG_PLAY')));
      const actsToFix = actSnap.docs.filter(d => !d.data()?.metadata?.playId);

      if (actsToFix.length === 0) {
        setPlayBackfillStatus({ type: 'success', message: 'No missing playIds found.' });
        setPlayBackfillLoading(false);
        return;
      }

      setPlayBackfillStatus({ type: null, message: `Found ${actsToFix.length} activities. Matching with plays...` });

      let batch = writeBatch(db);
      let operationCount = 0;
      let totalPatched = 0;

      // Match plays for each activity
      for (const actDoc of actsToFix) {
        const actData = actDoc.data();
        
        // Find a matching play
        const playsSnap = await getDocs(query(
            collection(db, 'plays'), 
            where('userId', '==', actData.actorId),
            where('gameId', '==', actData.targetId),
            limit(1)
        ));

        if (!playsSnap.empty) {
            const playDoc = playsSnap.docs[0];
            const correctPlayId = playDoc.id;
            
            // Reconstruct metadata
            const oldMetadata = actData.metadata || {};
            const newMetadata = { ...oldMetadata, playId: correctPlayId };
            
            batch.update(actDoc.ref, { metadata: newMetadata });
            operationCount++;
            totalPatched++;
        }

        if (operationCount >= 400) {
            await batch.commit();
            batch = writeBatch(db);
            operationCount = 0;
            console.log(`Committed chunk... total patched: ${totalPatched}`);
        }
      }

      if (operationCount > 0) {
          await batch.commit();
      }

      setPlayBackfillStatus({ type: 'success', message: `Patch complete! Linked ${totalPatched} activities to plays.` });
    } catch(err: any) {
        console.error("Backfill Error:", err);
        setPlayBackfillStatus({ type: 'error', message: err?.message || 'Failed to backfill.' });
    } finally {
        setPlayBackfillLoading(false);
    }
  };

  const runSelfInvitePatch = async () => {
    if (selfInvitePatchLoading) return;
    setSelfInvitePatchLoading(true);
    setSelfInvitePatchStatus({ type: null, message: 'Running self-invite patch...' });

    try {
      setSelfInvitePatchStatus({ type: null, message: 'Fetching activities...' });
      const activitiesSnap = await getDocs(collection(db, 'activities'));
      
      if (activitiesSnap.empty) {
        setSelfInvitePatchStatus({ type: 'success', message: 'No activities found.' });
        setSelfInvitePatchLoading(false);
        return;
      }

      let batch = writeBatch(db);
      let operationCount = 0;
      let totalPatched = 0;
      
      setSelfInvitePatchStatus({ type: null, message: 'Patching activities...' });

      for (const actDoc of activitiesSnap.docs) {
        const actData = actDoc.data();
        const actorId = actData.actorId;
        const audienceIds = actData.audienceIds || [];
        
        if (actorId && !audienceIds.includes(actorId)) {
          const correctedAudienceIds = [...new Set([actorId, ...audienceIds])];

          batch.update(actDoc.ref, { audienceIds: correctedAudienceIds });
          operationCount++;
          totalPatched++;
        }

        // Commit every 400 operations
        if (operationCount >= 400) {
          await batch.commit();
          batch = writeBatch(db);
          operationCount = 0;
          console.log(`Committed self-invite chunk... total patched so far: ${totalPatched}`);
        }
      }

      if (operationCount > 0) {
        await batch.commit();
      }

      console.log(`Self-Invite Patch Complete. Total patched: ${totalPatched}`);
      setSelfInvitePatchStatus({ type: 'success', message: `Patch complete! Successfully updated ${totalPatched} activities.` });
    } catch (err: any) {
      console.error("Self-Invite Patch Error:", err);
      setSelfInvitePatchStatus({ type: 'error', message: err?.message || 'Self-Invite Patch Failed.' });
    } finally {
      setSelfInvitePatchLoading(false);
    }
  };
  
  const runAudiencePatch = async () => {
    if (patchLoading) return;
    setPatchLoading(true);
    setPatchStatus({ type: null, message: 'Running audience patch...' });

    try {
      // 1. Fetch all users to build follower map
      setPatchStatus({ type: null, message: 'Fetching users...' });
      const usersSnap = await getDocs(collection(db, 'users'));
      const followerMap: Record<string, string[]> = {};
      
      usersSnap.docs.forEach(doc => {
        const data = doc.data();
        const userId = doc.id;
        const following = data.following || [];
        
        // If User A follows User B, add User A to User B's follower list
        following.forEach((followedId: string) => {
          if (!followerMap[followedId]) {
            followerMap[followedId] = [];
          }
          followerMap[followedId].push(userId);
        });
      });

      // 2. Fetch all activities
      setPatchStatus({ type: null, message: 'Fetching activities...' });
      const activitiesSnap = await getDocs(collection(db, 'activities'));
      
      if (activitiesSnap.empty) {
        setPatchStatus({ type: 'success', message: 'No activities found.' });
        setPatchLoading(false);
        return;
      }

      // 3. Batched execution
      let batch = writeBatch(db);
      let operationCount = 0;
      let totalPatched = 0;
      
      setPatchStatus({ type: null, message: 'Patching activities...' });

      for (const actDoc of activitiesSnap.docs) {
        const actData = actDoc.data();
        const actorId = actData.actorId;
        
        // Sometimes actorId may be null if it's very old, handle if it exists
        if (actorId) {
          const followers = followerMap[actorId] || [];
          const correctedAudienceIds = [...new Set([actorId, ...followers])];

          batch.update(actDoc.ref, { audienceIds: correctedAudienceIds });
          operationCount++;
          totalPatched++;
        }

        // Commit every 400 operations to stay well within the 500 limit
        if (operationCount >= 400) {
          await batch.commit();
          batch = writeBatch(db); // Create a new batch
          operationCount = 0;
          console.log(`Committed chunk... total patched so far: ${totalPatched}`);
        }
      }

      // Commit any remaining
      if (operationCount > 0) {
        await batch.commit();
      }

      console.log(`Audience Patch Complete. Total patched: ${totalPatched}`);
      setPatchStatus({ type: 'success', message: `Patch complete! Successfully updated ${totalPatched} activities.` });
    } catch (err: any) {
      console.error("Audience Patch Error:", err);
      setPatchStatus({ type: 'error', message: err?.message || 'Audience Patch Failed.' });
    } finally {
      setPatchLoading(false);
    }
  };

  // Initialize bookmark from localStorage
  useEffect(() => {
    const initBookmark = async () => {
      const bookmarkId = localStorage.getItem('hydrationBookmark');
      if (bookmarkId) {
        try {
          const docRef = doc(db, 'games', bookmarkId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setLastVisibleDoc(docSnap);
            setHydrationStatus('Bookmark loaded. Ready to continue.');
          } else {
            localStorage.removeItem('hydrationBookmark');
            setHydrationStatus('Previous bookmark missing. Starting fresh.');
          }
        } catch (err) {
          console.error("Bookmark recovery failed:", err);
        }
      }
    };
    initBookmark();
  }, []);

  useEffect(() => {
    if (profile?.role === 'admin') {
      fetchFlaggedGames(true);
      fetchStats();
    }
  }, [profile?.uid, profile?.role]);

  const fetchStats = async () => {
    try {
      const snap = await getCountFromServer(collection(db, 'games'));
      setTotalGamesCount(snap.data().count);
    } catch (err) {
      console.warn("Stats fetch failed");
    }
  };

  const fetchFlaggedGames = async (reset = false) => {
    setFetchingFlagged(true);
    try {
      const gamesRef = collection(db, 'games');
      let q = query(
        gamesRef, 
        where('flaggedForDeletion', '==', true),
        limit(20)
      );

      if (!reset && lastFlaggedDoc) {
        q = query(
          gamesRef,
          where('flaggedForDeletion', '==', true),
          startAfter(lastFlaggedDoc),
          limit(20)
        );
      }

      const snap = await getDocs(q);
      const newGames = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (reset) {
        setFlaggedGames(newGames);
      } else {
        setFlaggedGames(prev => [...prev, ...newGames]);
      }

      setLastFlaggedDoc(snap.docs[snap.docs.length - 1]);
      setHasMoreFlagged(snap.docs.length === 20);
    } catch (err) {
      console.error("Failed to fetch flagged games:", err);
    } finally {
      setFetchingFlagged(false);
    }
  };

  const auditDatabaseForMedia = async () => {
    if (auditLoading) return;
    setAuditLoading(true);
    setAuditProgress(0);
    setStatus({ type: null, message: '' });

    const FORBIDDEN_KEYWORDS = [
      "video game", "pc game", "playstation", "xbox", "nintendo", 
      "television series", "hbo", "film", "movie", "album", 
      "soundtrack", "bluray", "dvd", "sega", "game boy"
    ];

    try {
      const gamesRef = collection(db, 'games');
      const totalSnap = await getCountFromServer(gamesRef);
      const totalDocs = totalSnap.data().count;

      let processed = 0;
      let flaggedCount = 0;
      let lastDoc = null;

      while (processed < totalDocs) {
        let q = query(gamesRef, orderBy('title'), limit(500));
        if (lastDoc) {
          q = query(gamesRef, orderBy('title'), startAfter(lastDoc), limit(500));
        }

        const snapshot = await getDocs(q);
        if (snapshot.empty) break;

        const batch = writeBatch(db);
        snapshot.docs.forEach(gameDoc => {
          const data = gameDoc.data();
          const title = (data.title || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
          const desc = (data.description || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
          const categories = (data.categories || []).map((c: string) => c.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""));
          
          let flagReason = "";
          
          const matchedKeyword = FORBIDDEN_KEYWORDS.find(kw => 
            title.includes(kw) || desc.includes(kw) || categories.some((c: string) => c.includes(kw))
          );

          if (matchedKeyword) {
            flagReason = `Matched keyword: ${matchedKeyword}`;
          } else if (!data.minPlayers || data.minPlayers === 0 || !data.maxPlayers) {
            flagReason = "Missing player count data";
          }

          if (flagReason) {
            batch.update(gameDoc.ref, {
              flaggedForDeletion: true,
              flagReason: flagReason,
              updatedAt: serverTimestamp()
            });
            flaggedCount++;
          }
        });

        await batch.commit();
        processed += snapshot.docs.length;
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        setAuditProgress((processed / totalDocs) * 100);
      }

      setStatus({ type: 'success', message: `Audit complete. Flagged ${flaggedCount} potential non-board game items.` });
      fetchFlaggedGames(true);
    } catch (error: any) {
      console.error("Audit error:", error);
      setStatus({ type: 'error', message: error.message || 'Audit failed.' });
    } finally {
      setAuditLoading(false);
    }
  };

  const purgeGame = async (gameId: string) => {
    try {
      await deleteDoc(doc(db, 'games', gameId));
      setFlaggedGames(prev => prev.filter(g => g.id !== gameId));
    } catch (err) {
      console.error("Purge failed:", err);
    }
  };

  const keepGame = async (gameId: string) => {
    try {
      const gameRef = doc(db, 'games', gameId);
      await updateDoc(gameRef, {
        flaggedForDeletion: false,
        flagReason: null,
        isApproved: true,
        updatedAt: serverTimestamp()
      });
      setFlaggedGames(prev => prev.filter(g => g.id !== gameId));
    } catch (err) {
      console.error("Keep failed:", err);
    }
  };

  const fetchWikipediaDescription = async (articleTitle: string) => {
    const params = new URLSearchParams({
      action: 'query',
      prop: 'extracts',
      exintro: 'true',
      explaintext: 'true',
      titles: articleTitle,
      format: 'json',
      origin: '*'
    });

    try {
      const response = await fetch(`https://en.wikipedia.org/w/api.php?${params.toString()}`);
      if (!response.ok) return null;
      const data = await response.json();
      const pages = data.query.pages;
      const pageId = Object.keys(pages)[0];
      return pages[pageId].extract || null;
    } catch (error) {
      return null;
    }
  };

  const fetchWikidataDetails = async (qid: string) => {
    const sparqlQuery = `
      SELECT ?year ?wikipediaUrl ?wikidataDescription
             (GROUP_CONCAT(DISTINCT ?publisherLabel; separator="|") AS ?publishers)
             (GROUP_CONCAT(DISTINCT ?designerLabel; separator="|") AS ?designers)
             (GROUP_CONCAT(DISTINCT ?artistLabel; separator="|") AS ?artists)
      WHERE {
        BIND(wd:${qid} AS ?game)
        OPTIONAL { ?game wdt:P577 ?date. BIND(YEAR(?date) AS ?year) }
        OPTIONAL { ?game wdt:P123 ?publisher. ?publisher rdfs:label ?publisherLabel. FILTER(LANG(?publisherLabel) = "en") }
        OPTIONAL { ?game wdt:P287 ?designer. ?designer rdfs:label ?designerLabel. FILTER(LANG(?designerLabel) = "en") }
        OPTIONAL { ?game wdt:P110 ?artist. ?artist rdfs:label ?artistLabel. FILTER(LANG(?artistLabel) = "en") }
        OPTIONAL { ?wikipediaUrl schema:about ?game; schema:isPartOf <https://en.wikipedia.org/>. }
        OPTIONAL { ?game schema:description ?wikidataDescription. FILTER(LANG(?wikidataDescription) = "en") }
      }
      GROUP BY ?year ?wikipediaUrl ?wikidataDescription
      LIMIT 1
    `;
    const url = `/api/wikidata/sparql?query=${encodeURIComponent(sparqlQuery)}&format=json`;
    try {
      const response = await fetch(url);
      if (!response.ok) return null;
      const data = await response.json();
      return data.results.bindings[0];
    } catch (error) {
      return null;
    }
  };

  const processNextHydrationBatch = async () => {
    if (hydrationLoading) return;
    setHydrationLoading(true);
    setHydrationStatus('Fetching Batch...');

    try {
      const gamesRef = collection(db, 'games');
      const q = lastVisibleDoc
        ? query(gamesRef, orderBy('title'), startAfter(lastVisibleDoc), limit(50))
        : query(gamesRef, orderBy('title'), limit(50));

      const snapshot = await getDocs(q);
      console.log("Documents fetched from Firestore: ", snapshot.docs.length);

      if (snapshot.empty) {
        setHydrationStatus('No more games to process.');
        setHydrationLoading(false);
        return;
      }

      const lastDoc = snapshot.docs[snapshot.docs.length - 1];
      setLastVisibleDoc(lastDoc);
      localStorage.setItem('hydrationBookmark', lastDoc.id);

      const batch = writeBatch(db);
      let countAffected = 0;
      let currentIndex = 0;

      for (const gameDoc of snapshot.docs) {
        currentIndex++;
        const data = gameDoc.data();
        
        // Criteria: missing description or player counts or categories
        const needsHydration = !data.description || data.description.includes('No description available') || !data.categories || data.categories.length === 0 || !data.minPlayers;
        const wikidataId = data.wikidataId;

        // Start with basic updates (stamp every doc in the batch as hydrated)
        const updates: any = {
          isHydrated: true,
          updatedAt: serverTimestamp()
        };

        if (needsHydration && wikidataId) {
          setHydrationStatus(`Hydrating [${currentIndex}/50]: ${data.title}...`);
          
          const wikidataResult = await fetchWikidataDetails(wikidataId);
          if (wikidataResult) {
            if (wikidataResult.year) updates.publishingYear = parseInt(wikidataResult.year.value);
            if (wikidataResult.publishers?.value) updates.publishers = wikidataResult.publishers.value.split('|');
            if (wikidataResult.designers?.value) updates.designers = wikidataResult.designers.value.split('|');
            if (wikidataResult.artists?.value) updates.artists = wikidataResult.artists.value.split('|');

            let description = null;
            if (wikidataResult.wikipediaUrl) {
              const wikipediaUrl = wikidataResult.wikipediaUrl.value;
              const articleTitle = decodeURIComponent(wikipediaUrl.split('/wiki/')[1]);
              description = await fetchWikipediaDescription(articleTitle);
            }

            if (!description && wikidataResult.wikidataDescription) {
              description = wikidataResult.wikidataDescription.value;
            }

            if (description) updates.description = description;
            countAffected++;
          }

          // Mandatory 1 second rate limit
          await new Promise(resolve => setTimeout(resolve, 1000));
        } else {
          setHydrationStatus(`Skipping [${currentIndex}/50]: ${data.title} (Already Hydrated)`);
        }

        // Apply updates (stamping isHydrated for all processed docs)
        batch.update(gameDoc.ref, updates);
      }

      await batch.commit();
      setHydratedCount(prev => prev + currentIndex);
      setHydrationStatus(`Batch Complete! Processed 50 docs, Hydrated ${countAffected} items.`);

    } catch (error: any) {
      console.error("Hydration batch error:", error);
      setHydrationStatus(`Error: ${error.message}`);
    } finally {
      setHydrationLoading(false);
    }
  };

  const [globalSyncLoading, setGlobalSyncLoading] = useState(false);
  const [globalSyncProgress, setGlobalSyncProgress] = useState(0);

  const syncGlobalGameSearchMetadata = async () => {
    if (globalSyncLoading) return;
    setGlobalSyncLoading(true);
    setGlobalSyncProgress(0);

    try {
      const gamesRef = collection(db, 'games');
      const totalSnap = await getCountFromServer(gamesRef);
      const totalDocs = totalSnap.data().count;

      let processed = 0;
      let lastDoc = null;

      while (processed < totalDocs) {
        let q = query(gamesRef, orderBy('title'), limit(500));
        if (lastDoc) {
          q = query(gamesRef, orderBy('title'), startAfter(lastDoc), limit(500));
        }

        const snapshot = await getDocs(q);
        if (snapshot.empty) break;

        const batch = writeBatch(db);
        snapshot.docs.forEach(gameDoc => {
          const data = gameDoc.data();
          if (!data.name_lowercase) {
            batch.update(gameDoc.ref, {
              name_lowercase: (data.title || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
              updatedAt: serverTimestamp()
            });
          }
        });

        await batch.commit();
        processed += snapshot.docs.length;
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        setGlobalSyncProgress((processed / totalDocs) * 100);
      }

      setStatus({ type: 'success', message: `Global search metadata standardized for ${processed} games!` });
    } catch (error: any) {
      console.error("Global sync error:", error);
      setStatus({ type: 'error', message: error.message || 'Failed to sync global search metadata.' });
    } finally {
      setGlobalSyncLoading(false);
    }
  };

  const denormalizeCollectionMetadata = async () => {
    if (syncLoading) return;
    setSyncLoading(true);
    setSyncStatus({ type: null, message: '' });
    setSyncProgress(0);

    try {
      const collRef = collection(db, 'userCollections');
      const totalSnap = await getCountFromServer(collRef);
      const totalDocs = totalSnap.data().count;

      let processed = 0;
      let lastDoc = null;

      while (processed < totalDocs) {
        let q = query(collRef, limit(100)); // Smaller batch because of individual getDocs inside
        if (lastDoc) {
          q = query(collRef, startAfter(lastDoc), limit(100));
        }

        const snapshot = await getDocs(q);
        if (snapshot.empty) break;

        const batch = writeBatch(db);
        for (const itemDoc of snapshot.docs) {
          const itemData = itemDoc.data();
          const gameId = itemData.gameId;
          
          const gameSnap = await getDoc(doc(db, 'games', gameId));
          if (gameSnap.exists()) {
            const gameData = gameSnap.data();
            batch.update(itemDoc.ref, {
              gameTitleLowercase: (itemData.gameTitle || '').toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""),
              categories: gameData.categories || [],
              minPlayers: gameData.minPlayers || null,
              maxPlayers: gameData.maxPlayers || null,
              playTime: gameData.playTime || null,
              isExpansion: gameData.isExpansion || false,
              updatedAt: serverTimestamp()
            });
          }
        }

        await batch.commit();
        processed += snapshot.docs.length;
        lastDoc = snapshot.docs[snapshot.docs.length - 1];
        setSyncProgress((processed / totalDocs) * 100);
      }

      setSyncStatus({ type: 'success', message: `Successfully synced metadata for ${processed} items!` });
      localStorage.removeItem('cachedRecentGames_v5');
    } catch (error: any) {
      console.error("Sync error:", error);
      setSyncStatus({ type: 'error', message: error.message || 'Failed to sync metadata.' });
    } finally {
      setSyncLoading(false);
    }
  };

  if (!profile || profile.role !== 'admin') {
    return (
      <div className="min-h-screen bg-charcoal flex items-center justify-center p-6 text-white text-center">
        <div className="max-w-md">
          <AlertTriangle className="w-16 h-16 text-rose-500 mx-auto mb-6" />
          <h1 className="text-3xl font-black mb-4">Unauthorized</h1>
          <p className="text-white/60 font-medium leading-relaxed">
            This sector of the vault is restricted to administrators.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-charcoal pt-24 pb-32">
      <div className="max-w-4xl mx-auto px-6">
        <div className="flex items-center gap-4 mb-12">
          <div className="w-16 h-16 bg-emerald-accent rounded-[2rem] flex items-center justify-center shadow-lg shadow-emerald-accent/20">
            <Shield className="w-8 h-8 text-charcoal" />
          </div>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight">Admin Tools</h1>
            <p className="text-white/40 font-bold uppercase tracking-widest text-xs">
              {totalGamesCount !== null ? `${totalGamesCount.toLocaleString()} Games in Database` : 'Internal Database Operations'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8">
          {/* Audience Patch Card */}
          <div className="bg-white/5 border border-white/10 rounded-[3rem] p-12 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black text-white mb-2">Patch Audience IDs</h2>
                <p className="text-white/60 font-medium max-w-lg leading-relaxed">
                  Retroactively fixes `audienceIds` in the `activities` collection. 
                  <span className="text-emerald-accent"> Includes fixing missing actor IDs and repairing previous backfills.</span>
                </p>
              </div>
              <Shield className="w-12 h-12 text-emerald-accent/20" />
            </div>

            <div className="flex flex-col gap-6">
              <button
                onClick={runSelfInvitePatch}
                disabled={selfInvitePatchLoading}
                className="w-full flex items-center justify-center gap-3 bg-amber-500/20 border border-amber-500/30 text-amber-400 font-black py-6 rounded-2xl hover:bg-amber-500/30 hover:text-amber-300 transition-all disabled:opacity-50 group"
              >
                {selfInvitePatchLoading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Processing Self-Invites Updates...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-6 h-6" />
                    <span>Run Self-Invite Patch Script</span>
                  </>
                )}
              </button>

              <button
                onClick={runPlayIdBackfill}
                disabled={playBackfillLoading}
                className="w-full flex items-center justify-center gap-3 bg-blue-500/20 border border-blue-500/30 text-blue-400 font-black py-4 rounded-2xl hover:bg-blue-500/30 hover:text-blue-300 transition-all group disabled:opacity-50"
              >
                {playBackfillLoading ? 'Processing...' : 'Backfill Missing Play IDs'}
              </button>
              {playBackfillStatus.type && (
                <div className={`p-6 rounded-2xl font-bold flex items-center gap-4 ${
                  playBackfillStatus.type === 'success' 
                    ? 'bg-emerald-accent/10 border border-emerald-accent/20 text-emerald-accent' 
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-500'
                }`}>
                  {playBackfillStatus.message}
                </div>
              )}

              <button
                onClick={scanMissingPlayIds}
                className="w-full flex items-center justify-center gap-3 bg-fuchsia-500/20 border border-fuchsia-500/30 text-fuchsia-400 font-black py-4 rounded-2xl hover:bg-fuchsia-500/30 hover:text-fuchsia-300 transition-all group"
              >
                Scan Activities (Console Dump)
              </button>

              {selfInvitePatchStatus.type && (
                <div className={`p-6 rounded-2xl font-bold flex items-center gap-4 ${
                  selfInvitePatchStatus.type === 'success' 
                    ? 'bg-emerald-accent/10 border border-emerald-accent/20 text-emerald-accent' 
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-500'
                }`}>
                  {selfInvitePatchStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <Loader2 className="w-5 h-5 animate-spin" />}
                  {selfInvitePatchStatus.message}
                </div>
              )}
              <button
                onClick={runAudiencePatch}
                disabled={patchLoading}
                className="w-full flex items-center justify-center gap-3 bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-black py-6 rounded-2xl hover:bg-indigo-500/30 hover:text-indigo-300 transition-all disabled:opacity-50 group"
              >
                {patchLoading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Processing Audience Updates...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-6 h-6" />
                    <span>Run Audience Patch Script</span>
                  </>
                )}
              </button>

              {patchStatus.type && (
                <div className={`p-6 rounded-2xl font-bold flex items-center gap-4 ${
                  patchStatus.type === 'success' 
                    ? 'bg-emerald-accent/10 border border-emerald-accent/20 text-emerald-accent' 
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-500'
                }`}>
                  {patchStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <Loader2 className="w-5 h-5 animate-spin" />}
                  {patchStatus.message}
                </div>
              )}
            </div>
          </div>

          {/* Bulk Verify Card */}
          <div className="bg-white/5 border border-white/10 rounded-[3rem] p-12 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black text-white mb-2">Bulk Content Verification</h2>
                <p className="text-white/60 font-medium max-w-lg leading-relaxed">
                  Scans the entire game database and sets <code className="bg-white/10 px-2 py-0.5 rounded text-emerald-accent">isApproved: true</code> for all games that aren't already verified.
                </p>
              </div>
              <CheckCircle2 className="w-12 h-12 text-emerald-accent/20" />
            </div>

            <div className="flex flex-col gap-6">
              {loading && (
                <div className="w-full bg-white/5 rounded-full h-4 overflow-hidden border border-white/10">
                  <div 
                    className="h-full bg-emerald-accent transition-all duration-500 shadow-[0_0_15px_rgba(45,212,191,0.5)]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              )}

              <button
                onClick={bulkVerifyAllGames}
                disabled={loading}
                className="w-full flex items-center justify-center gap-3 bg-emerald-accent text-charcoal font-black py-6 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale group shadow-xl shadow-emerald-accent/20"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Processing Database Updates...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-6 h-6" />
                    <span>Run Bulk Verification Script</span>
                  </>
                )}
              </button>

              {status.type && (
                <div className={`p-6 rounded-2xl font-bold flex items-center gap-4 ${
                  status.type === 'success' 
                    ? 'bg-emerald-accent/10 border border-emerald-accent/20 text-emerald-accent' 
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-500'
                }`}>
                  {status.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  {status.message}
                </div>
              )}
            </div>
          </div>

          {/* Sync Metadata Card */}
          <div className="bg-white/5 border border-white/10 rounded-[3rem] p-12 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black text-white mb-2">Sync Collection Metadata</h2>
                <p className="text-white/60 font-medium max-w-lg leading-relaxed">
                  Denormalizes game metadata (categories, players, title) into user collection documents. 
                  <span className="text-emerald-accent"> Required for server-side filtering and searching of the collection.</span>
                </p>
              </div>
              <Shield className="w-12 h-12 text-gold-accent/20" />
            </div>

            <div className="flex flex-col gap-6">
              {syncLoading && (
                <div className="w-full bg-white/5 rounded-full h-4 overflow-hidden border border-white/10">
                  <div 
                    className="h-full bg-gold-accent transition-all duration-500 shadow-[0_0_15px_rgba(212,175,55,0.5)]"
                    style={{ width: `${syncProgress}%` }}
                  />
                </div>
              )}

              <button
                onClick={denormalizeCollectionMetadata}
                disabled={syncLoading}
                className="w-full flex items-center justify-center gap-3 bg-gold-accent text-charcoal font-black py-6 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:grayscale group shadow-xl shadow-gold-accent/20"
              >
                {syncLoading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Syncing Metadata...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-6 h-6" />
                    <span>Run Metadata Sync Script</span>
                  </>
                )}
              </button>

              {syncStatus.type && (
                <div className={`p-6 rounded-2xl font-bold flex items-center gap-4 ${
                  syncStatus.type === 'success' 
                    ? 'bg-emerald-accent/10 border border-emerald-accent/20 text-emerald-accent' 
                    : 'bg-rose-500/10 border border-rose-500/20 text-rose-500'
                }`}>
                  {syncStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                  {syncStatus.message}
                </div>
              )}
            </div>
          </div>

          {/* Cache Management Card */}
          <div className="bg-white/5 border border-white/10 rounded-[3rem] p-12 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black text-white mb-2">Cache Management</h2>
                <p className="text-white/60 font-medium max-w-lg leading-relaxed">
                  Clears locally cached recent games and discovery data. Use this if you see stale information after database updates.
                </p>
              </div>
              <Trash2 className="w-12 h-12 text-rose-500/20" />
            </div>

            <button
              onClick={() => {
                localStorage.removeItem('cachedRecentGames_v5');
                window.location.reload();
              }}
              className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-white font-black py-6 rounded-2xl hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-500 transition-all group"
            >
              <Trash2 className="w-6 h-6" />
              <span>Clear Local Data & Refresh</span>
            </button>
          </div>

          {/* Sync Global Metadata Card */}
          <div className="bg-white/5 border border-white/10 rounded-[3rem] p-12 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black text-white mb-2">Sync Global Search Metadata</h2>
                <p className="text-white/60 font-medium max-w-lg leading-relaxed">
                  Ensures all games in the master <code className="bg-white/10 px-2 py-0.5 rounded text-emerald-accent">Games</code> collection have the <code className="bg-white/10 px-2 py-0.5 rounded text-emerald-accent">name_lowercase</code> field required for high-performance searching.
                </p>
              </div>
              <Shield className="w-12 h-12 text-emerald-accent/20" />
            </div>

            <div className="flex flex-col gap-6">
              {globalSyncLoading && (
                <div className="w-full bg-white/5 rounded-full h-4 overflow-hidden border border-white/10">
                  <div 
                    className="h-full bg-emerald-accent transition-all duration-500 shadow-[0_0_15px_rgba(45,212,191,0.5)]"
                    style={{ width: `${globalSyncProgress}%` }}
                  />
                </div>
              )}

              <button
                onClick={syncGlobalGameSearchMetadata}
                disabled={globalSyncLoading}
                className="w-full flex items-center justify-center gap-3 bg-white/5 border border-white/10 text-white font-black py-6 rounded-2xl hover:bg-emerald-accent/10 hover:border-emerald-accent/30 hover:text-emerald-accent transition-all disabled:opacity-50 group"
              >
                {globalSyncLoading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Processing Search Tags...</span>
                  </>
                ) : (
                  <>
                    <Shield className="w-6 h-6" />
                    <span>Standardize Search Metadata</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Database Audit & Cleanup */}
          <div className="bg-white/5 border border-white/10 rounded-[3rem] p-12 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black text-white mb-2">Media Audit & Cleanup</h2>
                <p className="text-white/60 font-medium max-w-lg leading-relaxed">
                  Sweeps the database for non-board game media (Video Games, Films, TV) and missing metadata. Flagged items can then be purged or verified.
                </p>
              </div>
              <Search className="w-12 h-12 text-rose-500/20" />
            </div>

            <div className="flex flex-col gap-6">
              {auditLoading && (
                <div className="w-full bg-white/5 rounded-full h-4 overflow-hidden border border-white/10">
                  <div 
                    className="h-full bg-rose-500 transition-all duration-500 shadow-[0_0_15px_rgba(244,63,94,0.5)]"
                    style={{ width: `${auditProgress}%` }}
                  />
                </div>
              )}

              <button
                onClick={auditDatabaseForMedia}
                disabled={auditLoading}
                className="w-full flex items-center justify-center gap-3 bg-rose-500/10 border border-rose-500/30 text-rose-500 font-black py-6 rounded-2xl hover:bg-rose-500 hover:text-white transition-all disabled:opacity-50 group"
              >
                {auditLoading ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <span>Sweeping for Non-Board Game Media...</span>
                  </>
                ) : (
                  <>
                    <Eraser className="w-6 h-6" />
                    <span>Execute Global Audit Sweep</span>
                  </>
                )}
              </button>
            </div>

            {/* Audit Queue */}
            {(flaggedGames.length > 0 || fetchingFlagged) && (
              <div className="mt-12">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-black text-white flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-rose-500" />
                    Audit Queue ({flaggedGames.length})
                  </h3>
                  <button 
                    onClick={fetchFlaggedGames}
                    className="text-[10px] font-black text-white/40 uppercase tracking-widest hover:text-white transition-colors"
                  >
                    Refresh List
                  </button>
                </div>

                <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                  {fetchingFlagged ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="w-8 h-8 text-white/20 animate-spin" />
                    </div>
                  ) : (
                    flaggedGames.map(game => (
                      <div 
                        key={game.id} 
                        className="bg-white/5 border border-white/10 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/[0.07] transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h4 className="text-lg font-black text-white truncate">{game.title}</h4>
                            <span className="px-2 py-0.5 bg-rose-500/10 text-rose-500 text-[9px] font-black uppercase rounded-lg border border-rose-500/20">
                              {game.flagReason}
                            </span>
                          </div>
                          <p className="text-white/40 text-xs font-medium line-clamp-1">
                            {game.description || "No description provided."}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                          <button
                            onClick={() => keepGame(game.id)}
                            className="flex items-center gap-2 bg-emerald-accent/10 hover:bg-emerald-accent text-emerald-accent hover:text-charcoal px-4 py-2 rounded-xl text-xs font-black transition-all transition-colors active:scale-95"
                          >
                            <Check className="w-4 h-4" /> Keep
                          </button>
                          <button
                            onClick={() => purgeGame(game.id)}
                            className="flex items-center gap-2 bg-rose-500/10 hover:bg-rose-500 text-rose-500 hover:text-white px-4 py-2 rounded-xl text-xs font-black transition-all transition-colors active:scale-95"
                          >
                            <Trash2 className="w-4 h-4" /> Purge
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                  {hasMoreFlagged && !fetchingFlagged && (
                    <button
                      onClick={() => fetchFlaggedGames(false)}
                      className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-white/40 uppercase tracking-[0.2em] hover:bg-white/10 hover:text-white transition-all mt-4"
                    >
                      Load More Results
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Metadata Hydration Card */}
          <div className="bg-white/5 border border-white/10 rounded-[3rem] p-12 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-black text-white mb-2">Metadata Hydration</h2>
                <p className="text-white/60 font-medium max-w-lg leading-relaxed">
                  Fetches missing descriptions, player counts, and categories from Wikidata/Wikipedia for legacy entries. Processes in rate-limited chunks of 50.
                </p>
              </div>
              <RefreshCw className="w-12 h-12 text-emerald-accent/20" />
            </div>

            <div className="flex flex-col gap-6">
              <div className="flex items-center justify-between bg-white/5 rounded-2xl p-6 border border-white/10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-emerald-accent/10 flex items-center justify-center">
                    <ClockIcon className={cn("w-6 h-6 text-emerald-accent", hydrationLoading && "animate-spin")} />
                  </div>
                  <div>
                    <span className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Status</span>
                    <span className="text-sm font-bold text-white">{hydrationStatus}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="block text-[10px] font-black text-white/40 uppercase tracking-widest mb-1">Total Processed</span>
                  <span className="text-2xl font-black text-emerald-accent">{hydratedCount}</span>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                <button
                  onClick={processNextHydrationBatch}
                  disabled={hydrationLoading}
                  className="w-full flex items-center justify-center gap-3 bg-emerald-accent text-charcoal font-black py-6 rounded-2xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 group shadow-xl shadow-emerald-accent/20"
                >
                  {hydrationLoading ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      <span>Hydrating Batch...</span>
                    </>
                  ) : (
                    <>
                      <Database className="w-6 h-6" />
                      <span>Process Next 50 Games</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => {
                    localStorage.removeItem('hydrationBookmark');
                    setLastVisibleDoc(null);
                    setHydratedCount(0);
                    setHydrationStatus('Progress Reset. Starting from beginning.');
                  }}
                  disabled={hydrationLoading}
                  className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em] hover:text-white transition-colors py-2 mx-auto"
                >
                  Reset Progress
                </button>
              </div>
            </div>
          </div>

          <div className="bg-rose-500/10 border border-rose-500/20 rounded-[2rem] p-8">
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-rose-500 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-black text-rose-500 uppercase tracking-tight mb-1">Administrative Note</h3>
                <p className="text-rose-500/70 text-sm font-bold leading-relaxed">
                  Bulk operations are irrevocable. Ensure all imported data satisfies structural requirements before executing global verification scripts.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
