create table if not exists scanned_products (
  store_domain   text not null,
  product_id     text not null,
  updated_at     timestamptz not null,
  vocab_version  integer not null,
  product        jsonb not null,
  tags           jsonb not null,
  embedding      jsonb,
  created_at     timestamptz not null default now(),
  primary key (store_domain, product_id)
);

create index if not exists scanned_products_store_idx on scanned_products (store_domain);

-- No policies defined on purpose: only the service_role key (used by this
-- backend only) can bypass RLS. The anon/authenticated roles get default-deny.
alter table scanned_products enable row level security;
