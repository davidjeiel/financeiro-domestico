CREATE TABLE `savedFilters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`startDate` date,
	`endDate` date,
	`categories` text,
	`types` text,
	`minAmount` decimal(12,2),
	`maxAmount` decimal(12,2),
	`isDefault` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `savedFilters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `competencyStartDay` int DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `competencyEndDay` int DEFAULT 0 NOT NULL;