CREATE TABLE `builder_config` (
	`user_id` text PRIMARY KEY NOT NULL,
	`system_prompt` text,
	`model` text,
	`max_steps` integer,
	`thinking_enabled` integer,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
