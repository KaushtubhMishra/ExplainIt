-- ExplainIt V1: types, tables, indexes, and the updated_at trigger.

create type input_mode    as enum ('idea', 'notes', 'brainstorm');
create type project_stage as enum ('planning', 'storyboard', 'rendering', 'ready');
create type chat_stage    as enum ('brainstorm', 'storyboard', 'video');
create type chat_role     as enum ('user', 'assistant');
create type job_status    as enum ('queued', 'voicing', 'rendering', 'uploading', 'done', 'failed', 'cancelled');
create type llm_kind      as enum ('brainstorm', 'script', 'revise');

-- One row per video idea.
create table projects (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  title            text not null default 'Untitled' check (char_length(title) <= 70),
  language         text not null check (language in ('en-IN', 'hi-IN')),
  duration_target  smallint not null default 60 check (duration_target in (60, 90)),
  theme            text not null default 'auto' check (theme in ('auto', 'sky', 'forest', 'sunset', 'night')),
  input_mode       input_mode not null,
  input_text       text not null default '' check (char_length(input_text) <= 5000),
  scene_plan       jsonb,                          -- null until the first script
  plan_version     integer not null default 0,     -- +1 on every saved plan
  stage            project_stage not null default 'planning',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- Brainstorm and change-request chat turns.
create table messages (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  stage       chat_stage not null,
  role        chat_role not null,
  content     text not null check (char_length(content) <= 4000),
  created_at  timestamptz not null default now()
);

-- One row per render order, with a frozen copy of the plan.
create table jobs (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references projects (id) on delete cascade,
  user_id            uuid not null references auth.users (id) on delete cascade,
  plan_version       integer not null,
  scene_plan         jsonb not null,
  voice              text check (voice in ('edge', 'azure')),  -- which service actually voiced it
  status             job_status not null default 'queued',
  progress           smallint not null default 0 check (progress between 0 and 100),
  changed_scene_ids  text[] not null default '{}',
  attempts           smallint not null default 0,
  error              text,
  metrics            jsonb not null default '{}',
  created_at         timestamptz not null default now(),
  claimed_at         timestamptz,
  finished_at        timestamptz
);

-- One row per finished MP4 in Cloudflare R2.
create table videos (
  id                uuid primary key default gen_random_uuid(),
  project_id        uuid not null references projects (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  job_id            uuid not null unique references jobs (id) on delete cascade,
  r2_key            text not null unique,
  size_bytes        bigint not null,
  duration_seconds  numeric(5, 1) not null,
  expires_at        timestamptz not null,           -- 23:59 IST on the render day
  deleted_at        timestamptz,                    -- set when removed from R2
  created_at        timestamptz not null default now()
);

-- One row per Gemini call, for the hourly limit and cost tracking.
create table llm_calls (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  project_id  uuid references projects (id) on delete set null,
  kind        llm_kind not null,
  provider    text not null,
  ok          boolean not null,
  attempts    smallint not null default 1,
  seconds     numeric(6, 1) not null,
  created_at  timestamptz not null default now()
);

-- A single row the laptop worker refreshes every 30 seconds.
create table worker_heartbeat (
  id              smallint primary key default 1 check (id = 1),
  last_seen_at    timestamptz not null,
  worker_version  text
);

-- One active render per project.
create unique index jobs_one_active_per_project on jobs (project_id)
  where status in ('queued', 'voicing', 'rendering', 'uploading');

create index projects_library    on projects (user_id, updated_at desc);
create index messages_by_project on messages (project_id, stage, created_at);
create index jobs_queue          on jobs (created_at) where status = 'queued';
create index jobs_by_project     on jobs (project_id, created_at desc);
create index jobs_by_user_day    on jobs (user_id, created_at);
create index videos_by_project   on videos (project_id, created_at desc);
create index videos_to_expire    on videos (expires_at) where deleted_at is null;
create index llm_calls_by_user   on llm_calls (user_id, created_at);

create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger projects_updated_at before update on projects
  for each row execute function set_updated_at();
