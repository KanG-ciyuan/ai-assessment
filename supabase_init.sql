-- 答题记录表
CREATE TABLE quiz_responses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  answers JSONB NOT NULL,
  total_score INT NOT NULL,
  level TEXT NOT NULL,
  dim_scores JSONB NOT NULL
);

-- AI 报告表（后续用）
CREATE TABLE quiz_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id UUID REFERENCES quiz_responses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  summary TEXT NOT NULL,
  analysis JSONB NOT NULL
);
