-- Adds a state column to programs and fills it for the sample schools.
-- Run in the Neon SQL Editor on the main branch (and on the preview branch if it already exists).
ALTER TABLE programs ADD COLUMN IF NOT EXISTS state TEXT;
UPDATE programs SET state = 'FL' WHERE is_sample AND city IN ('Tampa', 'Orlando') AND state IS NULL;
