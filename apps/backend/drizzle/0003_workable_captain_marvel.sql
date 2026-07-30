CREATE TABLE `public_match_lobby` (
	`match_id` text PRIMARY KEY NOT NULL,
	`owner_player_id` text NOT NULL,
	`owner_faction` text NOT NULL,
	`created_at` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `public_match_lobby_expires_created_idx` ON `public_match_lobby` (`expires_at`,`created_at`);