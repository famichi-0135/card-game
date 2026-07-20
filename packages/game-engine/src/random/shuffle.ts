import type { RandomSequence } from "../contracts/game-state.js";

export function shuffle<T>(items: readonly T[], random: RandomSequence): T[] {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomValue = nextRandomValue(random);
    const swapIndex = Math.floor(randomValue * (index + 1));
    const current = shuffled[index];
    shuffled[index] = shuffled[swapIndex] as T;
    shuffled[swapIndex] = current as T;
  }

  return shuffled;
}

export function nextRandomValue(random: RandomSequence): number {
  const value = random.next();
  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new RangeError(
      "乱数生成器は0以上1未満の有限数を返す必要があります。",
    );
  }
  return value;
}
