export const PLAY_MODES = ["sandbox", "story"] as const;

export type PlayMode = (typeof PLAY_MODES)[number];
