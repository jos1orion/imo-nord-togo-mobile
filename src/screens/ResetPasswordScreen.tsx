import React, { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import COLORS from '../theme/colors';

export default function ResetPasswordScreen({ navigation }: { navigation: any }) {
  const styles = useThemedStyles(baseStyles);
  const { t } = useApp();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (password.length < 6) {
      Alert.alert(t('reset_password_invalid_title'), t('profile_auth_password_short'));
      return;
    }
    if (password !== confirmation) {
      Alert.alert(t('reset_password_mismatch_title'), t('reset_password_mismatch_message'));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        Alert.alert(t('reset_password_failed_title'), t('reset_password_failed_message'));
        return;
      }
      Alert.alert(t('reset_password_success_title'), t('reset_password_success_message'), [
        { text: t('reset_password_sign_in'), onPress: () => navigation.navigate('MainTabs') },
      ]);
    } catch {
      Alert.alert(t('reset_password_failed_title'), t('reset_password_failed_message'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
        <Ionicons name="arrow-back" size={24} color={COLORS.text} />
      </TouchableOpacity>
      <View style={styles.card}>
        <Ionicons name="lock-closed-outline" size={42} color={COLORS.primary} />
        <Text style={styles.title}>{t('reset_password_title')}</Text>
        <Text style={styles.subtitle}>{t('reset_password_subtitle')}</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder={t('reset_password_placeholder')} secureTextEntry />
        <TextInput style={styles.input} value={confirmation} onChangeText={setConfirmation} placeholder={t('reset_password_confirmation')} secureTextEntry />
        <TouchableOpacity style={styles.button} onPress={() => void submit()} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? t('reset_password_saving') : t('reset_password_action')}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 24 },
  back: { marginTop: 18, marginBottom: 28, width: 44 },
  card: { backgroundColor: COLORS.card, borderRadius: 20, padding: 24, gap: 16 },
  title: { color: COLORS.text, fontSize: 24, fontWeight: '700' },
  subtitle: { color: COLORS.textMuted, lineHeight: 21 },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, color: COLORS.text, backgroundColor: COLORS.background },
  button: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 15, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
});
