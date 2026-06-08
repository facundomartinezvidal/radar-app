-- Applied to remote: 20260608004254 via Supabase MCP
-- Migration: seed_default_categories_per_user
-- HU-16 — default categories become per-user owned (editable/deletable).
-- Seeds the 9 defaults per user (signup trigger + backfill), re-points existing
-- expenses from the shared global rows to each user's own copy (by slug), then
-- removes the global rows. Uses correct Lucide icon names (House, not Home).

-- 1. Seeder: inserts the 9 defaults owned by p_user_id, idempotent per slug.
create or replace function public.seed_default_categories(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categories (user_id, slug, name, icon, color, sort_order)
  values
    (p_user_id, 'comida',       'Comida',       'UtensilsCrossed', '#F59E0B', 10),
    (p_user_id, 'supermercado', 'Supermercado', 'ShoppingCart',    '#10B981', 20),
    (p_user_id, 'transporte',   'Transporte',   'Bus',             '#4FB3DC', 30),
    (p_user_id, 'ocio',         'Ocio',         'PartyPopper',     '#A855F7', 40),
    (p_user_id, 'salud',        'Salud',        'HeartPulse',      '#EF4444', 50),
    (p_user_id, 'hogar',        'Hogar',        'House',           '#0077B6', 60),
    (p_user_id, 'servicios',    'Servicios',    'Zap',             '#F59E0B', 70),
    (p_user_id, 'viajes',       'Viajes',       'Plane',           '#1E99CC', 80),
    (p_user_id, 'otro',         'Otro',         'CircleDashed',    '#7E8AA0', 99)
  on conflict (user_id, slug) where user_id is not null do nothing;
end;
$$;
revoke execute on function public.seed_default_categories(uuid) from anon, authenticated, public;

-- 2. Signup trigger: seed defaults for every new user.
create or replace function public.handle_new_user_categories()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.seed_default_categories(new.id);
  return new;
end;
$$;
revoke execute on function public.handle_new_user_categories() from anon, authenticated, public;

drop trigger if exists on_auth_user_created_seed_categories on auth.users;
create trigger on_auth_user_created_seed_categories
  after insert on auth.users
  for each row execute function public.handle_new_user_categories();

-- 3. Backfill existing users.
do $$
declare u record;
begin
  for u in select id from auth.users loop
    perform public.seed_default_categories(u.id);
  end loop;
end $$;

-- 4. Re-point existing expenses from the global category to the owner's copy (same slug).
-- Uses a correlated subquery to avoid cross-referencing the target table alias in FROM joins.
update public.expenses e
set category_id = (
  select c_new.id
  from public.categories c_old
  join public.categories c_new
    on c_new.slug = c_old.slug
    and c_new.user_id = e.user_id
  where c_old.id = e.category_id
    and c_old.user_id is null
  limit 1
)
where e.category_id in (select id from public.categories where user_id is null);

-- 5. Remove the now-unreferenced global rows.
delete from public.categories where user_id is null;
