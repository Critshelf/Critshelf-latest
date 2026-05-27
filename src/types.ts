export interface Game {
  id: string;
  title: string;
  name_lowercase?: string;
  description?: string;
  coverImage?: string;
  thumbnail?: string;
  bannerImage?: string;
  hasHighResArt?: boolean;
  customImageApproved?: boolean;
  isArtApproved?: boolean;
  minPlayers?: number;
  maxPlayers?: number;
  playTime?: string;
  minAge?: number;
  categories?: string[];
  genres?: string[];
  mechanics?: string[];
  designers?: string[];
  artists?: string[];
  publishers?: string[];
  publishingYear?: number;
  bggId?: string;
  wikidataId?: string;
  isApproved?: boolean;
  isExpansion?: boolean;
  baseGameId?: string;
  status?: 'pending' | 'published' | 'rejected';
  createdAt?: any;
  updatedAt?: any;
}

export interface Review {
  id: string;
  gameId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  score: number;
  text?: string;
  createdAt: any;
  attackClass?: number;
}

export interface CollectionItem {
  id: string;
  userId: string;
  gameId: string;
  gameTitle: string;
  gameCover: string;
  shelf: 'owned' | 'wishlist';
  addedAt: any;
}
