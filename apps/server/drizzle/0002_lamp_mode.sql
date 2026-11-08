ALTER TABLE `maps` ADD `lamp_mode` enum('open','lamp','dark') DEFAULT 'open' NOT NULL;
UPDATE `maps` SET `lamp_mode` = 'lamp' WHERE `daily_date` IS NULL AND `title` IN ('5. Kígyó', '6. Elérhetetlen kincs');
UPDATE `maps` SET `lamp_mode` = 'dark' WHERE `daily_date` IS NULL AND `title` IN ('7. Aranymező', '8. A nagy bánya');
