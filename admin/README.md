# Imo Nord Togo — Back-office web

Application Next.js pour la gestion (biens, locataires, contrats, etc.), connectée au même projet **Supabase** que l’app mobile.

## Prérequis

- Node.js 18+
- Un projet Supabase avec les tables attendues (`properties`, `profiles`, etc.)

## Configuration

1. Copier `admin/.env.example` vers `admin/.env.local`.
2. Renseigner `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` (cette dernière sert uniquement aux routes serveur de création, modification et suppression des utilisateurs).

### Sécurité

- `SUPABASE_SERVICE_ROLE_KEY` doit rester **côté serveur uniquement** (routes API Next.js). Ne jamais l’exposer au navigateur.
- Les accès “admin” sont contrôlés par middleware Next.js, AuthGate, RBAC et RLS Supabase.
- Les inscriptions mobiles reçoivent le rôle `USER`. Un administrateur doit promouvoir le staff.

## Lancer en local

```bash
cd admin
npm install
npm run dev
```

Depuis la racine du dépôt, la commande équivalente est :

```bash
npm run admin:dev
```

Ouvrir [http://localhost:3000](http://localhost:3000), se connecter avec un compte ayant une ligne dans `profiles` et le rôle `ADMIN`. Les comptes `USER`, `AGENT` et `ACCOUNTANT` sont refusés.

## Rôles et menu

Le back-office est réservé au rôle `ADMIN`. Les rôles `USER`, `AGENT` et `ACCOUNTANT` n’y ont pas accès (voir `lib/rbac.ts` et `lib/supabaseMiddleware.ts`).

## Base Supabase et production

Avant toute mise en production, exécuter dans l’éditeur SQL de Supabase dans l’ordre suivant :

1. `docs/supabase-user-role.sql`
2. `docs/supabase-production-migration.sql`

Ne pas exécuter `docs/supabase-bootstrap-production.sql` sur un projet existant. La migration produit le rôle `USER` par défaut, le trigger de création de profil, les politiques RLS restrictives et la planification d’expiration des annonces.

## Build production

```bash
cd admin
npm run build
npm start
```

Sans variables d’environnement valides, le build Next peut réussir ; l’API admin renverra une erreur 503 tant que `SUPABASE_SERVICE_ROLE_KEY` n’est pas définie sur l’environnement d’exécution.
