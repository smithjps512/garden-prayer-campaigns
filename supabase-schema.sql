-- Campaign Engine Database Schema
-- Run this in Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE playbook_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE campaign_status AS ENUM ('draft', 'review', 'approved', 'setup', 'live', 'paused', 'completed', 'failed');
CREATE TYPE image_type AS ENUM ('product', 'generic', 'video_thumbnail');
CREATE TYPE image_request_status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE content_type AS ENUM ('ad', 'organic_post', 'story');
CREATE TYPE content_status AS ENUM ('generated', 'approved', 'scheduled', 'posted', 'paused', 'retired');
CREATE TYPE platform AS ENUM ('facebook', 'instagram', 'twitter');
CREATE TYPE post_status AS ENUM ('scheduled', 'posted', 'failed', 'deleted');
CREATE TYPE conversion_type AS ENUM ('click', 'signup', 'trial', 'purchase');
CREATE TYPE task_assignee AS ENUM ('human', 'system');
CREATE TYPE task_status AS ENUM ('pending', 'in_progress', 'completed', 'blocked');
CREATE TYPE escalation_type AS ENUM ('below_threshold', 'persistent_failure', 'budget_depleted', 'anomaly_detected', 'strategic_question');
CREATE TYPE escalation_severity AS ENUM ('info', 'warning', 'critical');
CREATE TYPE escalation_status AS ENUM ('open', 'acknowledged', 'resolved', 'dismissed');
CREATE TYPE actor_type AS ENUM ('human', 'system');

-- ============================================
-- USERS (for authentication)
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- BUSINESSES
-- ============================================

CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    website_url VARCHAR(500),
    brand_colors JSONB,
    meta_page_id VARCHAR(100),
    meta_ig_id VARCHAR(100),
    meta_ad_account VARCHAR(100),
    pixel_id VARCHAR(100),
    settings JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- PLAYBOOKS
-- ============================================

CREATE TABLE playbooks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    version INTEGER DEFAULT 1,
    status playbook_status DEFAULT 'draft',
    positioning TEXT,
    founder_story TEXT,
    audiences JSONB,
    key_messages JSONB,
    objection_handlers JSONB,
    hooks JSONB,
    visual_direction JSONB,
    content JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_playbooks_business_id ON playbooks(business_id);

-- ============================================
-- CAMPAIGNS
-- ============================================

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    playbook_id UUID NOT NULL REFERENCES playbooks(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    status campaign_status DEFAULT 'draft',
    target_audience VARCHAR(100),
    target_markets JSONB,
    channels JSONB,
    budget_daily DECIMAL(10, 2),
    budget_total DECIMAL(10, 2),
    start_date DATE,
    end_date DATE,
    success_metrics JSONB,
    performance_thresholds JSONB,
    auto_optimize BOOLEAN DEFAULT TRUE,
    human_tasks JSONB,
    ai_tasks JSONB,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_campaigns_playbook_id ON campaigns(playbook_id);

-- ============================================
-- IMAGES
-- ============================================

CREATE TABLE images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    storage_url VARCHAR(500) NOT NULL,
    thumbnail_url VARCHAR(500),
    type image_type DEFAULT 'generic',
    category VARCHAR(100),
    tags JSONB,
    alt_text VARCHAR(500),
    width INTEGER,
    height INTEGER,
    file_size INTEGER,
    mime_type VARCHAR(100),
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_images_business_id ON images(business_id);

-- ============================================
-- IMAGE REQUESTS
-- ============================================

CREATE TABLE image_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    status image_request_status DEFAULT 'pending',
    description TEXT,
    suggested_prompt TEXT,
    suggested_tags JSONB,
    priority INTEGER DEFAULT 5,
    fulfilled_by UUID REFERENCES images(id) ON DELETE SET NULL,
    requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_image_requests_business_id ON image_requests(business_id);
CREATE INDEX idx_image_requests_campaign_id ON image_requests(campaign_id);

-- ============================================
-- CONTENT
-- ============================================

CREATE TABLE content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    type content_type DEFAULT 'organic_post',
    status content_status DEFAULT 'generated',
    headline VARCHAR(255),
    body TEXT,
    cta_text VARCHAR(100),
    cta_url VARCHAR(500),
    utm_params JSONB,
    image_id UUID REFERENCES images(id) ON DELETE SET NULL,
    platform_variants JSONB,
    hook_source VARCHAR(255),
    audience_segment VARCHAR(100),
    generation_metadata JSONB,
    performance_score DECIMAL(5, 2),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_content_campaign_id ON content(campaign_id);
CREATE INDEX idx_content_image_id ON content(image_id);

-- ============================================
-- POSTS
-- ============================================

CREATE TABLE posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL REFERENCES content(id) ON DELETE CASCADE,
    platform platform NOT NULL,
    platform_post_id VARCHAR(255),
    status post_status DEFAULT 'scheduled',
    scheduled_for TIMESTAMP WITH TIME ZONE,
    posted_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    ad_set_id VARCHAR(255),
    targeting JSONB,
    budget_spent DECIMAL(10, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_posts_content_id ON posts(content_id);

-- ============================================
-- PERFORMANCE
-- ============================================

CREATE TABLE performance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Engagement metrics
    impressions INTEGER DEFAULT 0,
    reach INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,

    -- Calculated rates
    ctr DECIMAL(5, 4),
    engagement_rate DECIMAL(5, 4),

    -- Conversion metrics
    landing_views INTEGER DEFAULT 0,
    signups INTEGER DEFAULT 0,
    trials INTEGER DEFAULT 0,
    purchases INTEGER DEFAULT 0,
    revenue DECIMAL(10, 2) DEFAULT 0,

    -- Cost metrics (paid only)
    spend DECIMAL(10, 2) DEFAULT 0,
    cpc DECIMAL(10, 2),
    cpa DECIMAL(10, 2),
    roas DECIMAL(10, 2)
);

CREATE INDEX idx_performance_post_id ON performance(post_id);

-- ============================================
-- CONVERSIONS
-- ============================================

CREATE TABLE conversions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
    content_id UUID REFERENCES content(id) ON DELETE SET NULL,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
    type conversion_type NOT NULL,
    value DECIMAL(10, 2),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    utm_content VARCHAR(100),
    session_id VARCHAR(255),
    user_agent TEXT,
    ip_address VARCHAR(45),
    geo_market VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conversions_business_id ON conversions(business_id);
CREATE INDEX idx_conversions_campaign_id ON conversions(campaign_id);

-- ============================================
-- TASKS
-- ============================================

CREATE TABLE tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    assignee task_assignee NOT NULL,
    type VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    instructions TEXT,
    status task_status DEFAULT 'pending',
    priority INTEGER DEFAULT 5,
    depends_on UUID REFERENCES tasks(id) ON DELETE SET NULL,
    due_date DATE,
    completed_at TIMESTAMP WITH TIME ZONE,
    completion_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_tasks_campaign_id ON tasks(campaign_id);

-- ============================================
-- ESCALATIONS
-- ============================================

CREATE TABLE escalations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    type escalation_type NOT NULL,
    severity escalation_severity NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    ai_analysis TEXT,
    ai_recommendation TEXT,
    data_snapshot JSONB,
    status escalation_status DEFAULT 'open',
    human_response TEXT,
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_escalations_campaign_id ON escalations(campaign_id);

-- ============================================
-- ACTIVITY LOG
-- ============================================

CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES campaigns(id) ON DELETE CASCADE,
    actor actor_type NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100),
    entity_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activity_log_business_id ON activity_log(business_id);
CREATE INDEX idx_activity_log_campaign_id ON activity_log(campaign_id);

-- ============================================
-- UPDATED_AT TRIGGER FUNCTION
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply trigger to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_businesses_updated_at BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_playbooks_updated_at BEFORE UPDATE ON playbooks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_campaigns_updated_at BEFORE UPDATE ON campaigns FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_content_updated_at BEFORE UPDATE ON content FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA: Admin User
-- Password: admin123 (bcrypt hash)
-- ============================================

INSERT INTO users (email, password_hash, name)
VALUES (
    'admin@campaignengine.local',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VlWzfGAqPj0N5a',
    'Admin'
);

-- ============================================
-- SEED DATA: Melissa for Educators
-- ============================================

INSERT INTO businesses (name, slug, description, website_url, brand_colors, settings)
VALUES (
    'Melissa for Educators',
    'melissa',
    'Education SaaS platform helping teachers create personalized learning experiences. $99/year subscription.',
    'https://melissaforeducators.com',
    '{"primary": "#6A1A19", "secondary": "#8B2E2D", "accent": "#F7AC13", "background": "#FFF8F0", "text": "#1A1A1A"}',
    '{"industry": "education", "pricePoint": 99, "billingCycle": "yearly", "targetMarkets": ["United States"], "primaryAudiences": ["TIA Seekers", "Time-Starved Teachers", "True Believers", "Tech-Hesitant Teachers"], "timezone": "America/Chicago"}'
);

-- ============================================
-- SEED DATA: Vaquero Homes
-- ============================================

INSERT INTO businesses (name, slug, description, website_url, brand_colors, settings)
VALUES (
    'Vaquero Homes',
    'vaquero',
    'Custom home builder and real estate developer serving the Texas market. Premium construction with a focus on quality craftsmanship.',
    'https://vaquerohomes.com',
    '{"primary": "#2C3E50", "secondary": "#34495E", "accent": "#E67E22", "background": "#FFFFFF", "text": "#1A1A1A"}',
    '{"industry": "real_estate", "targetMarkets": ["Texas", "Dallas-Fort Worth", "Austin", "Houston", "San Antonio"], "primaryAudiences": ["First-Time Buyers", "Growing Families", "Empty Nesters", "Relocating Professionals"], "timezone": "America/Chicago"}'
);

-- ============================================
-- Done!
-- ============================================
