CREATE TABLE `accounts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`type` enum('checking','savings','investment') NOT NULL DEFAULT 'checking',
	`balance` decimal(12,2) NOT NULL DEFAULT '0',
	`initialBalance` decimal(12,2) NOT NULL DEFAULT '0',
	`color` varchar(7) DEFAULT '#3B82F6',
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`)
);
