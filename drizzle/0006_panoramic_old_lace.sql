ALTER TABLE `transactions` ADD `isPaid` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `transactions` ADD `paidDate` timestamp;