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
- Les copies SQL de `docs/` sont archivées dans `supabase/migrations/`, mais elles ne constituent pas encore une suite sûre à appliquer automatiquement : `0001_rls.sql` est explicitement un brouillon historique à ne pas exécuter, `0002_bootstrap.sql` est une installation complète autonome, et les autres scripts déclarent des prérequis dont l'ordre doit être validé selon la base cible. Conserver les originaux dans `docs/` ; ne pas exécuter tout le dossier en bloc. Toute nouvelle migration doit être vérifiée et ordonnée avant déploiement.
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
