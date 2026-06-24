ALTER TABLE `typologies` ADD `sortOrder` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `typologies` ADD `parentId` int;--> statement-breakpoint
ALTER TABLE `typologies` ADD `links` text;--> statement-breakpoint
ALTER TABLE `typologies` DROP COLUMN `order`;