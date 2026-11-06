CREATE TABLE `map_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`map_id` int NOT NULL,
	`version` int NOT NULL,
	`content` text NOT NULL,
	`content_hash` char(64) NOT NULL,
	`rows` int NOT NULL,
	`cols` int NOT NULL,
	`gold_total` int NOT NULL,
	`reachable_gold` int NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `map_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `map_versions_map_version_idx` UNIQUE(`map_id`,`version`)
);

CREATE TABLE `maps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_id` int NOT NULL,
	`title` varchar(80) NOT NULL,
	`description` varchar(500) NOT NULL DEFAULT '',
	`visibility` enum('public','private') NOT NULL DEFAULT 'public',
	`current_version_id` int,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `maps_id` PRIMARY KEY(`id`)
);

CREATE TABLE `programs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`owner_id` int NOT NULL,
	`title` varchar(80) NOT NULL,
	`source` mediumtext NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `programs_id` PRIMARY KEY(`id`)
);

CREATE TABLE `runs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`map_version_id` int NOT NULL,
	`source` mediumtext NOT NULL,
	`source_hash` char(64) NOT NULL,
	`gold` int NOT NULL,
	`steps` int NOT NULL,
	`outcome_kind` enum('ok','runtimeError') NOT NULL,
	`error_code` varchar(64),
	`error_line` int,
	`created_at` bigint NOT NULL,
	CONSTRAINT `runs_id` PRIMARY KEY(`id`)
);

CREATE TABLE `sessions` (
	`id_hash` char(64) NOT NULL,
	`user_id` int NOT NULL,
	`expires_at` bigint NOT NULL,
	CONSTRAINT `sessions_id_hash` PRIMARY KEY(`id_hash`)
);

CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`username` varchar(24) collate utf8mb4_0900_ai_ci NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`role` enum('admin','user') NOT NULL DEFAULT 'user',
	`created_at` bigint NOT NULL,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);

ALTER TABLE `map_versions` ADD CONSTRAINT `map_versions_map_id_maps_id_fk` FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `maps` ADD CONSTRAINT `maps_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `programs` ADD CONSTRAINT `programs_owner_id_users_id_fk` FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `runs` ADD CONSTRAINT `runs_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `runs` ADD CONSTRAINT `runs_map_version_id_map_versions_id_fk` FOREIGN KEY (`map_version_id`) REFERENCES `map_versions`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
CREATE INDEX `maps_owner_idx` ON `maps` (`owner_id`);
CREATE INDEX `programs_owner_idx` ON `programs` (`owner_id`);
CREATE INDEX `runs_leaderboard_idx` ON `runs` (`map_version_id`,`gold` desc,`steps`,`created_at`);
CREATE INDEX `runs_user_idx` ON `runs` (`user_id`);
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);