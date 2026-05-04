create table if not exists serp_results (
  id text primary key not null,
  keyword_id text not null,
  keyword_text text not null,
  run_id text references research_runs(id) on delete cascade,
  position integer not null,
  url text not null,
  title text not null,
  snippet text not null,
  content_type text not null,
  domain text not null,
  fetched_at integer not null
);

create index if not exists idx_serp_results_keyword on serp_results(keyword_id, fetched_at);
