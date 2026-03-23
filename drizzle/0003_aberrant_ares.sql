ALTER TABLE `users` ADD `googleSheetsAccessToken` text;--> statement-breakpoint
ALTER TABLE `users` ADD `googleSheetsRefreshToken` text;--> statement-breakpoint
ALTER TABLE `users` ADD `googleSheetsConnected` int DEFAULT 0 NOT NULL;