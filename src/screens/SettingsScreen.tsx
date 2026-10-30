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
import { useThemeColors, useThemedStyles } from '../theme/useThemedStyles';
import COLORS from '../theme/colors';
import { typography } from '../theme/typography';
import { RADIUS, SPACING } from '../theme/spacing';
import { getContactEmail, getContactPhoneDigits } from '../constants/appConfig';

interface LegalScreenProps {
  type: 'privacy' | 'terms';
  onClose: () => void;
}

const LegalScreen: React.FC<LegalScreenProps> = ({ type, onClose }) => {
  const styles = useThemedStyles(baseStyles);
  const themeColors = useThemeColors();
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
          <Ionicons name="arrow-back" size={24} color={themeColors.primary} />
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
POLITIQUE DE CONFIDENTIALITÉ - IMOPRESTIGE

Dernière mise à jour : 20 octobre 2026

1. INTRODUCTION

Cette politique décrit les informations traitées lorsque vous utilisez l'application mobile ImoPrestige et les services associés.

2. INFORMATIONS TRAITÉES

Selon les fonctions utilisées, nous traitons les informations de compte que vous fournissez (nom, adresse e-mail et téléphone), les annonces que vous créez (description, prix, ville, quartier, caractéristiques et photos), ainsi que les messages, avis, favoris, recherches et alertes que vous choisissez d’utiliser. Si vous envoyez une demande de suppression, nous enregistrons l’adresse e-mail fournie et l’état de traitement de la demande. Des données techniques nécessaires à l’authentification, à la sécurité et au fonctionnement du service peuvent également être générées.

3. UTILISATION DES INFORMATIONS

Les informations servent à créer et sécuriser votre compte, publier et gérer les annonces, permettre les contacts entre utilisateurs, fournir les fonctions de favoris et d’alertes, répondre aux demandes d’assistance et maintenir le service.

4. PARTAGE DES INFORMATIONS

Les annonces publiées et les coordonnées que vous choisissez d’y inclure peuvent être visibles par les utilisateurs de l’application. Nous utilisons des prestataires techniques, notamment Supabase pour l’authentification, la base de données et le stockage, ainsi que Vercel pour héberger le site web. Lorsque vous choisissez WhatsApp, l’appel ou l’e-mail, vous êtes redirigé vers le service correspondant, qui applique ses propres règles de confidentialité.

5. PHOTOS ET LOCALISATION

L’application accède à la caméra ou à la photothèque uniquement lorsque vous choisissez d’ajouter des photos et après autorisation de votre appareil. La ville et le quartier saisis dans une annonce servent à décrire le bien. L’application ne demande pas l’accès à la position GPS de votre appareil.

6. RECHERCHE VOCALE

La recherche vocale est facultative et n’active le microphone qu’après votre action et votre autorisation. La reconnaissance est effectuée par le service vocal configuré sur votre appareil, qui peut traiter l’audio selon ses propres conditions et sa politique de confidentialité. ImoPrestige utilise le texte reconnu pour renseigner la recherche.

7. CONSERVATION ET SÉCURITÉ

Les données sont conservées aussi longtemps que nécessaire au fonctionnement du compte et du service, puis supprimées ou conservées uniquement lorsque cela est nécessaire pour des obligations légales, la sécurité ou le règlement de litiges. Pour une demande de suppression envoyée via le formulaire en ligne, l’adresse e-mail est effacée du dossier lorsque la demande est terminée ou refusée; le statut et les dates de traitement sont conservés. Nous mettons en œuvre des mesures raisonnables pour protéger les données, sans pouvoir garantir une sécurité absolue.

8. VOS CHOIX ET SUPPRESSION DU COMPTE

Vous pouvez demander l’accès, la correction ou la suppression de vos données et de votre compte via le formulaire en ligne. Un administrateur vérifiera la demande et traitera manuellement la suppression; l’envoi du formulaire ne supprime pas immédiatement le compte. L’adresse e-mail est effacée du dossier lorsque la demande est terminée ou refusée, tandis que le statut et les dates de traitement sont conservés. Vous pouvez aussi écrire à ${getContactEmail()}. La suppression entraîne la suppression ou la désassociation des données personnelles, sous réserve des informations que nous devons conserver pour des raisons légales ou de sécurité.

9. CONTACT

E-mail : ${getContactEmail()}
Téléphone : +${getContactPhoneDigits()}
Adresse : Kara, Togo

10. MINEURS ET MODIFICATIONS

Le service n’est pas destiné aux personnes de moins de 18 ans. Nous pouvons mettre à jour cette politique ; la date de mise à jour sera alors modifiée sur cette page.

ImoPrestige - votre partenaire immobilier à Kara.
`;

const termsContentFr = `
CONDITIONS D'UTILISATION - IMOPRESTIGE

Derniere mise a jour : fevrier 2024

1. ACCEPTATION DES CONDITIONS

En telechargeant et en utilisant l'application ImoPrestige, vous acceptez d'etre lie par ces conditions.

2. DESCRIPTION DU SERVICE

ImoPrestige est une plateforme de mise en relation pour :
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

- Le contenu de la plateforme appartient a ImoPrestige ou a ses concedants
- Les photos restent la propriete de leurs auteurs
- Toute utilisation commerciale est interdite sans autorisation

6. RESPONSABILITES

- ImoPrestige n'est pas partie aux transactions entre utilisateurs
- Nous ne garantissons pas l'exactitude des annonces
- Nous pouvons supprimer tout contenu inapproprie

7. LIMITATION DE RESPONSABILITE

ImoPrestige ne peut etre tenu responsable des :
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

ImoPrestige - votre partenaire immobilier a Kara.
`;

const privacyContentEn = `
PRIVACY POLICY - IMOPRESTIGE

Last updated: October 20, 2026

1. INTRODUCTION

This policy explains how information is handled when you use the ImoPrestige mobile app and related services.

2. INFORMATION WE HANDLE

Depending on the features you use, we handle account details you provide (name, email address and phone number), listings you create (description, price, city, neighborhood, features and photos), and messages, reviews, favorites, searches and alerts you choose to use. If you submit an account deletion request, we store the email address you provide and the request status. Technical data needed for authentication, security and service operation may also be generated.

3. USE OF INFORMATION

Information is used to create and secure accounts, publish and manage listings, enable contact between users, provide favorites and alerts, respond to support requests and operate the service.

4. DATA SHARING

Published listings and contact details you choose to include may be visible to app users. We use technical providers, including Supabase for authentication, database and storage, and Vercel to host the website. If you choose WhatsApp, phone or email contact, you are redirected to that service, which applies its own privacy terms.

5. PHOTOS AND LOCATION

The app accesses your camera or photo library only when you choose to add photos and grant device permission. The city and neighborhood entered in a listing describe the property. The app does not request access to your device’s GPS location.

6. VOICE SEARCH

Voice search is optional and accesses the microphone only after you choose the feature and grant permission. Speech recognition is provided by the service configured on your device, which may process audio under its own terms and privacy policy. ImoPrestige uses the recognized text to fill in your search.

7. RETENTION AND SECURITY

Data is kept for as long as needed to operate the account and service, then deleted or retained only where needed for legal obligations, security or dispute resolution. For an online deletion request, the email address is cleared from the request when it is completed or rejected; its status and processing dates are retained. We use reasonable safeguards, but cannot guarantee absolute security.

8. YOUR CHOICES AND ACCOUNT DELETION

You may request access, correction or deletion of your data and account using the online form. An administrator will verify the request and handle deletion manually; submitting the form does not delete the account immediately. The email address is cleared from the request when it is completed or rejected, while its status and processing dates are retained. You may also email ${getContactEmail()}. Account deletion removes or de-links personal data, except information that must be retained for legal or security reasons.

9. CONTACT

Email: ${getContactEmail()}
Phone: +${getContactPhoneDigits()}
Address: Kara, Togo

10. CHILDREN AND CHANGES

The service is not intended for anyone under 18. We may update this policy and will change the update date on this page.
`;

const termsContentEn = `
TERMS OF USE - IMOPRESTIGE

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

- Platform content belongs to ImoPrestige or its licensors
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
    backgroundColor: COLORS.surface,
  },
  containerDark: {
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderStrong,
  },
  headerDark: {
    borderBottomColor: COLORS.onSurfaceMuted,
  },
  backButton: {
    padding: SPACING.sm,
    borderRadius: RADIUS.full,
  },
  headerTitle: {
    flex: 1,
    ...typography.title,
    color: COLORS.onSurface,
    textAlign: 'center',
  },
  headerTitleDark: {
    color: COLORS.surfaceAlt,
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
    color: COLORS.onSurfaceMuted,
    lineHeight: 24,
  },
  textContentDark: {
    color: COLORS.onSurfaceMuted,
  },
});

export default LegalScreen;
