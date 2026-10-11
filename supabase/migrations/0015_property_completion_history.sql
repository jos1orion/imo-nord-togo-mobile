alter table public.properties
  add column if not exists completion_type text;

do $$ begin
  alter table public.properties
    add constraint properties_completion_type_check
    check (completion_type is null or completion_type in ('sold', 'rented'));
exception when duplicate_object then null;
end $$;

create or replace function public.complete_property_transaction(
  p_property_id uuid,
  p_outcome text
)
returns public.properties
language plpgsql
security definer
set search_path = public
as $$
declare completed_property public.properties;
begin
  if p_outcome is null or p_outcome not in ('sold', 'rented') then
    raise exception 'Résultat de transaction invalide';
  end if;

  update public.properties
     set status = 'occupied',
         completion_type = p_outcome,
         sold_at = case when p_outcome = 'sold' then now() else null end,
         rented_at = case when p_outcome = 'rented' then now() else null end,
         updated_at = now()
   where id = p_property_id
     and status = 'available'
     and (owner_id = auth.uid() or public.is_admin())
  returning * into completed_property;

  if completed_property.id is null then
    raise exception 'Bien introuvable, déjà terminé ou accès refusé';
  end if;

  insert into public.listing_events (property_id, publication_id, event, actor_id)
  values (
    completed_property.id,
    completed_property.current_publication_id,
    p_outcome,
    auth.uid()
  );

  return completed_property;
end;
$$;

revoke all on function public.complete_property_transaction(uuid, text) from public, anon;
grant execute on function public.complete_property_transaction(uuid, text) to authenticated;

create or replace function public.set_property_occupancy(
  p_property_id uuid,
  p_status public.property_status
)
returns public.properties
language plpgsql
security definer
set search_path = public
as $$
declare updated_property public.properties;
begin
  if p_status not in ('available', 'occupied') then
    raise exception 'Statut d''occupation invalide';
  end if;

  update public.properties
     set status = p_status,
         completion_type = case
           when p_status = 'available' or status is distinct from 'occupied' then null
           else completion_type
         end,
         sold_at = case
           when p_status = 'occupied' and status is distinct from 'occupied' then now()
           when p_status = 'available' then null
           else sold_at
         end,
         rented_at = case
           when p_status = 'occupied' and status is distinct from 'occupied' then now()
           when p_status = 'available' then null
           else rented_at
         end
   where id = p_property_id
     and (owner_id = auth.uid() or public.is_admin())
  returning * into updated_property;

  if updated_property.id is null then
    raise exception 'Bien introuvable ou accès refusé';
  end if;
  return updated_property;
end;
$$;
