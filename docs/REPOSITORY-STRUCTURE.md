# Structure du repository

Ce repository contient 2 applications qui partagent le même backend **Supabase** :

- `/` : application mobile **Expo / React Native**
- `admin/` : back-office web **Next.js**

## Objectif

Limiter les conflits de dépendances et clarifier les workflows de build/déploiement.

## Conventions recommandées

- Ne pas mélanger du code web dans `src/` (mobile) : tout le web reste dans `admin/`.
- Ne jamais utiliser de clé Supabase **service_role** côté mobile (uniquement côté serveur, ex. routes API Next).
- Centraliser la doc “prod” dans `docs/`.
- SQL existant : `docs/supabase-user-role.sql` puis `docs/supabase-production-migration.sql`.
- Promouvoir un `ADMIN` à la main après migration. Les inscriptions sont `USER`.

## Commandes (depuis la racine)

Mobile (Expo) :

- `npm run mobile:start`
- `npm run mobile:android`
- `npm run mobile:build:apk`
- `npm run mobile:build:aab`

Admin (Next.js) :

- `npm run admin:dev`
- `npm run admin:build`
- `npm run admin:start`

