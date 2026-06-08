-- Applied to remote: 20260608143107 via Supabase MCP
-- Migration: add_income_categories_kind
-- HU-20/HU-21 — categories gain a `kind` discriminator ('expense'|'income').
-- Existing rows default to 'expense'. Slug uniqueness becomes per (user_id, kind,
-- slug) so a user can own e.g. 'otros' in both sets. seed_default_categories is
-- extended to also seed the income default set; existing users are backfilled.

alter table public.categories
  add column kind text not null default 'expense'
    check (kind in ('expense','income'));

drop index if exists public.categories_slug_user_unique;
create unique index categories_user_kind_slug_unique
  on public.categories (user_id, kind, slug) where user_id is not null;
create index categories_kind_idx on public.categories (kind);

create or replace function public.seed_default_categories(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.categories (user_id, kind, slug, name, icon, color, sort_order)
  values
    (p_user_id,'expense','comida',        'Comida',       'UtensilsCrossed','#F59E0B',10),
    (p_user_id,'expense','supermercado',  'Supermercado', 'ShoppingCart',   '#10B981',20),
    (p_user_id,'expense','transporte',    'Transporte',   'Bus',            '#4FB3DC',30),
    (p_user_id,'expense','ocio',          'Ocio',         'PartyPopper',    '#A855F7',40),
    (p_user_id,'expense','salud',         'Salud',        'HeartPulse',     '#EF4444',50),
    (p_user_id,'expense','hogar',         'Hogar',        'House',          '#0077B6',60),
    (p_user_id,'expense','servicios',     'Servicios',    'Zap',            '#F59E0B',70),
    (p_user_id,'expense','viajes',        'Viajes',       'Plane',          '#1E99CC',80),
    (p_user_id,'expense','otro',          'Otro',         'CircleDashed',   '#7E8AA0',99),
    (p_user_id,'income', 'sueldo',        'Sueldo',       'Wallet',         '#10B981',10),
    (p_user_id,'income', 'freelance',     'Freelance',    'Laptop',         '#0077B6',20),
    (p_user_id,'income', 'inversiones',   'Inversiones',  'TrendingUp',     '#1E99CC',30),
    (p_user_id,'income', 'reintegro',     'Reintegro',    'Undo2',          '#4FB3DC',40),
    (p_user_id,'income', 'regalo',        'Regalo',       'Gift',           '#A855F7',50),
    (p_user_id,'income', 'alquiler',      'Alquiler',     'Building2',      '#F59E0B',60),
    (p_user_id,'income', 'otros-ingresos','Otros',        'CircleDashed',   '#7E8AA0',99)
  on conflict (user_id, kind, slug) where user_id is not null do nothing;
end; $$;
revoke execute on function public.seed_default_categories(uuid) from anon, authenticated, public;

do $$ declare u record; begin
  for u in select id from auth.users loop
    perform public.seed_default_categories(u.id);
  end loop;
end $$;
