-- Separate curriculum level (IG / AS / A Level / IB / AP) from subject, and
-- add the resource-type facet (notes / practice / past papers).
ALTER TABLE repos ADD COLUMN level_id TEXT NOT NULL DEFAULT 'other';
ALTER TABLE repos ADD COLUMN resource_type TEXT NOT NULL DEFAULT 'other';

CREATE INDEX IF NOT EXISTS idx_repos_level ON repos(level_id);
CREATE INDEX IF NOT EXISTS idx_repos_resource_type ON repos(resource_type);
