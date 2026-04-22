/**
 * Difficulty Class (DC) System Utilities
 */

/**
 * Calculates the baseline DC based on game metadata.
 * Formula: DC_Base = (Age/14 * 8) + (Minutes/180 * 12)
 * Constraints: Cap Age at 14 and Minutes at 180.
 */
export function calculateBaseDC(game: any): number {
  // 1. Fix Data Mapping & Parsing
  // We check for multiple possible property names from the database
  const rawAge = game.minAge ?? game.ageRange ?? game.Age;
  const rawTime = game.playTime ?? game.playingTime ?? game.Minutes;

  // Helper to extract a clean number from potential strings or numbers
  const parseToNumber = (val: any): number => {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
      const match = val.match(/\d+/);
      return match ? parseInt(match[0], 10) : 0;
    }
    return 0;
  };

  const age = parseToNumber(rawAge);
  const time = parseToNumber(rawTime);

  // 2. Add Safe Fallbacks
  const safeAge = age || 10;
  const safeTime = time || 45;

  // 3. Apply the Caps Correctly
  const cappedAge = Math.min(safeAge, 14);
  const cappedTime = Math.min(safeTime, 180);

  // 4. Formula: ((cappedAge / 14) * 8) + ((cappedTime / 180) * 12)
  const dcBase = ((cappedAge / 14) * 8) + ((cappedTime / 180) * 12);
  
  return Math.round(dcBase);
}

/**
 * Calculates the final community-weighted DC.
 * Formula: DC_Final = round((DC_Base * 5 + Sum(User Difficulty Ratings)) / (5 + Total User Ratings))
 */
export function calculateFinalDC(baseDC: number, userRatings: number[]): number {
  const totalUserRatings = userRatings.length;
  const sumUserRatings = userRatings.reduce((acc, val) => acc + val, 0);
  
  const dcFinal = (baseDC * 5 + sumUserRatings) / (5 + totalUserRatings);
  return Math.round(dcFinal);
}
