import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useApp } from '../context/AppContext';
import COLORS from '../theme/colors';
import { getContactEmail, getContactPhoneDigits } from '../constants/appConfig';

interface LegalScreenProps {
  type: 'privacy' | 'terms';
  onClose: () => void;
}

const LegalScreen: React.FC<LegalScreenProps> = ({ type, onClose }) => {
  const { language, theme } = useApp();
  const isDark = theme === 'dark';
  const content =
    type === 'privacy'
      ? language === 'en'
        ? privacyContentEn
        : privacyContentFr
      : language === 'en'
        ? termsContentEn
        : termsContentFr;
  const title =
    type === 'privacy'
      ? language === 'en'
        ? 'Privacy policy'
        : 'Politique de confidentialite'
      : language === 'en'
        ? 'Terms of use'
        : "Conditions d'utilisation";

  return (
    <SafeAreaView style={[styles.container, isDark && styles.containerDark]}>
      <View style={[styles.header, isDark && styles.headerDark]}>
        <TouchableOpacity onPress={onClose} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, isDark && styles.headerTitleDark]}>{title}</Text>
        <View style={styles.placeholder} />
      </View>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <Text style={[styles.textContent, isDark && styles.textContentDark]}>{content}</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const privacyContentFr = `
POLITIQUE DE CONFIDENTIALITE - IMO NORD TOGO

Derniere mise a jour : fevrier 2024

1. INTRODUCTION

Bienvenue dans l'application Imo Nord Togo. Cette politique de confidentialite explique comment nous collectons, utilisons et protegeons vos informations personnelles lorsque vous utilisez notre application.

2. INFORMATIONS COLLECTEES

Informations fournies par l'utilisateur :
- Nom complet - pour identifier les proprietaires
- Adresse e-mail - pour la communication
- Numero de telephone - pour faciliter les contacts
- Photos de biens - pour afficher les annonces

Informations collectees automatiquement :
- Donnees d'utilisation - pour ameliorer l'experience

3. UTILISATION DES INFORMATIONS

Vos informations sont utilisees pour :
- Faciliter la vente et la location de biens
- Permettre la communication entre utilisateurs
- Ameliorer nos services

4. PARTAGE DES INFORMATIONS

Nous partageons uniquement :
- Les coordonnees avec les parties interessees par un bien
- Les photos et descriptions des annonces

5. PERMISSIONS REQUISES

L'application peut demander :
- Camera - prendre des photos de biens
- Stockage - enregistrer des images

6. SECURITE DES DONNEES

Nous mettons en oeuvre des mesures de securite adaptees pour proteger vos informations.

7. VOS DROITS

Vous pouvez :
- Acceder a vos donnees personnelles
- Demander leur modification ou suppression
- Demander la suppression de votre compte

8. CONTACT

E-mail : ${getContactEmail()}
Telephone : +${getContactPhoneDigits()}
Adresse : Avenue de la Liberation, Kara, Togo

Imo Nord Togo - votre partenaire immobilier a Kara.
`;

const termsContentFr = `
CONDITIONS D'UTILISATION - IMO NORD TOGO

Derniere mise a jour : fevrier 2024

1. ACCEPTATION DES CONDITIONS

En telechargeant et en utilisant l'application Imo Nord Togo, vous acceptez d'etre lie par ces conditions.

2. DESCRIPTION DU SERVICE

Imo Nord Togo est une plateforme de mise en relation pour :
- La vente de biens immobiliers
- La location de biens
- La publication d'annonces immobilieres

3. INSCRIPTION ET COMPTE

- Vous devez fournir des informations exactes
- Vous etes responsable de la securite de votre compte
- Vous devez avoir au moins 18 ans

4. UTILISATION ACCEPTABLE

Vous vous engagez a :
- Publier des annonces veridiques
- Ne pas publier de contenu inapproprie
- Respecter les droits des autres utilisateurs
- Utiliser l'application conformement aux lois

5. PROPRIETE INTELLECTUELLE

- Le contenu de la plateforme appartient a Imo Nord Togo ou a ses concedants
- Les photos restent la propriete de leurs auteurs
- Toute utilisation commerciale est interdite sans autorisation

6. RESPONSABILITES

- Imo Nord Togo n'est pas partie aux transactions entre utilisateurs
- Nous ne garantissons pas l'exactitude des annonces
- Nous pouvons supprimer tout contenu inapproprie

7. LIMITATION DE RESPONSABILITE

Imo Nord Togo ne peut etre tenu responsable des :
- Dommages directs ou indirects
- Pertes financieres liees aux transactions
- Contenus publies par les utilisateurs

8. RESILIATION

Nous pouvons suspendre ou supprimer votre compte en cas de non-respect des conditions.

9. LOI APPLICABLE

Ces conditions sont regies par les lois de la Republique togolaise.

10. CONTACT

E-mail : ${getContactEmail()}
Telephone : +${getContactPhoneDigits()}
Adresse : Avenue de la Liberation, Kara, Togo

Imo Nord Togo - votre partenaire immobilier a Kara.
`;

const privacyContentEn = `
PRIVACY POLICY - IMO NORD TOGO

Last update: February 2024

1. INTRODUCTION

This policy explains how we collect, use, and protect your personal data when you use Imo Nord Togo.

2. INFORMATION COLLECTED

Information you provide:
- Full name - to identify property owners
- Email address - for communication
- Phone number - for contact between users
- Property photos - to display listings

Collected automatically:
- Usage data - to improve the app

3. USE OF INFORMATION

We use your data to:
- Facilitate sales and rentals
- Enable communication between users
- Improve our services

4. DATA SHARING

We only share:
- Contact details with parties interested in a listing
- Listing photos and descriptions as shown in the app

5. PERMISSIONS

The app may request:
- Camera
- Storage (photos)

6. DATA SECURITY

We apply reasonable technical and organizational measures to protect your information.

7. YOUR RIGHTS

You may:
- Access your personal data
- Request correction or deletion
- Request account deletion

8. CONTACT

Email: ${getContactEmail()}
Phone: +${getContactPhoneDigits()}
Address: Avenue de la Liberation, Kara, Togo
`;

const termsContentEn = `
TERMS OF USE - IMO NORD TOGO

Last update: February 2024

1. ACCEPTANCE

By using the app, you agree to these terms.

2. SERVICE DESCRIPTION

The platform helps with:
- Property sales
- Rentals
- Publishing listings

3. ACCOUNT

- Provide accurate information
- Keep your account secure
- Minimum age: 18

4. ACCEPTABLE USE

You agree to:
- Publish truthful listings
- Avoid inappropriate content
- Respect other users' rights
- Follow applicable laws

5. INTELLECTUAL PROPERTY

- Platform content belongs to Imo Nord Togo or its licensors
- Photos remain the property of their authors
- No commercial use without permission

6. LIABILITY

- We are not responsible for transactions between users
- We do not guarantee listing accuracy
- We may remove inappropriate content

7. LIMITATION OF LIABILITY

We are not liable for:
- Direct or indirect damages
- Financial losses
- User-generated content

8. TERMINATION

We may suspend accounts for violations.

9. GOVERNING LAW

These terms are governed by the laws of Togo.

10. CONTACT

Email: ${getContactEmail()}
Phone: +${getContactPhoneDigits()}
Address: Avenue de la Liberation, Kara, Togo
`;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.card,
  },
  containerDark: {
    backgroundColor: '#0F172A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderSoft,
  },
  headerDark: {
    borderBottomColor: '#334155',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    textAlign: 'center',
  },
  headerTitleDark: {
    color: '#F1F5F9',
  },
  placeholder: {
    width: 40,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 32,
  },
  textContent: {
    fontSize: 14,
    color: COLORS.textMuted,
    lineHeight: 24,
  },
  textContentDark: {
    color: '#CBD5E1',
  },
});

export default LegalScreen;
