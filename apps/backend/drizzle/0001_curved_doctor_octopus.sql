CREATE TABLE `player_identity` (
	`player_id` text PRIMARY KEY NOT NULL,
	`auth_user_id` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `player_identity_auth_user_id_unique` ON `player_identity` (`auth_user_id`);
--> statement-breakpoint
INSERT INTO `player_identity` (`player_id`, `auth_user_id`)
SELECT `id`, `id` FROM `user`;
