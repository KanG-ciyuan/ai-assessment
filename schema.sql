-- AI 能力测评 D1 数据库建表
-- quiz_responses: 存储用户的答题记录
-- quiz_reports: 存储 AI 生成的报告

CREATE TABLE IF NOT EXISTS quiz_responses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  answers TEXT NOT NULL,        -- JSON: {"1":2,"2":1,...}
  dim_scores TEXT NOT NULL,     -- JSON: {"ai认知":{"score":5,"max":9,"rate":56},...}
  total_score INTEGER NOT NULL,
  level TEXT NOT NULL,          -- 等级: 探索者/进阶者/入门者/初识者
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quiz_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  response_id INTEGER NOT NULL,
  summary TEXT NOT NULL,         -- DeepSeek 生成的一句话总结
  report_html TEXT NOT NULL,    -- 完整报告 Markdown
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (response_id) REFERENCES quiz_responses(id)
);

CREATE TABLE IF NOT EXISTS personalized_advice_usage (
  assessment_id TEXT PRIMARY KEY,
  ip_hash TEXT NOT NULL,
  day_key TEXT NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_personalized_advice_usage_ip_day
  ON personalized_advice_usage (ip_hash, day_key);

CREATE INDEX IF NOT EXISTS idx_personalized_advice_usage_created_at
  ON personalized_advice_usage (created_at);

CREATE TABLE IF NOT EXISTS assessment_export_usage (
  assessment_id TEXT PRIMARY KEY,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
