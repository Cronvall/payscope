-- cases: full case payload for display + status
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY,
  errand_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  custodian TEXT NOT NULL,
  type TEXT NOT NULL,
  amount_recoverable REAL NOT NULL,
  currency TEXT NOT NULL,
  steps TEXT,
  refs TEXT,
  status TEXT NOT NULL CHECK (status IN ('AI_ANALYZED','UNDER_REVIEW','DOCUMENT_REQUESTED','CLAIM_SUBMITTED','RECOVERED','WRITTEN_OFF')),
  jurisdiction TEXT DEFAULT '',
  security TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- case_attachments: filled PDFs associated with cases
CREATE TABLE IF NOT EXISTS case_attachments (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES cases(id),
  filename TEXT NOT NULL,
  form_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- case_history: status transitions
CREATE TABLE IF NOT EXISTS case_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  case_id TEXT NOT NULL REFERENCES cases(id),
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_at TEXT NOT NULL,
  note TEXT
);
