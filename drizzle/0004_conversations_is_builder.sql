-- Add is_builder column to conversations (for AI Builder dedicated conversation)
ALTER TABLE `conversations` ADD COLUMN `is_builder` integer NOT NULL DEFAULT 0;
