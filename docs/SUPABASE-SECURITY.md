# Sécurité Supabase (checklist)

## Clés et variables d’environnement

- Mobile : uniquement `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Admin :
  - `NEXT_PUBLIC_SUPABASE_*` pour le client web
  - `SUPABASE_SERVICE_ROLE_KEY` **uniquement** côté serveur (routes API)

## RLS (Row Level Security)

- Activer RLS sur **toutes** les tables exposées.
- Tester les policies avec un compte utilisateur standard (pas admin).
- Garder un accès admin via une route serveur (ou Supabase Edge Functions) si besoin.

Un draft est fourni dans `docs/supabase-rls.sql` (à adapter aux noms de tables/colonnes réels).

## Storage (buckets)

Recommandé :

- Buckets **publics** : assets non sensibles (images publiques, APK)
- Buckets **privés** : documents locataires, pièces, données sensibles
- Policies Storage explicites par bucket (`storage.objects`)

## Contrôle d’accès back-office

- Inscriptions publiques : rôle `USER`. Staff : `ADMIN`, `AGENT`, `ACCOUNTANT`.
- Middleware Next.js + AuthGate : un `USER` est déconnecté du back-office web.
- Les routes API admin valident le rôle `ADMIN` côté serveur.
- Tester les policies RLS avec un compte `USER`, pas un admin.

