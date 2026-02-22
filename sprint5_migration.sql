-- Sprint 5 Migration: Intelligence + Automation Engine
-- Run this manually in Supabase SQL Editor BEFORE deploying
-- ============================================

-- 1. Add auto_mode to campaigns table
ALTER TABLE campaigns
ADD COLUMN IF NOT EXISTS auto_mode TEXT NOT NULL DEFAULT 'off';

-- 2. Add pillar, archetype, scored_at to content table
ALTER TABLE content
ADD COLUMN IF NOT EXISTS pillar TEXT,
ADD COLUMN IF NOT EXISTS archetype TEXT,
ADD COLUMN IF NOT EXISTS scored_at TIMESTAMPTZ;

-- 3. Create recommendations table
CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  reasoning TEXT NOT NULL,
  action_data JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending',
  outcome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Create index on recommendations for common queries
CREATE INDEX IF NOT EXISTS idx_recommendations_campaign_id ON recommendations(campaign_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_status ON recommendations(status);
CREATE INDEX IF NOT EXISTS idx_recommendations_type ON recommendations(type);

-- 5. Create indexes on content for new fields
CREATE INDEX IF NOT EXISTS idx_content_pillar ON content(pillar);
CREATE INDEX IF NOT EXISTS idx_content_archetype ON content(archetype);
CREATE INDEX IF NOT EXISTS idx_content_performance_score ON content(performance_score);

-- 6. Create index on campaigns auto_mode
CREATE INDEX IF NOT EXISTS idx_campaigns_auto_mode ON campaigns(auto_mode);
