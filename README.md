# 🏠 Imo Nord Togo - Application Mobile Immobilière

Application mobile pour la gestion immobilière à Kara, Togo.

## 📱 Fonctionnalités

### Pour les utilisateurs
- 🗺️ **Carte interactive** - Localisez les biens sur la carte de Kara
- 🏠 **Catalogue de biens** - Maisons, appartements et terrains (Kara et environs)
- 🔍 **Recherche avancée** - Filtrez par type, prix, localisation
- 📞 **Contact direct** - Appelez ou envoyez un email aux propriétaires

### Pour les administrateurs
- 📊 **Dashboard** - Statistiques en temps réel
- ✅ **Validation** - Approuvez ou rejetez les annonces
- 👥 **Gestion clients** - Suivez vos clients

## 🚀 Installation

```bash
# Installer les dépendances
npm install

# Lancer en développement
npm run mobile:start
```

## 🧑‍💼 Back-office (web)

Le back-office Next.js se trouve dans `admin/`.

```bash
# Lancer le back-office en local
npm run admin:dev
```

Voir aussi `admin/README.md` pour la configuration des variables d’environnement Supabase.

## 📦 Générer l'APK

### Option 1 : EAS Build (Recommandé)

```bash
# Installer EAS CLI
npm install -g eas-cli

# Connecter votre compte Expo
eas login

# Construire l'APK
eas build -p android --profile apk

# Alternative equivalente
eas build -p android --profile preview
```

### Option 2 : Build local

```bash
# Pré-requis : Android Studio et JDK 17

# Générer le bundle
npx expo prebuild

# Construire l'APK
cd android
./gradlew assembleRelease
```

### Attention

- `eas build -p android --profile development` genere un dev client.
- Pour une APK qui demarre sans Expo Go, utilisez `apk` ou `preview`.
- Le build Android local doit utiliser JDK 17. Avec Java 25, Gradle echoue.

## 📋 Checklist Google Play Store

- [x] Politique de confidentialité
- [x] Conditions d'utilisation
- [x] Permissions justifiées
- [x] Classification contenu (3+)
- [ ] Captures d'écran (min. 2)
- [ ] Icône 512x512
- [ ] Description store

## 📁 Structure du projet

```
imo-nord-togo-mobile/
├── src/
│   ├── components/     # Composants réutilisables
│   ├── screens/        # Écrans de l'application
│   ├── context/        # Contexte React (state management)
│   ├── types/          # Types TypeScript
│   └── data/           # Données mock
├── assets/             # Images et ressources
├── google-play/        # Fichiers pour Google Play
├── admin/              # Back-office Next.js
├── app.json            # Configuration Expo
├── eas.json            # Configuration EAS Build
└── package.json        # Dépendances
```

## 🔐 Permissions requises

| Permission | Justification |
|------------|---------------|
| `ACCESS_FINE_LOCATION` | Localiser les biens sur la carte |
| `ACCESS_COARSE_LOCATION` | Localisation approximative |
| `CAMERA` | Prendre des photos de propriétés |
| `READ_EXTERNAL_STORAGE` | Accéder aux photos |
| `WRITE_EXTERNAL_STORAGE` | Sauvegarder les images |

## 📞 Contact

- **Email** : contact@imonordtogo.com
- **Téléphone** : +228 90 00 00 00
- **Adresse** : Avenue de la Libération, Kara, Togo

## 📄 Licence

© 2024 Imo Nord Togo - Tous droits réservés
