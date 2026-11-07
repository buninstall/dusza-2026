export const PLAY_MODES = ["sandbox", "story"] as const;

export type PlayMode = (typeof PLAY_MODES)[number];

export const DIFFICULTY_FILTERS = ["all", "easy", "medium", "hard"] as const;

export type DifficultyFilter = (typeof DIFFICULTY_FILTERS)[number];

export const SANDBOX_PAGE = 8;
