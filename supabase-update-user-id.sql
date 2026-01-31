-- ============================================
-- Baby Tracker Pro - 更新数据库表添加 user_id
-- ============================================
-- 运行此脚本以添加用户隔离支持
-- ============================================

-- 1. 删除旧的 RLS 策略
DROP POLICY IF EXISTS "Allow all operations on feed_records" ON feed_records;
DROP POLICY IF EXISTS "Allow all operations on growth_logs" ON growth_logs;
DROP POLICY IF EXISTS "Allow all operations on reminders" ON reminders;
DROP POLICY IF EXISTS "Allow all operations on baby_profiles" ON baby_profiles;
DROP POLICY IF EXISTS "Users can manage own feed_records" ON feed_records;
DROP POLICY IF EXISTS "Users can manage own growth_logs" ON growth_logs;
DROP POLICY IF EXISTS "Users can manage own reminders" ON reminders;
DROP POLICY IF EXISTS "Users can manage own baby_profile" ON baby_profiles;

-- 2. 添加 user_id 列（如果不存在）
ALTER TABLE feed_records ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE growth_logs ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE reminders ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- 3. 删除旧的 baby_profiles 表并重新创建（设置 user_id 为唯一）
DROP TABLE IF EXISTS baby_profiles;
CREATE TABLE baby_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  name TEXT NOT NULL,
  birth_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 启用 RLS
ALTER TABLE feed_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE growth_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE baby_profiles ENABLE ROW LEVEL SECURITY;

-- 5. 创建用户隔离策略
CREATE POLICY "Users can manage own feed_records" ON feed_records
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own growth_logs" ON growth_logs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own reminders" ON reminders
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own baby_profile" ON baby_profiles
  FOR ALL USING (auth.uid() = user_id);

-- 6. 创建索引加速查询
CREATE INDEX IF NOT EXISTS idx_feed_records_user_id ON feed_records(user_id);
CREATE INDEX IF NOT EXISTS idx_growth_logs_user_id ON growth_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
