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
- Source de vérité SQL : `supabase/migrations/`. Les anciens scripts `admin/supabase/` ont été supprimés pour éviter les divergences. Les scripts SQL historiques dans `docs/` sont conservés comme références et ne sont pas des entrées de déploiement.
- Les migrations sont la référence du schéma et des politiques Storage/RLS. Vérifier leurs prérequis avant application à une base existante : `0001_rls.sql` est un brouillon historique à ne pas exécuter, `0002_bootstrap.sql` est un bootstrap autonome pour un nouveau projet, et les migrations incrémentales suivantes dépendent du schéma déjà présent. Ne pas appliquer aveuglément le dossier complet sur une base de production existante.
- `0014_persist_business_features.sql` ajoute la persistance des profils agents, alertes, règles de commission, transactions, métadonnées de documents et abonnements Premium. Elle suppose le schéma de production déjà installé, utilise RLS, et réserve l'écriture des abonnements Premium à un backend de paiement vérifié. Les fichiers de documents doivent déjà être accessibles via l'URL enregistrée ; cette migration ne met pas en place leur téléversement. L'appliquer séparément après validation du schéma cible.
- `0015_property_completion_history.sql` distingue les résultats « vendu » et « loué », les inscrit dans `listing_events` et conserve le bien dans `properties`. Elle suppose les tables `publications` et `listing_events` de `0006_admin_platform.sql` ainsi que la fonction `set_property_occupancy` de `0003_production.sql` ; valider ces prérequis avant de l'appliquer séparément sur Supabase.
- Les suppressions de fichiers du bucket `property-images` passent par l’API Storage dans les parcours client et back-office. Ne pas supprimer directement les lignes de `storage.objects` par SQL : cela laisse les objets physiques orphelins. `0019_storage_api_cleanup.sql` supprime l’ancien nettoyage SQL lors de l’expiration ou du passage à « occupé » et conserve les photos en base, leur visibilité restant régie par RLS.
- `0017_storage_upload_constraints.sql` et `0018_property_images_one_megabyte.sql` configurent les buckets Supabase avec des limites de taille et des listes MIME côté Storage : JPEG/PNG/WebP jusqu'à 1 Mo pour les images de biens, PDF/JPEG/PNG/WebP jusqu'à 15 Mo pour les documents locataires. GitHub Actions les applique automatiquement sur `main` ; le secret de dépôt `SUPABASE_DB_URL` doit être configuré une seule fois.
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
