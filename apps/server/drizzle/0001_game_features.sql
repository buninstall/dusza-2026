ALTER TABLE `maps` ADD `par_steps` int;
ALTER TABLE `maps` ADD `daily_date` char(10);
ALTER TABLE `maps` ADD CONSTRAINT `maps_daily_date_idx` UNIQUE(`daily_date`);