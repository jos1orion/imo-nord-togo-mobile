# Déploiement (mobile + admin)

## Environnements

Recommandé : `dev` / `staging` / `prod`, avec des variables d’environnement distinctes (Supabase, URLs, etc.).

## Supabase (projet existant)

1. Sauvegarder la base.
2. SQL Editor : exécuter `docs/supabase-user-role.sql` seul, puis valider.
3. Exécuter `docs/supabase-production-migration.sql`.
4. Promouvoir un admin : `update public.profiles set role = 'ADMIN' where id = '<uuid>';`
5. Vérifier le job `expire-imo-nord-listings` (pg_cron) ou le planifier à la main.

## Mobile (Expo / EAS)

Profils EAS existants : `development`, `preview` (APK), `production` (AAB) dans `eas.json`.

Commandes utiles (depuis la racine) :

- Dev : `npm run mobile:start`
- APK test interne : `npm run mobile:build:apk`
- AAB Play Store : `npm run mobile:build:aab`

### Versioning

Avant chaque build “store”, incrémenter :

- `version` (ex. `1.2.0`) dans `app.json`
- `android.versionCode` dans `app.json` (doit augmenter à chaque soumission Play Store)

### Distribution APK (hors Play Store)

Option recommandée :

- Uploader l’APK dans un bucket public (ex. Supabase Storage)
- Exposer une URL publique stable
- Renseigner `EXPO_PUBLIC_APK_URL` côté mobile (voir `.env.example`)

## Admin (Next.js)

Déploiement recommandé : Vercel (ou équivalent).

Variables d’environnement attendues :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (serveur uniquement : routes API Next)

Voir `admin/README.md` et `admin/.env.local.example`.

### Authentification mobile (Google et mot de passe)

Pour la connexion Google, activer le fournisseur Google dans **Authentication → Sign In / Providers** de Supabase. Dans Google Cloud Console, déclarer l’URL de callback Supabase :

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

Dans **Authentication → URL Configuration → Redirect URLs** de Supabase, autoriser le callback de l’application :

```text
imonordtogo://auth/callback
```

Ce callback est utilisé pour la connexion Google et le retour après confirmation de l’inscription. Le manifeste Android déclare le schéma `imonordtogo`; après toute modification du schéma ou des icônes, régénérer le projet natif avec `npx expo prebuild --platform android`.

Le fournisseur Google doit être activé dans le projet Supabase utilisé par les environnements mobiles, et les identifiants OAuth du fournisseur doivent être valides dans Google Cloud Console.

Pour la réinitialisation du mot de passe mobile, ajouter également cette URL aux **Redirect URLs** :

```text
imonordtogo://reset-password
```

L’application ouvre cette URL depuis l’email de récupération et permet ensuite de définir un nouveau mot de passe.

### Vercel (Dashboard)

1. Créer un compte et importer le repo sur `https://vercel.com`.
2. Dans les settings du projet, définir **Root Directory** = `admin`.
3. Laisser les valeurs par défaut Next.js (Build Command `next build` / Output `.next`).
4. Ajouter les variables d’environnement (par environnement si besoin : Preview/Production) :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (serveur uniquement)
5. Déployer : chaque push crée une Preview, et la branche de prod (souvent `main`) crée la Production.

Après déploiement, la ressource Web publique de demande de suppression pour Google
Play est `https://imo-nord-togo-mobile.vercel.app/delete-account`. Vérifier qu’elle
s’ouvre sans connexion avant de l’ajouter à la fiche Play Console.

### Vercel (CLI)

Installation :

- `npm i -g vercel`

Premier déploiement (depuis `admin/`) :

- `cd admin`
- `vercel`

Production :

- `vercel --prod`
