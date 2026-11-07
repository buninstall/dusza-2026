export const PLAY_MODES = ["sandbox", "story"] as const;

export type PlayMode = (typeof PLAY_MODES)[number];

export const DIFFICULTY_FILTERS = ["all", "easy", "medium", "hard"] as const;

export type DifficultyFilter = (typeof DIFFICULTY_FILTERS)[number];

export const MAP_SCOPES = ["all", "mine", "favorites"] as const;

export const SEARCH_MAX = 80;
