# Déploiement (mobile + admin)

## Environnements

Recommandé : `dev` / `staging` / `prod`, avec des variables d’environnement distinctes (Supabase, URLs, etc.).

## Supabase

La source de vérité du schéma, des politiques et des contraintes Storage est
[`supabase/migrations/`](../supabase/migrations/). Les scripts SQL historiques
conservés sous `docs/` ne sont plus des entrées de déploiement.

### Projet existant

1. Sauvegarder la base et vérifier quelles migrations sont déjà appliquées.
2. Vérifier les prérequis de chaque migration, puis appliquer uniquement les
   migrations manquantes selon leurs dépendances. Pour une installation issue
   des migrations du dépôt, l’ordre est : `0005_user_role.sql` (inutile sur le
   bootstrap `0002` qui contient déjà `USER`), `0003_production.sql`,
   `0006_admin_platform.sql`, `0004_auth_hardening.sql`, puis `0007` à `0015`
   dans l’ordre numérique, et enfin `0017` à `0020`, `0021` après `0012`, puis
   `0022`, `0023`, `0024`, `0025`, puis `0026`. Ne pas rejouer une migration déjà appliquée.
3. `0001_rls.sql` est un brouillon hérité explicitement marqué : ne pas
   l’appliquer en production. Ne pas appliquer `0002_bootstrap.sql` à une base
   existante.
4. Les migrations `0017` à `0020` et `0022` à `0026` sont appliquées automatiquement par GitHub
   Actions lorsqu’elles sont poussées sur `main`. Le workflow attend un schéma
   existant avec les prérequis de `0006_admin_platform.sql` ; il ne consulte pas
   l’historique ni n’applique les migrations antérieures.
   Configurer une seule fois le secret de dépôt `SUPABASE_DB_URL` avec l’URL de
   connexion PostgreSQL du projet. Ne pas y mettre la clé `service_role`.
   `0021_agent_direct_publishing_now.sql` doit ensuite être appliquée séparément
   dans le SQL Editor ; le workflow automatique ne la lance pas.
5. Promouvoir un admin : `update public.profiles set role = 'ADMIN' where id = '<uuid>';`
6. Vérifier le job `expire-imo-nord-listings` (pg_cron) ou le planifier à la main.

### Nouveau projet vide

Après avoir confirmé les prérequis, utiliser `0002_bootstrap.sql` comme base
initiale, puis appliquer les migrations ultérieures dans l’ordre. Ne pas
appliquer `0001_rls.sql`. Suivre les prérequis des migrations et ne pas supposer
que leur ordre numérique suffit pour déterminer l’ordre d’application.
`0019_storage_api_cleanup.sql` et `0020_property_storage_cleanup_queue.sql`
sont appliquées par le workflow ci-dessus après les prérequis. La route serveur
`/api/internal/cleanup-property-storage` du back-office traite ensuite la file
via l’API Storage. Définir `PROPERTY_STORAGE_CLEANUP_SECRET` dans l’environnement
du back-office et configurer les secrets GitHub `ADMIN_BASE_URL` (URL publique
du back-office, sans slash final) et `PROPERTY_STORAGE_CLEANUP_SECRET`. Le
workflow GitHub exécute le worker chaque heure et échoue explicitement si un
secret manque ou si l’endpoint ne retourne pas un statut HTTP 2xx. Il supprime
les fichiers uniquement au passage à l’état occupé, sans SQL direct sur
`storage.objects`.
Appliquer également `0021_agent_direct_publishing_now.sql` après `0012` pour
activer la publication directe des agents dès le 11 octobre 2026.
`0022_expiration_trigger_single_sync.sql` corrige la fonction d’expiration pour
laisser le déclencheur de synchronisation mettre à jour chaque publication une
seule fois ; `0023_preserve_expired_listing_images.sql` conserve les photos des
annonces archivées pour permettre leur renouvellement. Ce dernier annule aussi
les nettoyages d’images déjà en attente. L’administrateur peut supprimer une
photo depuis la fiche du bien dans le back-office ; le nettoyage automatique
reste réservé au passage à l’état occupé. Cette migration est appliquée par le
workflow GitHub de migrations Storage.

Les nouvelles photos sont compressées côté client pour ne pas dépasser 200 Ko
par image (au plus 1,6 Mo pour 8 photos). Les photos déjà stockées ne sont pas
recompressées par ce changement.

Les scripts SQL historiques de `docs/` ne sont pas des migrations à exécuter ;
certains conservent des opérations de nettoyage Storage obsolètes.

La migration `0006_admin_platform.sql` utilise la table canonique `property_reports` partagée par le mobile et le back-office. Si seule l’ancienne table `reports` existe, elle la renomme et harmonise `reporter_id` en `user_id`; si les deux tables existent ou si le schéma est ambigu, elle s’arrête avant les autres changements. `0013_property_reports_compatibility.sql` conserve le même garde-fou pour les installations historiques.

### Publication temporaire des comptes agent

Les comptes administrateur actifs peuvent publier directement sans période d’expiration. Les comptes agent actifs, y compris ceux nouvellement créés par un administrateur, publient directement du 11 octobre 2026 au 1er juin 2027 inclus (UTC, même fuseau que le Togo) ; à partir du 2 juin, leurs nouvelles annonces repassent en attente de validation. Les comptes utilisateur actifs ayant une demande agent en attente ou refusée bénéficient aussi de la publication directe du 1er décembre 2026 au 31 mai 2027. Appliquer `0012_temporary_agent_direct_publishing.sql`, puis `0021_agent_direct_publishing_now.sql`, après validation des prérequis de la base.

## Mobile (Expo / EAS)

Profils EAS existants : `development`, `preview` (APK), `production` (AAB) dans `eas.json`.

Commandes utiles (depuis la racine) :

- Dev : `npm run mobile:start`
- APK test interne : `npm run mobile:build:apk`
- AAB Play Store : `npm run mobile:build:aab`

### Versioning

La source de version Android est distante (`appVersionSource: remote`) et le
profil `production` incrémente automatiquement le `versionCode` à chaque build.
Ne pas modifier `android.versionCode` dans `app.json` : cette valeur locale est
ignorée par EAS et peut induire en erreur.

Avant une nouvelle version visible dans le Play Store, mettre à jour `version`
(ex. `1.2.0`) dans `app.json`. Contrôler le `versionCode` attribué à distance
dans le résultat du build EAS avant de téléverser l’AAB.

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
- `SUPABASE_SERVICE_ROLE_KEY` (clé API secrète `sb_secret_` ou ancien JWT `service_role`, serveur uniquement : routes API Next)

Voir `admin/README.md` et `admin/.env.local.example`.

## Site public (Expo Web)

Le site public et l’application Android partagent le code mobile et les mêmes
services Supabase. Le site est déployé sur Netlify et reste distinct du
back-office, toujours déployé sur Vercel avec le répertoire racine `admin`.

Pour créer le site Netlify :

1. Dans Netlify, choisir **Add new site → Import an existing project** et
   sélectionner le dépôt GitHub `imo-nord-togo-mobile`.
2. Laisser le **Base directory** vide (racine du dépôt). Le fichier
   `netlify.toml` configure la commande `npm run web:build`, le dossier de
   sortie `dist` et le repli des URL de navigation vers `index.html`.
3. Ajouter les variables d’environnement de production
   `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Ces variables
   sont incluses dans le code public du navigateur : ne jamais y mettre une clé
   `service_role` ni une clé secrète.
4. Lancer le déploiement, puis tester l’accueil, les liens directs vers les annonces, la
   connexion, la publication avec sélection de photos et les fonctions adaptées
   au navigateur. Les permissions et notifications natives ne sont pas toutes
   disponibles sur le web.

En local, lancer `npm run mobile:web` ; pour produire l’export de production,
lancer `npm run web:build`. Le dossier `dist` est généré et ignoré par Git.
Pour que les liens de confirmation et Google reviennent sur le site public,
définir l’URL de production Netlify comme **Site URL** dans
**Supabase → Authentication → URL Configuration**, puis ajouter ses callbacks
à **Redirect URLs**. Si l’URL demandée n’est pas autorisée, Supabase peut
rediriger vers la **Site URL** configurée (qui ne doit donc pas être le
back-office Vercel). Pour la production, la **Site URL** est
`https://curious-starburst-00e9e1.netlify.app`.
Les annonces partagées depuis le navigateur utilisent automatiquement le domaine
du site. Si le navigateur ne propose pas le partage natif, le lien est copié dans
le presse-papiers. La recherche vocale dépend de la prise en charge Web Speech du
navigateur. Les outils administrateur téléchargent/importent les sauvegardes par
le navigateur et utilisent le dialogue d’impression pour les reçus. Sur le web,
le PIN administrateur est conservé dans le stockage local du navigateur ; il ne
remplace pas la connexion administrateur ni les contrôles d’accès côté serveur.

### Authentification mobile (Google et mot de passe)

Pour la connexion Google, activer le fournisseur Google dans **Authentication → Sign In / Providers** de Supabase. Dans Google Cloud Console, déclarer l’URL de callback Supabase :

```text
https://<project-ref>.supabase.co/auth/v1/callback
```

Dans **Authentication → URL Configuration → Redirect URLs** de Supabase,
autoriser les callbacks de production du site public et de l’application mobile :

```text
https://curious-starburst-00e9e1.netlify.app/auth/callback
https://curious-starburst-00e9e1.netlify.app/reset-password
imonordtogo://auth/callback
imonordtogo://reset-password
https://imo-nord-togo-mobile.vercel.app/auth/callback
https://imo-nord-togo-mobile.vercel.app/reset-password
```

Le callback Netlify PKCE est utilisé par le site pour Google et après confirmation
de l’inscription ; le site échange le code puis revient sur le profil. Le callback
Vercel reste nécessaire pour l’App Link HTTPS Android. Pour activer sa
vérification, le domaine doit être contrôlé par le projet et publier
`/.well-known/assetlinks.json` avec `com.imonordtogo.app` et l’empreinte SHA-256
du certificat de signature réellement utilisé (EAS Play/App Signing selon le
canal). Il faut aussi vérifier que le déploiement Vercel sert ce fichier sans
redirection ni authentification. Régénérer le projet natif avec
`npx expo prebuild --platform android` après les changements de manifeste.

Le fournisseur Google doit être activé dans le projet Supabase utilisé par les environnements mobiles, et les identifiants OAuth du fournisseur doivent être valides dans Google Cloud Console.

### Vercel (Dashboard)

1. Créer un compte et importer le repo sur `https://vercel.com`.
2. Dans les settings du projet, définir **Root Directory** = `admin`.
3. Laisser les valeurs par défaut Next.js (Build Command `next build` / Output `.next`).
4. Ajouter les variables d’environnement (par environnement si besoin : Preview/Production) :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (clé API secrète `sb_secret_` ou ancien JWT `service_role`, serveur uniquement)
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

### Migrations Supabase via GitHub Actions

Le workflow `Apply Supabase storage and cleanup migrations` applique les
migrations Storage lorsque les fichiers SQL concernés sont modifiés sur `main`,
ou lorsqu’il est lancé manuellement depuis l’onglet **Actions**.

Avant de l’exécuter, ajouter le secret `SUPABASE_DB_URL` dans **GitHub → Settings
→ Secrets and variables → Actions → New repository secret**. Sa valeur doit
être l’URI de connexion PostgreSQL de ce projet Supabase (Dashboard Supabase →
**Connect** → URI), avec le mot de passe de la base de données. Ne pas utiliser
la clé `anon` ou `service_role` à la place et ne jamais inscrire cette URI dans
le dépôt ou dans un fichier `.env`.

Si un run échoue parce que `SUPABASE_DB_URL` est absent, configurer le secret
puis relancer le run depuis **Actions** avec **Re-run jobs**. Le workflow vérifie
le secret et la connexion avant d’exécuter les migrations. Une modification du
fichier workflow déclenche aussi cette vérification ainsi que l’application des
migrations.

Si la connexion échoue avec un timeout du pooler Supabase, remplacez la valeur
de `SUPABASE_DB_URL` par l’URI PostgreSQL actuelle affichée dans **Supabase →
Connect** (connexion directe ou pooler de session), avec SSL activé, puis
relancez le workflow. Ne transmettez jamais cette URI dans une conversation.
La migration `0024_remove_legacy_storage_delete_triggers.sql` retire les anciens
triggers qui tentaient de supprimer des fichiers en écrivant directement dans
`storage.objects`; les suppressions de fichiers doivent passer par l’API Storage.
La migration `0025_account_deletion_requests.sql` crée la file privée des demandes
de suppression de compte, accessible uniquement au service serveur. Le formulaire
public ne supprime pas de compte : un administrateur vérifie la demande, supprime
le compte depuis le back-office, puis clôture le dossier. Lors de la clôture,
l’adresse e-mail est effacée de la demande.
La migration `0026_agent_support_inbox.sql` crée les conversations privées entre
agents et administrateurs. Les agents répondent depuis l’application mobile ;
les administrateurs consultent et répondent dans **Messages → Demandes agents**
du back-office. Elle active aussi les événements Realtime si la publication
`supabase_realtime` existe. Déployer cette migration avant de présenter la
fonctionnalité aux agents.
