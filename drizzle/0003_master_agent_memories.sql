CREATE TABLE `master_agent_memories` (
	`id` text PRIMARY KEY NOT NULL,
	`master_agent_id` text,
	`content` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`master_agent_id`) REFERENCES `master_agents`(`id`) ON UPDATE no action ON DELETE no action
);
