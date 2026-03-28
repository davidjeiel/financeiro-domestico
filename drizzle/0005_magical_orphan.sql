CREATE TABLE `installmentTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`installmentId` int NOT NULL,
	`transactionId` int,
	`installmentNumber` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`dueDate` date NOT NULL,
	`paidDate` date,
	`status` enum('pending','paid','overdue') NOT NULL DEFAULT 'pending',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `installmentTransactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `installments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`description` varchar(255) NOT NULL,
	`totalAmount` decimal(12,2) NOT NULL,
	`installmentAmount` decimal(12,2) NOT NULL,
	`totalInstallments` int NOT NULL,
	`currentInstallment` int NOT NULL DEFAULT 1,
	`type` enum('expense','credit_card') NOT NULL,
	`category` varchar(100),
	`startDate` date NOT NULL,
	`creditCardId` int,
	`isActive` int NOT NULL DEFAULT 1,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `installments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `recurringTransactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`description` varchar(255) NOT NULL,
	`type` enum('income','expense') NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`category` varchar(100),
	`frequency` enum('daily','weekly','biweekly','monthly','quarterly','yearly') NOT NULL,
	`startDate` date NOT NULL,
	`endDate` date,
	`accountId` int,
	`creditCardId` int,
	`isActive` int NOT NULL DEFAULT 1,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `recurringTransactions_id` PRIMARY KEY(`id`)
);
