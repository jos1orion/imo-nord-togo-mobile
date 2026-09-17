# Plan d�taill�  APK � pro � (Imo Nord Togo)

Document de travail pour **r�partition en parall�le** entre plusieurs personnes. Chaque piste peut avancer ind�pendamment tant que les **d�pendances** sont respect�es.

La section **0** ci-dessous **regroupe tout** ce qui a �t� �voqu� (design, produit, technique, store, s�curit�, qualit�). Les sections **1 � 6** d�taillent le m�me contenu en **t�ches pistes AH**.

---

## 0. Synth�se compl�te  tout regroup� (liste unique)

### Design & interface

| # | Recommandation |
|---|----------------|
| D1 | **Identit� unifi�e** : aligner splash (`app.json`), ic�ne adaptive, couleur primaire UI (ex. bleu `#2563EB` vs vert `#166534` actuel) sur une charte unique (1 primaire + 1 accent). |
| D2 | **Th�me Paper + `COLORS`** : fusionner `MD3LightTheme` / `MD3DarkTheme` avec la palette (`src/theme/paperTheme.ts`), une seule source de v�rit� pour boutons, surfaces, texte. |
| D3 | **Typographie** : 12 polices (`expo-font` si custom) + module `typography.ts` (title, body, caption, bouton). |
| D4 | **Composants de base** : boutons, en-t�tes d�cran, chips  rayons, ombres et **grille despacement** (ex. 4/8 px) constante. |
| D5 | **Accueil** : sections lisibles (recherche � filtres � listes) ; pr�f�rer **FlatList / SectionList** pour les longs contenus au lieu dun seul `ScrollView` surcharg�. |
| D6 | **Images** : remplacer placeholders g�n�riques ; **LazyImage** partout ; �tats skeleton / erreur coh�rents ; id�alement tailles adapt�es c�t� API. |
| D7 | **Mode sombre** : harmoniser `userInterfaceStyle` dans `app.json` avec le toggle th�me de lapp + `StatusBar`. |
| D8 | **Micro-interactions** : retour haptique l�ger sur actions cl�s ; �tats chargement sur les CTA ; transitions d�j� OK c�t� stack. |
| D9 | **Accessibilit�** : `accessibilityLabel` / `accessibilityRole` sur ic�nes seules ; contrastes texte sur image (overlay si besoin). |

### Contenu, i18n, donn�es affich�es

| # | Recommandation |
|---|----------------|
| C1 | **i18n** : supprimer le fran�ais en dur (ex. `PropertyCard` : � Nouveau �, � V�rifi� �, � Top �) au profit de `t('...')`. |
| C2 | **Contacts** : WhatsApp / t�l�phones **configurables** (config ou env), pas de num�ro fictif cod� en dur (`22890000000`, etc.). |
| C3 | Messages `Alert`, textes de permissions et libell�s syst�me coh�rents en fran�ais. |

### Produit & parcours utilisateur

| # | Recommandation |
|---|----------------|
| P1 | **Onboarding** court (23 �crans) : valeur de lapp, zone g�ographique, comment contacter. |
| P2 | **Permissions** demand�es **au moment de lusage** (localisation, micro, photos) avec phrase claire FR. |
| P3 | **Compte / auth** : flux clair (oubli mot de passe, erreurs explicites, d�connexion visible) si applicable. |
| P4 | **�tats vides** : favoris, messages, recherches, r�sultats filtres  avec CTA. |
| P5 | **Erreurs r�seau** : message clair + r�essayer (ex. `syncError` / retry d�j� pr�sents � exploiter partout). |
| P6 | **Deep linking** (optionnel) : ouvrir une annonce depuis un lien (`expo-linking` + Android). |
| P7 | **Hors ligne** : indiquer clairement labsence de r�seau ; cache raisonnable des listes si pertinent. |

### Notifications & Android syst�me

| # | Recommandation |
|---|----------------|
| N1 | **Notifications** : canal Android nomm�, textes en fran�ais, pas de sollicitations excessives. |
| N2 | **Sauvegarde Android** : v�rifier r�gles backup / exclusion si donn�es sensibles locales. |

### Performance & fiabilit� code

| # | Recommandation |
|---|----------------|
| T1 | **Virtualisation** des listes longues ; `React.memo` sur items lourds si besoin. |
| T2 | **useMemo** / �viter calculs lourds dans le render  audit sur gros �crans (`HomeScreen`). |
| T3 | **Error boundary** racine (optionnel) pour �viter �cran blanc total. |
| T4 | Pas de code r�serv� au dev expos� en prod (`__DEV__`, donn�es de d�mo sensibles). |
| T5 | **ProGuard / R8** : en release, la cha�ne Expo/EAS couvre en grande partie  valider build release. |

### Play Store, l�gal, s�curit�

| # | Recommandation |
|---|----------------|
| S1 | **AAB** en production, **APK** pour tests internes ; **incr�menter `versionCode`** � chaque soumission. |
| S2 | **Politique de confidentialit�** (URL) + formulaire Play (donn�es collect�es, localisation, etc.) align� sur la r�alit�. |
| S3 | **Fiche store** : texte / **ASO** (mots-cl�s naturels), captures t�l�phone (et tablette si support�e), ic�ne lisible en petit. |
| S4 | **Secrets** : Supabase et cl�s dans **EAS Secrets** / env  rien dinutilement sensible en dur c�t� client. |
| S5 | **Crash reporting** (optionnel) : Sentry ou �quivalent en production. |

### Qualit� avant mise en ligne

| # | Recommandation |
|---|----------------|
| Q1 | Tests manuels **plusieurs appareils** (Android 1014, petit �cran, mode sombre syst�me, geste retour). |
| Q2 | Ne pas empiler **trop de SDK analytics** (complexit� + confidentialit�). |
| Q3 | Ne pas lancer une **refonte visuelle totale** avant charte valid�e et 23 **�crans pilotes**. |

### Correspondance rapide synth�se � pistes AH

| Zone synth�se | Piste(s) |
|---------------|----------|
| D1, D7, D6 (assets) | **A** |
| D2, D7 (th�me) | **B** |
| D3 | **C** |
| D4, D8, D9, D3 boutons | **D** |
| C1, C2, C3 | **E** |
| D5, D6 tech, T1, T2 | **F** |
| P1P7, N1, D8 UX | **G** |
| S1S5, N2, T4, T5, Q1 | **H** |

---

## 1. Objectifs (d�finition de � termin� �)

| Crit�re | D�tail |
|--------|--------|
| Identit� | Couleurs, typo et splash/ic�ne align�s sur une charte unique |
| Coh�rence UI | Th�me unique (Paper + �crans) + composants r�utilisables |
| Qualit� per�ue | Pas de texte en dur hors i18n sur les �crans publics ; images soign�es |
| Store | AAB prod, `versionCode` incr�ment�, fiche Play + politique confidentialit� |
| Robustesse | Erreurs r�seau claires ; listes performantes ; optionnel : crash reporting |

---

## 2. Pistes parall�les (qui peut faire quoi)

Les **8 pistes** ci-dessous sont con�ues pour limiter les conflits Git : s�parer par dossier/fichier quand cest possible.

| ID | Piste | Fichiers / zone typique | D�pend de |
|----|--------|-------------------------|-----------|
| A | Charte & assets marque | `assets/`, `app.json` | Aucune (r�f�rence pour les autres) |
| B | Th�me Paper + `COLORS` | `App.tsx`, `src/theme/`, `src/context/AppContext.tsx` | Id�alement les couleurs fig�es en A |
| C | Typographie | `src/theme/typography.ts` (nouveau), �crans au fil de leau | B (optionnel : peut commencer apr�s couleurs) |
| D | Composants UI de base | `src/components/` (Button, ScreenHeader, EmptyState&) | B |
| E | i18n & contenu | `src/i18n/`, `PropertyCard.tsx`, cha�nes �parses | Aucune |
| F | Performance listes | `HomeScreen.tsx`, autres longs scrolls | Aucune (attention merge avec D si m�me �cran) |
| G | Produit : onboarding, permissions, empty states | nouveaux �crans ou sections, `App.tsx` stack | D partiellement |
| H | Release & conformit� | `eas.json`, `app.json`, secrets, Play Console, URL politique | Aucune c�t� code |

**R�duction des conflits :** une personne sur **F (HomeScreen)** + une autre sur **E (i18n)** = OK si E �vite de reformater tout le fichier. Mieux : **E** fait dabord les petits fichiers (`PropertyCard`, etc.), **F** se concentre sur la structure des listes dans `HomeScreen`.

---

## 3. D�tail des t�ches par piste

### Piste A  Charte graphique & assets

- [ ] **A1** D�finir palette finale : primaire, secondaire, succ�s, erreur, surfaces (clair/sombre).
- [ ] **A2** Mettre � jour `app.json` : `splash.backgroundColor`, `android.adaptiveIcon.backgroundColor` en accord avec A1.
- [ ] **A3** Remplacer ou ajuster `assets/icon.png`, `adaptive-icon.png`, `splash-icon.png` (lisibilit� petit format).
- [ ] **A4** Documenter en 5 lignes la charte (dans ce fichier ou un `BRAND.md` court) : codes hex + usage (primaire = CTA, etc.).

**Livrable :** charte �crite + assets + `app.json` coh�rents.

---

### Piste B  Th�me React Native Paper + alignement `COLORS`

- [ ] **B1** Cr�er `src/theme/paperTheme.ts` : `lightTheme` / `darkTheme` bas�s sur `MD3LightTheme` / `MD3DarkTheme` avec `colors` issus de `COLORS` + palette A.
- [ ] **B2** Dans `App.tsx`, passer `theme={lightTheme}` / `darkTheme` au `PaperProvider` selon `useApp().theme`.
- [ ] **B3** Remplacer les couleurs en dur dans la tab bar (`#2563EB`, etc.) par les tokens du th�me ou `COLORS`.
- [ ] **B4** V�rifier `app.json` : `userInterfaceStyle` vs mode sombre app (ex. `"automatic"` si vous voulez suivre le syst�me).

**Livrable :** un seul endroit pour primaire / surface / texte en mode clair et sombre.

---

### Piste C  Typographie

- [ ] **C1** Choisir 12 polices (Google Fonts compatibles Expo ou syst�me uniquement).
- [ ] **C2** Ajouter `expo-font` + chargement au d�marrage (`App.tsx` ou `AppProvider`) si police custom.
- [ ] **C3** Exporter `typography.ts` : `title`, `subtitle`, `body`, `caption`, `button` (taille + graisse + lineHeight).
- [ ] **C4** Migrer progressivement les �crans prioritaires : Home, d�tail bien, profil.

**Livrable :** module typo + 23 �crans r�f�rences.

---

### Piste D  Composants r�utilisables

- [ ] **D1** `PrimaryButton` / `SecondaryButton` (taille min 44 pt touch, �tat disabled/loading).
- [ ] **D2** `ScreenHeader` (titre, retour, action droite) pour �crans stack.
- [ ] **D3** `EmptyState` (illustration ou ic�ne + titre + sous-texte + CTA).
- [ ] **D4** `ErrorBanner` ou `OfflineBanner` (r�utilisable apr�s sync erreur).
- [ ] **D5** Harmoniser `borderRadius` et espacements (constantes `spacing.ts`).
- [ ] **D6** Accessibilit� : labels/r�les sur ic�nes seules ; v�rifier contrastes (texte sur image).

**Livrable :** dossier `src/components/ui/` (ou �quivalent) utilis� sur au moins 3 �crans.

---

### Piste E  Internationalisation & textes

- [ ] **E1** Inventorier les cha�nes en dur (ex. `PropertyCard` : � Nouveau �, � V�rifi� �, � Top �).
- [ ] **E2** Ajouter les cl�s dans `src/i18n` + traductions FR (et EN si pr�vu).
- [ ] **E3** Remplacer progressivement par `t('...')`.
- [ ] **E4** V�rifier les messages `Alert`, permissions, et textes Play-oriented (description app) hors repo si besoin.
- [ ] **E5** Remplacer contacts/WhatsApp cod�s en dur par configuration (constante centralis�e, `extra` Expo, ou remote config).

**Livrable :** plus de fran�ais en dur sur les composants liste/carte prioritaires ; contacts configurables.

---

### Piste F  Performance (listes & m�dias)

- [ ] **F1** Analyser `HomeScreen` : remplacer les longues listes dans un seul `ScrollView` par `FlatList` / `SectionList` o� pertinent.
- [ ] **F2** M�moriser les items lourds (`React.memo` sur `PropertyCard` si n�cessaire).
- [ ] **F3** Uniformiser le chargement image (`LazyImage`) + tailles / placeholders de marque.
- [ ] **F4** �viter les calculs lourds non m�moris�s dans le render (d�j� partiellement avec `useMemo`  audit).
- [ ] **F5** (Optionnel) Error boundary React � la racine pour limiter les �crans blancs en cas dexception.

**Livrable :** scroll fluide avec ~50+ annonces simul�es sur appareil milieu de gamme.

---

### Piste G  Parcours utilisateur � pro �

- [ ] **G1** Onboarding 23 �crans (stack initial ou modal premi�re ouverture + `AsyncStorage`).
- [ ] **G2** Demander localisation / micro / photos **au moment de lusage** avec texte FR explicite.
- [ ] **G3** Empty states : favoris, messages, r�sultats de recherche (utiliser `EmptyState` D3).
- [ ] **G4** Flux erreur r�seau : bouton r�essayer, message clair (li� au `syncError` existant si applicable).
- [ ] **G5** (Optionnel) Deep linking : ouvrir `PropertyDetail` depuis une URL (`expo-linking` + config Android).
- [ ] **G6** Micro-interactions : `expo-haptics` (ou �quivalent) sur actions principales ; spinners / disabled sur CTA pendant chargement.
- [ ] **G7** Message **hors ligne** visible quand pas de r�seau (�coute NetInfo ou erreurs fetch).

**Livrable :** premi�re ouverture comprise sans confusion ; permissions justifi�es.

---

### Piste H  Build, s�curit�, Play Store

- [ ] **H1** V�rifier cl�s Supabase : variables denvironnement / EAS Secrets, pas de secrets inutiles c�t� client.
- [ ] **H2** Process release : incr�ment `version` + `android.versionCode` avant chaque build store.
- [ ] **H3** Build `production` (AAB) pour Play ; `preview` (APK) pour tests internes (`eas.json` d�j� esquiss�).
- [ ] **H4** Page **Politique de confidentialit�** (URL) + alignement formulaire Play (donn�es, localisation, etc.).
- [ ] **H5** (Optionnel) Sentry ou �quivalent pour crashes production.
- [ ] **H6** Captures d�cran store + texte court optimis� (hors code, mais t�che assignable).
- [ ] **H7** Texte fiche Play / **ASO** (titre, description, mots-cl�s naturels) ; captures tablette si lapp les supporte.
- [ ] **H8** V�rifier r�gles **backup Android** (`app.json` / config native) si stockage sensible local.
- [ ] **H9** Audit prod : pas de donn�es de d�mo sensibles ; code `__DEV__` sans effet visible en release.

**Livrable :** checklist pr�-soumission Play coch�e.

---

## 4. Ordre recommand� (jalons)

```
Semaine / lot 1
  A (charte)                              �
  E (i18n cartes & petits fichiers)        �
  H (secrets + process version)            �

Lot 2 (d�s A fig�)
  B (th�me Paper)  � C (typo)  � D (composants)

Lot 3 (parall�le)
  F (perf Home)      coordonner merge avec D sur Home si besoin
  G (onboarding)     apr�s D1D3 si vous r�utilisez les composants
```

---

## 5. Tableau de suivi rapide (copier dans un tableau / Notion)

| T�che | Assign� | Statut | PR / branche | Notes |
|-------|---------|--------|--------------|-------|
| A1A4 | |  | | |
| B1B4 | |  | | |
| C1C4 | |  | | |
| D1D6 | |  | | |
| E1E5 | |  | | |
| F1F5 | |  | | |
| G1G7 | |  | | |
| H1H9 | |  | | |

---

## 6. R�f�rences code existant

- Th�me / navigation : `App.tsx`
- Couleurs : `src/theme/colors.ts`
- Contexte (th�me clair/sombre, i18n) : `src/context/AppContext.tsx`
- Carte annonce : `src/components/PropertyCard.tsx`
- Accueil (gros fichier) : `src/screens/HomeScreen.tsx`
- Config Expo / Android : `app.json`, `eas.json`

---

*Derni�re mise � jour : synth�se �0 = tout ce qui a �t� mentionn� dans les �changes ; �16 = plan op�rationnel pistes AH.*
