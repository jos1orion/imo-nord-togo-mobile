# Plan detaille  -  APK e pro e (Imo Nord Togo)

Document de travail pour **repartition en parallele** entre plusieurs personnes. Chaque piste peut avancer independamment tant que les **dependances** sont respectees.

La section **0** ci-dessous **regroupe tout** ce qui a ete evoque (design, produit, technique, store, securite, qualite). Les sections **1-6** detaillent le meme contenu en **teches pistes A-H**.

---

## 0. Synthese complete  -  tout regroupe (liste unique)

### Design & interface

| # | Recommandation |
|---|----------------|
| D1 | **Identite unifiee** : aligner splash (`app.json`), icene adaptive, couleur primaire UI (ex. bleu `#2563EB` vs vert `#166534` actuel) sur une charte unique (1 primaire + 1 accent). |
| D2 | **Theme Paper + `COLORS`** : fusionner `MD3LightTheme` / `MD3DarkTheme` avec la palette (`src/theme/paperTheme.ts`), une seule source de verite pour boutons, surfaces, texte. |
| D3 | **Typographie** : 1-2 polices (`expo-font` si custom) + module `typography.ts` (title, body, caption, bouton). |
| D4 | **Composants de base** : boutons, en-tetes d'ecran, chips  -  rayons, ombres et **grille d'espacement** (ex. 4/8 px) constante. |
| D5 | **Accueil** : sections lisibles (recherche e filtres e listes) ; preferer **FlatList / SectionList** pour les longs contenus au lieu d'un seul `ScrollView` surcharge. |
| D6 | **Images** : remplacer placeholders generiques ; **LazyImage** partout ; etats skeleton / erreur coherents ; idealement tailles adaptees cete API. |
| D7 | **Mode sombre** : harmoniser `userInterfaceStyle` dans `app.json` avec le toggle theme de l'app + `StatusBar`. |
| D8 | **Micro-interactions** : retour haptique leger sur actions cles ; etats chargement sur les CTA ; transitions deje OK cete stack. |
| D9 | **Accessibilite** : `accessibilityLabel` / `accessibilityRole` sur icenes seules ; contrastes texte sur image (overlay si besoin). |

### Contenu, i18n, donnees affichees

| # | Recommandation |
|---|----------------|
| C1 | **i18n** : supprimer le franeais en dur (ex. `PropertyCard` : e Nouveau e, e Verifie e, e Top e) au profit de `t('...')`. |
| C2 | **Contacts** : WhatsApp / telephones **configurables** (config ou env), pas de numero fictif code en dur (`22890000000`, etc.). |
| C3 | Messages `Alert`, textes de permissions et libelles systeme coherents en franeais. |

### Produit & parcours utilisateur

| # | Recommandation |
|---|----------------|
| P1 | **Onboarding** court (2-3 ecrans) : valeur de l'app, zone geographique, comment contacter. |
| P2 | **Permissions** demandees **au moment de l'usage** (localisation, micro, photos) avec phrase claire FR. |
| P3 | **Compte / auth** : flux clair (oubli mot de passe, erreurs explicites, deconnexion visible) si applicable. |
| P4 | **etats vides** : favoris, messages, recherches, resultats filtres  -  avec CTA. |
| P5 | **Erreurs reseau** : message clair + reessayer (ex. `syncError` / retry deje presents e exploiter partout). |
| P6 | **Deep linking** (optionnel) : ouvrir une annonce depuis un lien (`expo-linking` + Android). |
| P7 | **Hors ligne** : indiquer clairement l'absence de reseau ; cache raisonnable des listes si pertinent. |

### Notifications & Android systeme

| # | Recommandation |
|---|----------------|
| N1 | **Notifications** : canal Android nomme, textes en franeais, pas de sollicitations excessives. |
| N2 | **Sauvegarde Android** : verifier regles backup / exclusion si donnees sensibles locales. |

### Performance & fiabilite code

| # | Recommandation |
|---|----------------|
| T1 | **Virtualisation** des listes longues ; `React.memo` sur items lourds si besoin. |
| T2 | **useMemo** / eviter calculs lourds dans le render  -  audit sur gros ecrans (`HomeScreen`). |
| T3 | **Error boundary** racine (optionnel) pour eviter ecran blanc total. |
| T4 | Pas de code reserve au dev expose en prod (`__DEV__`, donnees de demo sensibles). |
| T5 | **ProGuard / R8** : en release, la chaene Expo/EAS couvre en grande partie  -  valider build release. |

### Play Store, legal, securite

| # | Recommandation |
|---|----------------|
| S1 | **AAB** en production, **APK** pour tests internes ; **incrementer `versionCode`** e chaque soumission. |
| S2 | **Politique de confidentialite** (URL) + formulaire Play (donnees collectees, localisation, etc.) aligne sur la realite. |
| S3 | **Fiche store** : texte / **ASO** (mots-cles naturels), captures telephone (et tablette si supportee), icene lisible en petit. |
| S4 | **Secrets** : Supabase et cles dans **EAS Secrets** / env  -  rien d'inutilement sensible en dur cete client. |
| S5 | **Crash reporting** (optionnel) : Sentry ou equivalent en production. |

### Qualite avant mise en ligne

| # | Recommandation |
|---|----------------|
| Q1 | Tests manuels **plusieurs appareils** (Android 10-14, petit ecran, mode sombre systeme, geste retour). |
| Q2 | Ne pas empiler **trop de SDK analytics** (complexite + confidentialite). |
| Q3 | Ne pas lancer une **refonte visuelle totale** avant charte validee et 2-3 **ecrans pilotes**. |

### Correspondance rapide synthese e pistes A-H

| Zone synthese | Piste(s) |
|---------------|----------|
| D1, D7, D6 (assets) | **A** |
| D2, D7 (theme) | **B** |
| D3 | **C** |
| D4, D8, D9, D3 boutons | **D** |
| C1, C2, C3 | **E** |
| D5, D6 tech, T1, T2 | **F** |
| P1-P7, N1, D8 UX | **G** |
| S1-S5, N2, T4, T5, Q1 | **H** |

---

## 1. Objectifs (definition de e termine e)

| Critere | Detail |
|--------|--------|
| Identite | Couleurs, typo et splash/icene alignes sur une charte unique |
| Coherence UI | Theme unique (Paper + ecrans) + composants reutilisables |
| Qualite pereue | Pas de texte en dur hors i18n sur les ecrans publics ; images soignees |
| Store | AAB prod, `versionCode` incremente, fiche Play + politique confidentialite |
| Robustesse | Erreurs reseau claires ; listes performantes ; optionnel : crash reporting |

---

## 2. Pistes paralleles (qui peut faire quoi)

Les **8 pistes** ci-dessous sont coneues pour limiter les conflits Git : separer par dossier/fichier quand c'est possible.

| ID | Piste | Fichiers / zone typique | Depend de |
|----|--------|-------------------------|-----------|
| A | Charte & assets marque | `assets/`, `app.json` | Aucune (reference pour les autres) |
| B | Theme Paper + `COLORS` | `App.tsx`, `src/theme/`, `src/context/AppContext.tsx` | Idealement les couleurs figees en A |
| C | Typographie | `src/theme/typography.ts` (nouveau), ecrans au fil de l'eau | B (optionnel : peut commencer apres couleurs) |
| D | Composants UI de base | `src/components/` (Button, ScreenHeader, EmptyState&) | B |
| E | i18n & contenu | `src/i18n/`, `PropertyCard.tsx`, chaenes eparses | Aucune |
| F | Performance listes | `HomeScreen.tsx`, autres longs scrolls | Aucune (attention merge avec D si meme ecran) |
| G | Produit : onboarding, permissions, empty states | nouveaux ecrans ou sections, `App.tsx` stack | D partiellement |
| H | Release & conformite | `eas.json`, `app.json`, secrets, Play Console, URL politique | Aucune cete code |

**Reduction des conflits :** une personne sur **F (HomeScreen)** + une autre sur **E (i18n)** = OK si E evite de reformater tout le fichier. Mieux : **E** fait d'abord les petits fichiers (`PropertyCard`, etc.), **F** se concentre sur la structure des listes dans `HomeScreen`.

---

## 3. Detail des teches par piste

### Piste A  -  Charte graphique & assets

- [ ] **A1** Definir palette finale : primaire, secondaire, succes, erreur, surfaces (clair/sombre).
- [ ] **A2** Mettre e jour `app.json` : `splash.backgroundColor`, `android.adaptiveIcon.backgroundColor` en accord avec A1.
- [ ] **A3** Remplacer ou ajuster `assets/icon.png`, `adaptive-icon.png`, `splash-icon.png` (lisibilite petit format).
- [ ] **A4** Documenter en 5 lignes la charte (dans ce fichier ou un `BRAND.md` court) : codes hex + usage (primaire = CTA, etc.).

**Livrable :** charte ecrite + assets + `app.json` coherents.

---

### Piste B  -  Theme React Native Paper + alignement `COLORS`

- [ ] **B1** Creer `src/theme/paperTheme.ts` : `lightTheme` / `darkTheme` bases sur `MD3LightTheme` / `MD3DarkTheme` avec `colors` issus de `COLORS` + palette A.
- [ ] **B2** Dans `App.tsx`, passer `theme={lightTheme}` / `darkTheme` au `PaperProvider` selon `useApp().theme`.
- [ ] **B3** Remplacer les couleurs en dur dans la tab bar (`#2563EB`, etc.) par les tokens du theme ou `COLORS`.
- [ ] **B4** Verifier `app.json` : `userInterfaceStyle` vs mode sombre app (ex. `"automatic"` si vous voulez suivre le systeme).

**Livrable :** un seul endroit pour primaire / surface / texte en mode clair et sombre.

---

### Piste C  -  Typographie

- [ ] **C1** Choisir 1-2 polices (Google Fonts compatibles Expo ou systeme uniquement).
- [ ] **C2** Ajouter `expo-font` + chargement au demarrage (`App.tsx` ou `AppProvider`) si police custom.
- [ ] **C3** Exporter `typography.ts` : `title`, `subtitle`, `body`, `caption`, `button` (taille + graisse + lineHeight).
- [ ] **C4** Migrer progressivement les ecrans prioritaires : Home, detail bien, profil.

**Livrable :** module typo + 2-3 ecrans references.

---

### Piste D  -  Composants reutilisables

- [ ] **D1** `PrimaryButton` / `SecondaryButton` (taille min 44 pt touch, etat disabled/loading).
- [ ] **D2** `ScreenHeader` (titre, retour, action droite) pour ecrans stack.
- [ ] **D3** `EmptyState` (illustration ou icene + titre + sous-texte + CTA).
- [ ] **D4** `ErrorBanner` ou `OfflineBanner` (reutilisable apres sync erreur).
- [ ] **D5** Harmoniser `borderRadius` et espacements (constantes `spacing.ts`).
- [ ] **D6** Accessibilite : labels/reles sur icenes seules ; verifier contrastes (texte sur image).

**Livrable :** dossier `src/components/ui/` (ou equivalent) utilise sur au moins 3 ecrans.

---

### Piste E  -  Internationalisation & textes

- [ ] **E1** Inventorier les chaenes en dur (ex. `PropertyCard` : e Nouveau e, e Verifie e, e Top e).
- [ ] **E2** Ajouter les cles dans `src/i18n` + traductions FR (et EN si prevu).
- [ ] **E3** Remplacer progressivement par `t('...')`.
- [ ] **E4** Verifier les messages `Alert`, permissions, et textes Play-oriented (description app) hors repo si besoin.
- [ ] **E5** Remplacer contacts/WhatsApp codes en dur par configuration (constante centralisee, `extra` Expo, ou remote config).

**Livrable :** plus de franeais en dur sur les composants liste/carte prioritaires ; contacts configurables.

---

### Piste F  -  Performance (listes & medias)

- [ ] **F1** Analyser `HomeScreen` : remplacer les longues listes dans un seul `ScrollView` par `FlatList` / `SectionList` oe pertinent.
- [ ] **F2** Memoriser les items lourds (`React.memo` sur `PropertyCard` si necessaire).
- [ ] **F3** Uniformiser le chargement image (`LazyImage`) + tailles / placeholders de marque.
- [ ] **F4** eviter les calculs lourds non memorises dans le render (deje partiellement avec `useMemo`  -  audit).
- [ ] **F5** (Optionnel) Error boundary React e la racine pour limiter les ecrans blancs en cas d'exception.

**Livrable :** scroll fluide avec ~50+ annonces simulees sur appareil milieu de gamme.

---

### Piste G  -  Parcours utilisateur e pro e

- [ ] **G1** Onboarding 2-3 ecrans (stack initial ou modal premiere ouverture + `AsyncStorage`).
- [ ] **G2** Demander localisation / micro / photos **au moment de l'usage** avec texte FR explicite.
- [ ] **G3** Empty states : favoris, messages, resultats de recherche (utiliser `EmptyState` D3).
- [ ] **G4** Flux erreur reseau : bouton reessayer, message clair (lie au `syncError` existant si applicable).
- [ ] **G5** (Optionnel) Deep linking : ouvrir `PropertyDetail` depuis une URL (`expo-linking` + config Android).
- [ ] **G6** Micro-interactions : `expo-haptics` (ou equivalent) sur actions principales ; spinners / disabled sur CTA pendant chargement.
- [ ] **G7** Message **hors ligne** visible quand pas de reseau (ecoute NetInfo ou erreurs fetch).

**Livrable :** premiere ouverture comprise sans confusion ; permissions justifiees.

---

### Piste H  -  Build, securite, Play Store

- [ ] **H1** Verifier cles Supabase : variables d'environnement / EAS Secrets, pas de secrets inutiles cete client.
- [ ] **H2** Process release : increment `version` + `android.versionCode` avant chaque build store.
- [ ] **H3** Build `production` (AAB) pour Play ; `preview` (APK) pour tests internes (`eas.json` deje esquisse).
- [ ] **H4** Page **Politique de confidentialite** (URL) + alignement formulaire Play (donnees, localisation, etc.).
- [ ] **H5** (Optionnel) Sentry ou equivalent pour crashes production.
- [ ] **H6** Captures d'ecran store + texte court optimise (hors code, mais teche assignable).
- [ ] **H7** Texte fiche Play / **ASO** (titre, description, mots-cles naturels) ; captures tablette si l'app les supporte.
- [ ] **H8** Verifier regles **backup Android** (`app.json` / config native) si stockage sensible local.
- [ ] **H9** Audit prod : pas de donnees de demo sensibles ; code `__DEV__` sans effet visible en release.

**Livrable :** checklist pre-soumission Play cochee.

---

## 4. Ordre recommande (jalons)

```
Semaine / lot 1
  A (charte)                              e
  E (i18n cartes & petits fichiers)        e
  H (secrets + process version)            e

Lot 2 (des A fige)
  B (theme Paper)  e C (typo)  e D (composants)

Lot 3 (parallele)
  F (perf Home)      -  coordonner merge avec D sur Home si besoin
  G (onboarding)     -  apres D1-D3 si vous reutilisez les composants
```

---

## 5. Tableau de suivi rapide (copier dans un tableau / Notion)

| Teche | Assigne | Statut | PR / branche | Notes |
|-------|---------|--------|--------------|-------|
| A1-A4 | |  -  | | |
| B1-B4 | |  -  | | |
| C1-C4 | |  -  | | |
| D1-D6 | |  -  | | |
| E1-E5 | |  -  | | |
| F1-F5 | |  -  | | |
| G1-G7 | |  -  | | |
| H1-H9 | |  -  | | |

---

## 6. References code existant

- Theme / navigation : `App.tsx`
- Couleurs : `src/theme/colors.ts`
- Contexte (theme clair/sombre, i18n) : `src/context/AppContext.tsx`
- Carte annonce : `src/components/PropertyCard.tsx`
- Accueil (gros fichier) : `src/screens/HomeScreen.tsx`
- Config Expo / Android : `app.json`, `eas.json`

---

*Derniere mise e jour : synthese e0 = tout ce qui a ete mentionne dans les echanges ; e1-6 = plan operationnel pistes A-H.*
