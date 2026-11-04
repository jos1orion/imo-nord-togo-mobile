-- Migration 0028: Extension de la période de lancement gratuit à 12 mois (12 novembre 2027)
-- et préparation de l'architecture de paiement commercial (500 et 1000 FCFA, Flooz/TMoney/PayGate).
--
-- Cette migration est additive, non destructive et n'altère aucune donnée existante.
begin;

--------------------------------------------------------------------------------
-- 1. Table de configuration centralisée de la plateforme (app_settings)
--------------------------------------------------------------------------------
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

-- RLS sur app_settings
alter table public.app_settings enable row level security;

-- Lecture publique (APK et Web doivent pouvoir lire les dates officielles et liens autorisés)
drop policy if exists "app_settings_public_select" on public.app_settings;
create policy "app_settings_public_select" on public.app_settings
  for select using (true);

-- Écriture strictement réservée aux administrateurs
drop policy if exists "app_settings_admin_all" on public.app_settings;
create policy "app_settings_admin_all" on public.app_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- Insertion des valeurs par défaut pour le lancement officiel
insert into public.app_settings (key, value, description)
values
  (
    'launch_period',
    jsonb_build_object(
      'official_launch_date', '2026-11-12T00:00:00.000Z',
      'duration_months', 12,
      'end_date', '2027-11-12T23:59:59.999Z',
      'free_agent_publishing_enabled', true
    ),
    'Période de lancement commercial gratuit de 12 mois pour tous les agents'
  ),
  (
    'external_links',
    jsonb_build_object(
      'official_website_url', 'https://imo-nord-togo-mobile.vercel.app',
      'netlife_url', null
    ),
    'URLs configurables du site officiel Imo Nord Togo et du partenaire Netlife'
  ),
  (
    'commercial_pricing',
    jsonb_build_object(
      'standard_option_fcfa', 500,
      'premium_option_fcfa', 1000,
      'currency', 'XOF',
      'payment_channel', 'website_only',
      'supported_providers', jsonb_build_array('flooz', 'tmoney')
    ),
    'Grille tarifaire commerciale après la fin de la période gratuite'
  )
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  updated_at = now();

--------------------------------------------------------------------------------
-- 2. Mise à jour de la fonction can_direct_publish_property()
--    Étendu jusqu'au 12 novembre 2027 inclus (13 nov 00:00:00 UTC)
--------------------------------------------------------------------------------
create or replace function public.can_direct_publish_property()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.account_status = 'active'
      and (
        profile.role = 'ADMIN'
        or (
          profile.role = 'AGENT'
          and now() >= timestamptz '2026-10-11 00:00:00+00'
          and now() < coalesce(
            (select (value->>'end_date')::timestamptz from public.app_settings where key = 'launch_period'),
            timestamptz '2027-11-13 00:00:00+00'
          )
        )
      )
  );
$$;

revoke all on function public.can_direct_publish_property() from public;
grant execute on function public.can_direct_publish_property() to anon, authenticated, service_role;

--------------------------------------------------------------------------------
-- 3. Fonction utilitaire de statut de la période de gratuité
--------------------------------------------------------------------------------
create or replace function public.get_launch_period_status()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'is_active', (now() < coalesce(
      (select (value->>'end_date')::timestamptz from public.app_settings where key = 'launch_period'),
      timestamptz '2027-11-13 00:00:00+00'
    )),
    'end_date', coalesce(
      (select value->>'end_date' from public.app_settings where key = 'launch_period'),
      '2027-11-12T23:59:59.999Z'
    ),
    'current_server_time', now()
  );
$$;

grant execute on function public.get_launch_period_status() to anon, authenticated, service_role;

--------------------------------------------------------------------------------
-- 4. Préparation de la table des ordres de paiement (sans activation directe)
--------------------------------------------------------------------------------
create table if not exists public.listing_payment_orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  order_reference text not null unique,
  provider text not null check (provider in ('flooz', 'tmoney', 'paygate')),
  provider_reference text unique,
  tier text not null check (tier in ('standard_500', 'premium_1000')),
  amount integer not null check (amount in (500, 1000)),
  currency text not null default 'XOF',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'expired')),
  payment_phone text,
  idempotency_key text unique,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  failed_at timestamptz,
  failure_reason text
);

alter table public.listing_payment_orders enable row level security;

-- Sécurité RLS : Un utilisateur ne peut lire que ses propres commandes de paiement
drop policy if exists "payment_orders_owner_select" on public.listing_payment_orders;
create policy "payment_orders_owner_select" on public.listing_payment_orders
  for select using (user_id = auth.uid() or public.is_admin());

-- Sécurité RLS : Seul l'administrateur ou les fonctions de backend (service_role) peuvent insérer/modifier
drop policy if exists "payment_orders_admin_all" on public.listing_payment_orders;
create policy "payment_orders_admin_all" on public.listing_payment_orders
  for all using (public.is_admin()) with check (public.is_admin());

-- Index de performance et d'unicité
create index if not exists idx_payment_orders_user_id on public.listing_payment_orders(user_id);
create index if not exists idx_payment_orders_property_id on public.listing_payment_orders(property_id);
create index if not exists idx_payment_orders_status on public.listing_payment_orders(status);

commit;

