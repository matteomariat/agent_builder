CREATE TABLE `master_agents` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`system_prompt` text NOT NULL,
	`model` text,
	`max_steps` integer,
	`thinking_enabled` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `master_agents` (`id`, `user_id`, `name`, `system_prompt`, `model`, `max_steps`, `thinking_enabled`, `updated_at`)
SELECT 'migrated-' || `user_id`, `user_id`, 'Default', `system_prompt`, `model`, `max_steps`, `thinking_enabled`, `updated_at` FROM `master_config`;
--> statement-breakpoint
ALTER TABLE `conversations` ADD COLUMN `master_agent_id` text;
--> statement-breakpoint
UPDATE `conversations` SET `master_agent_id` = 'migrated-' || `user_id` WHERE `user_id` IN (SELECT `user_id` FROM `master_agents`);
--> statement-breakpoint
DROP TABLE `master_config`;
