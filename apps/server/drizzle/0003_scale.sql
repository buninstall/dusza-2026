CREATE TABLE `map_favorites` (
	`user_id` int NOT NULL,
	`map_id` int NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `map_favorites_user_id_map_id_pk` PRIMARY KEY(`user_id`,`map_id`)
);

ALTER TABLE `map_versions` ADD `difficulty` enum('easy','medium','hard','none');
ALTER TABLE `maps` ADD `favorite_count` int DEFAULT 0 NOT NULL;
ALTER TABLE `map_favorites` ADD CONSTRAINT `map_favorites_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `map_favorites` ADD CONSTRAINT `map_favorites_map_id_maps_id_fk` FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON DELETE cascade ON UPDATE no action;
CREATE INDEX `map_favorites_map_idx` ON `map_favorites` (`map_id`);
CREATE INDEX `map_favorites_user_created_idx` ON `map_favorites` (`user_id`,`created_at`);
CREATE INDEX `map_versions_hash_idx` ON `map_versions` (`content_hash`);
CREATE INDEX `maps_created_idx` ON `maps` (`created_at`,`id`);
CREATE INDEX `maps_updated_idx` ON `maps` (`updated_at`,`id`);
CREATE INDEX `maps_favorite_idx` ON `maps` (`favorite_count`,`id`);
CREATE INDEX `programs_owner_updated_idx` ON `programs` (`owner_id`,`updated_at`);
CREATE INDEX `runs_user_created_idx` ON `runs` (`user_id`,`created_at`);
CREATE INDEX `runs_user_version_idx` ON `runs` (`user_id`,`map_version_id`);
DROP INDEX `programs_owner_idx` ON `programs`;
DROP INDEX `runs_user_idx` ON `runs`;
