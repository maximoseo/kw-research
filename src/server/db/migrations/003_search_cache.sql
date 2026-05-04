create table if not exists search_cache (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  query_hash text not null,
  results text not null,
  created_at integer not null,
  expires_at integer not null
);

create index if not exists idx_search_cache_query_hash on search_cache(query_hash);
create index if not exists idx_search_cache_expires_at on search_cache(expires_at);
