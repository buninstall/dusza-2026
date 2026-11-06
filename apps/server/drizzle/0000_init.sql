CREATE TABLE `map_versions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`map_id` integer NOT NULL,
	`version` integer NOT NULL,
	`content` text NOT NULL,
	`content_hash` text NOT NULL,
	`rows` integer NOT NULL,
	`cols` integer NOT NULL,
	`gold_total` integer NOT NULL,
	`reachable_gold` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `map_versions_map_version_idx` ON `map_versions` (`map_id`,`version`);
CREATE TABLE `maps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`current_version_id` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `maps_owner_idx` ON `maps` (`owner_id`);
CREATE TABLE `programs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`owner_id` integer NOT NULL,
	`title` text NOT NULL,
	`source` text NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `programs_owner_idx` ON `programs` (`owner_id`);
CREATE TABLE `runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` integer NOT NULL,
	`map_version_id` integer NOT NULL,
	`source` text NOT NULL,
	`source_hash` text NOT NULL,
	`gold` integer NOT NULL,
	`steps` integer NOT NULL,
	`outcome_kind` text NOT NULL,
	`error_code` text,
	`error_line` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`map_version_id`) REFERENCES `map_versions`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `runs_leaderboard_idx` ON `runs` (`map_version_id`,"gold" DESC,"steps" ASC,"created_at" ASC);
CREATE INDEX `runs_user_idx` ON `runs` (`user_id`);
CREATE TABLE `sessions` (
	`id_hash` text PRIMARY KEY NOT NULL,
	`user_id` integer NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer NOT NULL
);

CREATE UNIQUE INDEX `users_username_unique` ON `users` (`username`);