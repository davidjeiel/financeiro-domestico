CREATE TABLE `typologies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`type` enum('income','expense','credit_card') NOT NULL,
	`description` text,
	`icon` varchar(50),
	`color` varchar(7) DEFAULT '#3B82F6',
	`isActive` int NOT NULL DEFAULT 1,
	`order` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `typologies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `invoices` MODIFY COLUMN `paidAmount` decimal(12,2) DEFAULT '0';