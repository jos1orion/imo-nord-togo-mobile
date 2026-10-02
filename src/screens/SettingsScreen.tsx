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
import { useThemedStyles } from '../theme/useThemedStyles';
import COLORS from '../theme/colors';
import { getContactEmail, getContactPhoneDigits } from '../constants/appConfig';

interface LegalScreenProps {
  type: 'privacy' | 'terms';
  onClose: () => void;
}

const LegalScreen: React.FC<LegalScreenProps> = ({ type, onClose }) => {
  const styles = useThemedStyles(baseStyles);
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
POLITIQUE DE CONFIDENTIALITÉ - IMO NORD TOGO

Dernière mise à jour : 30 septembre 2026

1. INTRODUCTION

Cette politique décrit les informations traitées lorsque vous utilisez l'application mobile Imo Nord Togo et les services associés.

2. INFORMATIONS TRAITÉES

Selon les fonctions utilisées, nous traitons les informations de compte que vous fournissez (nom, adresse e-mail et téléphone), les annonces que vous créez (description, prix, ville, quartier, caractéristiques et photos), ainsi que les messages, avis, favoris, recherches et alertes que vous choisissez d’utiliser. Des données techniques nécessaires à l’authentification, à la sécurité et au fonctionnement du service peuvent également être générées.

3. UTILISATION DES INFORMATIONS

Les informations servent à créer et sécuriser votre compte, publier et gérer les annonces, permettre les contacts entre utilisateurs, fournir les fonctions de favoris et d’alertes, répondre aux demandes d’assistance et maintenir le service.

4. PARTAGE DES INFORMATIONS

Les annonces publiées et les coordonnées que vous choisissez d’y inclure peuvent être visibles par les utilisateurs de l’application. Nous utilisons des prestataires techniques, notamment Supabase pour l’authentification, la base de données et le stockage, ainsi que Vercel pour héberger le site web. Lorsque vous choisissez WhatsApp, l’appel ou l’e-mail, vous êtes redirigé vers le service correspondant, qui applique ses propres règles de confidentialité.

5. PHOTOS ET LOCALISATION

L’application accède à la caméra ou à la photothèque uniquement lorsque vous choisissez d’ajouter des photos et après autorisation de votre appareil. La ville et le quartier saisis dans une annonce servent à décrire le bien. L’application ne demande pas l’accès à la position GPS de votre appareil.

6. CONSERVATION ET SÉCURITÉ

Les données sont conservées aussi longtemps que nécessaire au fonctionnement du compte et du service, puis supprimées ou conservées uniquement lorsque cela est nécessaire pour des obligations légales, la sécurité ou le règlement de litiges. Nous mettons en œuvre des mesures raisonnables pour protéger les données, sans pouvoir garantir une sécurité absolue.

7. VOS CHOIX ET SUPPRESSION DU COMPTE

Vous pouvez demander l’accès, la correction ou la suppression de vos données et de votre compte en écrivant à ${getContactEmail()} depuis l’adresse associée au compte. Indiquez « Suppression de compte Imo Nord Togo » dans l’objet. Nous pouvons demander des éléments raisonnables pour vérifier votre identité. La suppression entraîne la suppression ou la désassociation des données personnelles, sous réserve des informations que nous devons conserver pour des raisons légales ou de sécurité.

8. CONTACT

E-mail : ${getContactEmail()}
Téléphone : +${getContactPhoneDigits()}
Adresse : Kara, Togo

9. MINEURS ET MODIFICATIONS

Le service n’est pas destiné aux personnes de moins de 18 ans. Nous pouvons mettre à jour cette politique ; la date de mise à jour sera alors modifiée sur cette page.

Imo Nord Togo - votre partenaire immobilier à Kara.
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

Last updated: September 30, 2026

1. INTRODUCTION

This policy explains how information is handled when you use the Imo Nord Togo mobile app and related services.

2. INFORMATION WE HANDLE

Depending on the features you use, we handle account details you provide (name, email address and phone number), listings you create (description, price, city, neighborhood, features and photos), and messages, reviews, favorites, searches and alerts you choose to use. Technical data needed for authentication, security and service operation may also be generated.

3. USE OF INFORMATION

Information is used to create and secure accounts, publish and manage listings, enable contact between users, provide favorites and alerts, respond to support requests and operate the service.

4. DATA SHARING

Published listings and contact details you choose to include may be visible to app users. We use technical providers, including Supabase for authentication, database and storage, and Vercel to host the website. If you choose WhatsApp, phone or email contact, you are redirected to that service, which applies its own privacy terms.

5. PHOTOS AND LOCATION

The app accesses your camera or photo library only when you choose to add photos and grant device permission. The city and neighborhood entered in a listing describe the property. The app does not request access to your device’s GPS location.

6. RETENTION AND SECURITY

Data is kept for as long as needed to operate the account and service, then deleted or retained only where needed for legal obligations, security or dispute resolution. We use reasonable safeguards, but cannot guarantee absolute security.

7. YOUR CHOICES AND ACCOUNT DELETION

You may request access, correction or deletion of your data and account by emailing ${getContactEmail()} from the address linked to the account. Use “Imo Nord Togo account deletion” as the subject. We may ask for reasonable information to verify your identity. Account deletion removes or de-links personal data, except information that must be retained for legal or security reasons.

8. CONTACT

Email: ${getContactEmail()}
Phone: +${getContactPhoneDigits()}
Address: Kara, Togo

9. CHILDREN AND CHANGES

The service is not intended for anyone under 18. We may update this policy and will change the update date on this page.
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

const baseStyles = StyleSheet.create({
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
