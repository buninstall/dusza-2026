CREATE TABLE `map_likes` (
	`user_id` int NOT NULL,
	`map_id` int NOT NULL,
	`created_at` bigint NOT NULL,
	CONSTRAINT `map_likes_user_id_map_id_pk` PRIMARY KEY(`user_id`,`map_id`)
);

ALTER TABLE `maps` ADD `par_steps` int;
ALTER TABLE `maps` ADD `daily_date` char(10);
ALTER TABLE `maps` ADD CONSTRAINT `maps_daily_date_idx` UNIQUE(`daily_date`);
ALTER TABLE `map_likes` ADD CONSTRAINT `map_likes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `map_likes` ADD CONSTRAINT `map_likes_map_id_maps_id_fk` FOREIGN KEY (`map_id`) REFERENCES `maps`(`id`) ON DELETE cascade ON UPDATE no action;
CREATE INDEX `map_likes_map_idx` ON `map_likes` (`map_id`);