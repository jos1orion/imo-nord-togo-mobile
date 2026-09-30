# Imo Nord Togo — Back-office web

Application Next.js pour la gestion (biens, locataires, contrats, etc.), connectée au même projet **Supabase** que l’app mobile.

## Prérequis

- Node.js 18+
- Un projet Supabase avec les tables attendues (`properties`, `profiles`, etc.)

## Configuration

1. Copier `admin/.env.local.example` vers `admin/.env.local`.
2. Renseigner `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` et `SUPABASE_SERVICE_ROLE_KEY` (cette dernière sert uniquement à l’API `POST /api/admin/create-user`).

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

Ouvrir [http://localhost:3000](http://localhost:3000), se connecter avec un compte ayant une ligne dans `profiles` et un rôle staff `ADMIN`, `AGENT` ou `ACCOUNTANT`. Les comptes marketplace (`USER`) sont refusés.

## Rôles et menu

Le menu et l’accès aux URLs sont filtrés selon le rôle (voir `lib/rbac.ts` et `lib/nav.ts`).

## Build production

```bash
cd admin
npm run build
npm start
```

Sans variables d’environnement valides, le build Next peut réussir ; l’API admin renverra une erreur 503 tant que `SUPABASE_SERVICE_ROLE_KEY` n’est pas définie sur l’environnement d’exécution.

## Pages publiques pour Google Play

Le site expose les pages l?gales sans connexion, m?me si le reste du back-office est prot?g? :

- Politique de confidentialit? : `/privacy`
- Conditions d?utilisation : `/terms`

Apr?s le d?ploiement Vercel, utiliser l?URL publique compl?te de `/privacy` dans la fiche Google Play et dans la section S?curit? des donn?es. Tout changement doit ?tre pouss? sur Git pour d?clencher le d?ploiement Vercel connect? au d?p?t.
