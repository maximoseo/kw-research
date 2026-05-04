create table if not exists content_briefs (
  id text primary key,
  user_id text not null references users(id) on delete cascade,
  title text not null,
  keywords text not null,
  brief text not null,
  created_at integer not null
);
