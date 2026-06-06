import React, { useState } from "react";
import { db } from "../lib/firebase";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  query,
  limit,
  startAfter,
  where,
  writeBatch,
  deleteField,
  serverTimestamp,
} from "firebase/firestore";
import { Database, Search } from "lucide-react";
import { cn } from "../lib/utils";
import { useUser } from "../contexts/UserContext";
import { Navigate } from "react-router-dom";

// Sub-component for individual item row isolation
const EditableRow = React.memo(function EditableRow({
  game,
  columns,
  onUpdateSuccess,
}: {
  game: Record<string, any>;
  columns: string[];
  onUpdateSuccess: (g: Record<string, any>) => void;
}) {
  const [draftState, setDraftState] = useState(game);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);

  const handleUpdate = async () => {
    setSavingId(draftState.id);
    try {
      const gameId = draftState.id;
      if (!gameId) {
        throw new Error("Missing gameId (document ID)");
      }

      const payload: Record<string, any> = {};
      const newDraftState: Record<string, any> = { ...draftState };
      columns.forEach((col) => {
        if (col === "id") return;
        let val = draftState[col];
        if (val === undefined || val === null || val === "") {
          payload[col] = deleteField();
          return;
        }

        if (typeof val === "string") {
          const trimmed = val.trim();
          if (["genres", "categories", "mechanics", "designers", "artists", "publishers"].includes(col)) {
            val = trimmed.split(',').map(item => item.trim()).filter(item => item !== "");
            newDraftState[col] = val;
          } else if (
            (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
            (trimmed.startsWith("[") && trimmed.endsWith("]"))
          ) {
            try {
              val = JSON.parse(trimmed);
              newDraftState[col] = val;
            } catch (e) {
              console.warn(`Failed to parse json for field ${col}`);
            }
          }
        }
        if (val !== undefined && val !== null && val !== "") {
          payload[col] = val;
        }
      });
      
      if (payload.title && typeof payload.title === "string") {
        payload.name_lowercase = payload.title.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      }
      
      payload.updatedAt = serverTimestamp();

      console.log("DEBUG - Update Payload:", payload);

      const ref = doc(db, "games", gameId);
      await updateDoc(ref, payload);

      setSavedId(gameId);
      setTimeout(() => setSavedId(null), 2000);
      onUpdateSuccess(newDraftState);
      alert("Game Updated Successfully!");
    } catch (error) {
      console.error("DEBUG - Firestore Write Failed:", error);
      alert("Error updating game: Check console.");
    } finally {
      setSavingId(null);
    }
  };

  const handleChange = (field: string, value: any) => {
    setDraftState((prev) => ({ ...prev, [field]: value }));
  };

  const renderCellInput = (col: string) => {
    if (col === "id") {
      return (
        <span
          className="text-white/50 font-mono text-xs max-w-[100px] overflow-hidden text-ellipsis block"
          title={draftState.id}
        >
          {draftState.id}
        </span>
      );
    }

    let val = draftState[col];
    const isBooleanCol = typeof val === "boolean" || col === "isExpansion" || col === "isDataComplete";

    // Convert undefined to empty string to keep inputs controlled
    if (val === undefined || val === null) {
      val = isBooleanCol ? false : "";
    }

    if (isBooleanCol) {
      return (
        <input
          type="checkbox"
          checked={Boolean(val)}
          onChange={(e) => handleChange(col, e.target.checked)}
          className="w-4 h-4 rounded bg-black/20 border-white/20 text-indigo-500 focus:ring-indigo-500 mx-auto block"
        />
      );
    }

    if (typeof val === "number") {
      return (
        <input
          type="number"
          value={val}
          onChange={(e) => handleChange(col, Number(e.target.value))}
          className="bg-black/20 border border-white/10 rounded px-2 py-1 w-full max-w-[100px] text-white focus:border-indigo-500 focus:outline-none"
        />
      );
    }

    const isJsonLike =
      typeof val === "string" &&
      (val.trim().startsWith("{") || val.trim().startsWith("["));

    if (isJsonLike || (typeof val === "string" && val.includes("\n"))) {
      return (
        <textarea
          value={val}
          onChange={(e) => handleChange(col, e.target.value)}
          className="bg-black/20 border border-white/10 rounded px-2 py-1 w-full min-w-[200px] text-white focus:border-indigo-500 focus:outline-none font-mono text-xs"
          rows={3}
        />
      );
    }

    return (
      <input
        type="text"
        value={val}
        onChange={(e) => handleChange(col, e.target.value)}
        className="bg-black/20 border border-white/10 rounded px-2 py-1 w-full min-w-[150px] text-white focus:border-indigo-500 focus:outline-none"
      />
    );
  };

  return (
    <tr className="border-b border-white/5 hover:bg-white/5 transition-colors">
      {columns.map((col) => (
        <td key={col} className="p-4 align-top">
          {renderCellInput(col)}
        </td>
      ))}
      <td className="p-4 text-right align-top">
        <button
          onClick={handleUpdate}
          disabled={savingId === draftState.id}
          className={cn(
            "px-4 py-1.5 rounded font-bold text-sm transition-colors",
            savedId === draftState.id
              ? "bg-emerald-500 text-white"
              : savingId === draftState.id
                ? "bg-white/10 text-white/40"
                : "bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500 hover:text-white",
          )}
        >
          {savedId === draftState.id
            ? "Saved!"
            : savingId === draftState.id
              ? "..."
              : "Update"}
        </button>
      </td>
    </tr>
  );
});

export default function AdminDashboard() {
  const { user } = useUser();
  const [games, setGames] = useState<Record<string, any>[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [fetching, setFetching] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [lastVisible, setLastVisible] = useState<any>(null);
  const [hideCompleted, setHideCompleted] = useState(true);

  // Very basic authorization. In a real app we'd check claims.
  if (!user) {
    return <Navigate to="/auth" />;
  }

  const loadData = async (isNext = false) => {
    setFetching(true);
    try {
      let q = hideCompleted
        ? query(
            collection(db, "games"),
            where("isDataComplete", "==", false),
            limit(50),
          )
        : query(collection(db, "games"), limit(50));

      if (isNext && lastVisible) {
        q = hideCompleted
          ? query(
              collection(db, "games"),
              where("isDataComplete", "==", false),
              startAfter(lastVisible),
              limit(50),
            )
          : query(collection(db, "games"), startAfter(lastVisible), limit(50));
      }
      const snap = await getDocs(q);

      if (snap.empty) {
        setFetching(false);
        return;
      }

      setLastVisible(snap.docs[snap.docs.length - 1]);

      const allKeys = new Set<string>(columns);
      snap.docs.forEach((d) => {
        Object.keys(d.data()).forEach((k) => {
          if (k !== "id") allKeys.add(k);
        });
      });
      allKeys.add("isDataComplete");
      allKeys.add("isExpansion");
      allKeys.add("baseGameId");

      const excludeCols = new Set([
        "trending", "series", "bannerStyles", "processedAt", "flagReason", 
        "wikidataId", "website", "status", "url", "updatedAt", "numRatings"
      ]);

      const filteredKeys = Array.from(allKeys).filter(
        (k) => k !== "id" && k !== "title" && !excludeCols.has(k)
      );
      const columnsArray = [
        "id",
        "title",
        ...filteredKeys,
      ];
      setColumns(columnsArray);

      const data = snap.docs.map((d) => {
        const raw = d.data();
        const row: Record<string, any> = { id: d.id };
        columnsArray.forEach((k) => {
          if (k === "id") return;
          const val = raw[k];
          if (val !== null && typeof val === "object") {
            if (val.toDate) {
              row[k] = val.toDate().toISOString();
            } else if (Array.isArray(val) && ["genres", "categories", "mechanics", "designers", "artists", "publishers"].includes(k)) {
              row[k] = val.join(', ');
            } else {
              row[k] = JSON.stringify(val, null, 2);
            }
          } else if (k === "isDataComplete" && val === undefined) {
            row[k] = false;
          } else if (val === undefined) {
            row[k] = "";
          } else {
            row[k] = val;
          }
        });
        return row;
      });

      if (isNext) {
        setGames((prev) => [...prev, ...data]);
      } else {
        setGames(data);
      }
    } catch (error) {
      console.error("Error fetching games", error);
      alert("Error fetching games");
    } finally {
      setFetching(false);
    }
  };

  const fetchGames = async () => {
    await loadData(false);
  };

  const fetchMoreGames = async () => {
    await loadData(true);
  };

  const handleRowUpdate = (updatedRow: Record<string, any>) => {
    if (hideCompleted && updatedRow.isDataComplete === true) {
      setGames((prev) => prev.filter((g) => g.id !== updatedRow.id));
    } else {
      setGames((prev) =>
        prev.map((g) => (g.id === updatedRow.id ? updatedRow : g)),
      );
    }
  };

  const filteredGames = games.filter(
    (g) =>
      (g.title || "")
        .toString()
        .toLowerCase()
        .includes(searchFilter.toLowerCase()) ||
      (g.id || "")
        .toString()
        .toLowerCase()
        .includes(searchFilter.toLowerCase()),
  );

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-black text-white tracking-tight">
            Admin CMS
          </h1>
          <p className="text-white/60 mt-2">
            Manual game database overrides. Caution: Live Data.
          </p>
        </div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-white cursor-pointer select-none font-medium">
            <input
              type="checkbox"
              checked={hideCompleted}
              onChange={(e) => setHideCompleted(e.target.checked)}
              className="w-5 h-5 rounded bg-black/20 border-white/20 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-gray-900 cursor-pointer"
            />
            Hide Completed Games
          </label>
          <button
            onClick={fetchGames}
            disabled={fetching}
            className="flex items-center gap-2 bg-indigo-500 hover:bg-indigo-600 px-6 py-3 rounded-xl font-bold transition-colors disabled:opacity-50"
          >
            <Database className="w-5 h-5" />
            {fetching ? "Fetching..." : "Fetch Database"}
          </button>
        </div>
      </div>

      {games.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 overflow-hidden flex flex-col h-[70vh]">
          <div className="relative mb-6">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filter by title locally..."
              className="w-full bg-black/20 border border-white/10 rounded-xl py-3 pl-12 pr-4 text-white placeholder-white/40 focus:outline-none focus:border-indigo-500 transition-colors"
            />
          </div>

          <div className="overflow-auto flex-1 border border-white/10 rounded-xl relative">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-black/40 sticky top-0 z-10 backdrop-blur-md">
                <tr>
                  {columns.map((col) => (
                    <th
                      key={col}
                      className="p-4 font-bold text-white border-b border-white/10 capitalize"
                    >
                      {col}
                    </th>
                  ))}
                  <th className="p-4 font-bold text-white border-b border-white/10 w-32 text-right">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredGames.map((game) => (
                  <EditableRow
                    key={game.id}
                    game={game}
                    columns={columns}
                    onUpdateSuccess={handleRowUpdate}
                  />
                ))}
              </tbody>
            </table>

            {filteredGames.length === 0 && (
              <div className="p-8 text-center text-white/40">
                No games found matching filter.
              </div>
            )}
          </div>

          {lastVisible && (
            <div className="mt-4 flex justify-center">
              <button
                onClick={fetchMoreGames}
                disabled={fetching}
                className="bg-white/10 hover:bg-white/20 text-white px-6 py-2 rounded-lg font-bold transition-colors disabled:opacity-50"
              >
                {fetching ? "..." : "Load Next 50"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
