/**
 * Experience calculation utilities
 */
export function calculateExperienceForLevel(
  level: number,
  baseExp: number,
  expMultiplier: number
): number {
  if (level <= 1) {
    return 0;
  }
  return Math.floor(baseExp * Math.pow(expMultiplier, level - 2));
}

export function calculateTotalExperienceForLevel(
  level: number,
  baseExp: number,
  expMultiplier: number
): number {
  let totalExp = 0;
  for (let i = 2; i <= level; i++) {
    totalExp += calculateExperienceForLevel(i, baseExp, expMultiplier);
  }
  return totalExp;
}

export function getLevelFromExperience(
  totalExperience: number,
  baseExp: number,
  expMultiplier: number
): number {
  let level = 1;
  let expNeeded = 0;
  while (expNeeded <= totalExperience) {
    level++;
    expNeeded += calculateExperienceForLevel(level, baseExp, expMultiplier);
    if (expNeeded > totalExperience) {
      return level - 1;
    }
  }
  return level;
}

