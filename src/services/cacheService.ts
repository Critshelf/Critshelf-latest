import { Game } from '../types';

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

class CacheService {
  private games = new Map<string, CacheEntry<Game>>();

  setGame(game: Game) {
    this.games.set(game.id, {
      data: game,
      timestamp: Date.now()
    });
  }

  getGame(id: string): Game | null {
    const entry = this.games.get(id);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > CACHE_DURATION) {
      this.games.delete(id);
      return null;
    }

    return entry.data;
  }

  clear() {
    this.games.clear();
  }
}

export const cacheService = new CacheService();
