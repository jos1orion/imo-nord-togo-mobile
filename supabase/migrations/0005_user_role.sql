-- Etape 1/2 — a executer SEUL, puis valider, avant supabase-production-migration.sql.
-- PostgreSQL interdit d'utiliser une nouvelle valeur d'enum dans la meme transaction
-- que ALTER TYPE ... ADD VALUE.

alter type public.user_role add value if not exists 'USER';
