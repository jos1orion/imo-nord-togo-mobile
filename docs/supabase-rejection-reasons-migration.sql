-- Imo Nord Togo - motifs de refus pour les demandes agent et les annonces.
-- Migration idempotente : peut être exécutée sans supprimer les données existantes.

alter table public.profiles
  add column if not exists agent_rejection_reason text;

alter table public.properties
  add column if not exists rejection_reason text;

comment on column public.profiles.agent_rejection_reason is
  'Motif visible par le demandeur lorsque sa demande agent est refusée.';

comment on column public.properties.rejection_reason is
  'Motif visible par le propriétaire lorsque son annonce est refusée.';
 