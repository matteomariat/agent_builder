-- Add sub_agent_ids to master_agents (JSON array of agent IDs)
ALTER TABLE `master_agents` ADD COLUMN `sub_agent_ids` text;
