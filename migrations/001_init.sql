-- LeanPrep sales automation: initial schema (run once in Neon)
create extension if not exists pgcrypto;

create table if not exists contacts (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,              -- stored lower-case
  phone               text unique,              -- E.164, e.g. +919876543210
  name                text,
  source              text,                     -- e.g. masterclass_list, signup, razorpay
  first_utm_source    text,
  first_utm_campaign  text,
  whatsapp_opt_in     boolean not null default false,
  email_opt_out       boolean not null default false,
  telegram_chat_id    bigint unique,
  purchased_at        timestamptz,
  plan                text,
  has_adaptive        boolean not null default false,
  created_at          timestamptz not null default now(),
  check (email is not null or phone is not null)
);

create table if not exists events (
  id               bigserial primary key,
  contact_id       uuid not null references contacts(id) on delete cascade,
  type             text not null,
  props            jsonb not null default '{}'::jsonb,
  occurred_at      timestamptz not null default now(),
  idempotency_key  text unique
);
create index if not exists events_contact_type_idx on events (contact_id, type, occurred_at desc);
create index if not exists events_type_time_idx on events (type, occurred_at desc);

create table if not exists enrollments (
  id           bigserial primary key,
  contact_id   uuid not null references contacts(id) on delete cascade,
  flow_id      text not null,
  step_index   int not null default 0,
  started_at   timestamptz not null default now(),
  next_run_at  timestamptz not null,
  status       text not null default 'active' check (status in ('active','completed','stopped')),
  stop_reason  text,
  context      jsonb not null default '{}'::jsonb,
  deferrals    int not null default 0
);
create unique index if not exists enrollments_one_active_idx
  on enrollments (contact_id, flow_id) where status = 'active';
create index if not exists enrollments_due_idx on enrollments (next_run_at) where status = 'active';

create table if not exists messages (
  id             bigserial primary key,
  contact_id     uuid not null references contacts(id) on delete cascade,
  enrollment_id  bigint references enrollments(id) on delete set null,
  flow_id        text,
  step_key       text,
  channel        text not null check (channel in ('email','telegram','whatsapp')),
  template       text not null,
  status         text not null check (status in ('pending','dry_run','sent','failed')),
  rendered       jsonb not null default '{}'::jsonb,
  provider_id    text,
  error          text,
  created_at     timestamptz not null default now(),
  unique (enrollment_id, step_key, channel)
);
create index if not exists messages_contact_channel_idx on messages (contact_id, channel, created_at desc);

create table if not exists referral_codes (
  code        text primary key,
  contact_id  uuid not null unique references contacts(id) on delete cascade,
  created_at  timestamptz not null default now()
);
