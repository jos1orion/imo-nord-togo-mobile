import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import COLORS from '../theme/colors';

export default function ResetPasswordScreen({ navigation }: { navigation: any }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (password.length < 6) {
      Alert.alert('Mot de passe invalide', 'Le mot de passe doit contenir au moins 6 caractères.');
      return;
    }
    if (password !== confirmation) {
      Alert.alert('Confirmation incorrecte', 'Les deux mots de passe doivent être identiques.');
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      Alert.alert('Réinitialisation impossible', 'Le lien est peut-être expiré. Demandez un nouvel email.');
      return;
    }
    Alert.alert('Mot de passe modifié', 'Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.', [
      { text: 'Se connecter', onPress: () => navigation.navigate('MainTabs') },
    ]);
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={COLORS.text} />
      </TouchableOpacity>
      <View style={styles.card}>
        <Ionicons name="lock-closed-outline" size={42} color={COLORS.primary} />
        <Text style={styles.title}>Nouveau mot de passe</Text>
        <Text style={styles.subtitle}>Choisissez un nouveau mot de passe pour sécuriser votre compte.</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="Nouveau mot de passe" secureTextEntry />
        <TextInput style={styles.input} value={confirmation} onChangeText={setConfirmation} placeholder="Confirmer le mot de passe" secureTextEntry />
        <TouchableOpacity style={styles.button} onPress={() => void submit()} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? 'Enregistrement...' : 'Réinitialiser le mot de passe'}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 24 },
  back: { marginTop: 18, marginBottom: 28, width: 44 },
  card: { backgroundColor: COLORS.card, borderRadius: 20, padding: 24, gap: 16 },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '700' },
  subtitle: { color: COLORS.textMuted, lineHeight: 21 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, color: COLORS.text, backgroundColor: COLORS.background },
  button: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 15, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
});
