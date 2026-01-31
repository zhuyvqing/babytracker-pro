-- ============================================
-- Baby Tracker Pro - Supabase Database Schema
-- ============================================
-- Instructions:
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Copy and paste this entire file
-- 4. Click "Run" to create all tables
-- ============================================

-- Feed Records Table (breast, bottle, diaper, sleep)
CREATE TABLE IF NOT EXISTS feed_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('breast', 'bottle', 'diaper', 'sleep')),
  start_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  date TEXT NOT NULL DEFAULT '今天',
  note TEXT,
  
  -- Breast/Bottle fields
  side TEXT CHECK (side IN ('left', 'right')),
  duration_minutes INTEGER,
  duration_seconds INTEGER,
  amount_ml INTEGER,
  is_snack BOOLEAN DEFAULT FALSE,
  
  -- Diaper fields
  diaper_type TEXT CHECK (diaper_type IN ('wet', 'dirty', 'mixed')),
  diaper_amount TEXT CHECK (diaper_amount IN ('small', 'medium', 'large')),
  
  -- Sleep fields
  end_time TIMESTAMPTZ,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Growth Logs Table
CREATE TABLE IF NOT EXISTS growth_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('weight', 'height', 'head')),
  value DECIMAL(10, 2) NOT NULL,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reminders Table
CREATE TABLE IF NOT EXISTS reminders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  time_label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed')) DEFAULT 'pending',
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('feed', 'diaper')),
  scheduled_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Baby Profile Table (optional, for future multi-baby support)
CREATE TABLE IF NOT EXISTS baby_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  birth_date DATE,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- Row Level Security (RLS) Policies
-- For now, allow all operations (public access)
-- In production, you'd want to add user authentication
-- ============================================

ALTER TABLE feed_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE baby_profiles ENABLE ROW LEVEL SECURITY;

-- Policies for public access (no auth required)
CREATE POLICY "Allow all operations on feed_records" ON feed_records
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on growth_logs" ON growth_logs
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on reminders" ON reminders
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on baby_profiles" ON baby_profiles
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================
-- Indexes for better query performance
-- ============================================

CREATE INDEX IF NOT EXISTS idx_feed_records_start_time ON feed_records(start_time DESC);
CREATE INDEX IF NOT EXISTS idx_feed_records_type ON feed_records(type);
CREATE INDEX IF NOT EXISTS idx_growth_logs_type_date ON growth_logs(type, date DESC);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status);
