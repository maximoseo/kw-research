create table if not exists users (
  id text primary key,
  email text not null unique,
  display_name text not null,
  password_hash text not null,
  created_at integer not null,
  updated_at integer not null
);

create table if not exists sessions (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at integer not null,
  last_seen_at integer not null,
  created_at integer not null
);

create index if not exists sessions_user_id_idx on sessions(user_id);
create index if not exists sessions_expires_at_idx on sessions(expires_at);

create table if not exists projects (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  name text not null,
  brand_name text not null,
  language text not null,
  market text not null,
  homepage_url text not null,
  about_url text not null,
  sitemap_url text not null,
  competitor_urls text,
  notes text,
  created_at integer not null,
  updated_at integer not null
);

create index if not exists projects_user_id_idx on projects(user_id, created_at desc);

create table if not exists uploaded_files (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  run_id text,
  original_name text not null,
  stored_path text not null,
  mime_type text not null,
  size_bytes integer not null,
  summary text,
  created_at integer not null
);

create index if not exists uploaded_files_user_id_idx on uploaded_files(user_id, created_at desc);

create table if not exists research_runs (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  user_id text not null references users(id) on delete cascade,
  mode text not null,
  status text not null,
  step text,
  target_rows integer not null,
  input_snapshot text not null,
  site_snapshot text,
  competitor_snapshot text,
  uploaded_file_id text references uploaded_files(id) on delete set null,
  result_rows text,
  result_summary text,
  workbook_path text,
  workbook_name text,
  workbook_mime text,
  error_message text,
  worker_id text,
  lock_acquired_at integer,
  queued_at integer not null,
  started_at integer,
  completed_at integer,
  updated_at integer not null
);

create index if not exists research_runs_user_id_idx on research_runs(user_id, queued_at desc);
create index if not exists research_runs_status_idx on research_runs(status, queued_at asc);
create index if not exists research_runs_project_id_idx on research_runs(project_id, queued_at desc);

create table if not exists research_logs (
  id text primary key,
  run_id text not null references research_runs(id) on delete cascade,
  stage text not null,
  level text not null,
  message text not null,
  metadata text,
  created_at integer not null
);

create index if not exists research_logs_run_id_idx on research_logs(run_id, created_at asc);
