# 🏠 Imo Nord Togo - Application mobile immobilière

Application mobile pour la gestion immobilière à Kara, Togo.

## 📱 Fonctionnalités

### Pour les utilisateurs
- 🏠 **Catalogue de biens** - Maisons, appartements, terrains et boutiques à Kara et environs
- 🔍 **Recherche avancée** - Filtrez par type, prix, ville et quartier
- 🖼️ **Galerie photo** - Consultez et faites défiler les photos d'une annonce
- 📞 **Contact direct** - Appelez ou contactez l'agent par WhatsApp
- 🔐 **Authentification** - Inscription avec validation d'email et récupération du mot de passe
- 🔔 **Notifications** - Suivez les mises à jour de vos annonces et demandes

### Pour les administrateurs
- 📊 **Tableau de bord** - Suivez les données de l'activité
- ✅ **Validation des agents** - Vérifiez, approuvez ou refusez les demandes
- ⚡ **Validation groupée** - Approuvez plusieurs agents en une seule action
- 👥 **Gestion des utilisateurs** - Modifiez les rôles et les profils
- 🏘️ **Gestion des annonces** - Contrôlez les annonces et leur statut de publication

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

# Construire l'APK de test
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

- `eas build -p android --profile development` génère un dev client.
- Pour une APK qui démarre sans Expo Go, utilisez le profil `preview`.
- Le build Android local doit utiliser JDK 17. Avec Java 25, Gradle peut échouer.

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
| `CAMERA` | Prendre des photos de propriétés |
| `RECORD_AUDIO` | Utiliser la recherche vocale |

## 📞 Contact

- **Email** : [kondgbandi@gmail.com](mailto:kondgbandi@gmail.com)
- **Téléphone** : +228 93 57 62 98
- **Adresse** : Avenue de la Libération, Kara, Togo

## 📄 Licence

© 2026 Imo Nord Togo - Tous droits réservés
