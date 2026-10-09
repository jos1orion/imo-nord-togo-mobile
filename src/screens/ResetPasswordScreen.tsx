import React, { useState } from 'react';
import { StackNavigationProp } from '@react-navigation/stack';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import { useThemeColors, useThemedStyles } from '../theme/useThemedStyles';
import COLORS from '../theme/colors';
import { RootStackParamList } from '../../App';

type ResetPasswordNavigation = StackNavigationProp<RootStackParamList, 'ResetPassword'>;

export default function ResetPasswordScreen({ navigation }: { navigation: ResetPasswordNavigation }) {
  const styles = useThemedStyles(baseStyles);
  const themeColors = useThemeColors();
  const { t } = useApp();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
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
        { text: t('reset_password_sign_in'), onPress: () => navigation.navigate('MainTabs', { screen: 'Home' }) },
      ]);
    } catch {
      Alert.alert(t('reset_password_failed_title'), t('reset_password_failed_message'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
      >
        <TouchableOpacity style={styles.back} onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={themeColors.onSurface} />
        </TouchableOpacity>
        <View style={styles.card}>
          <Ionicons name="lock-closed-outline" size={42} color={themeColors.primary} />
          <Text style={styles.title}>{t('reset_password_title')}</Text>
          <Text style={styles.subtitle}>{t('reset_password_subtitle')}</Text>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder={t('reset_password_placeholder')}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              textContentType="newPassword"
            />
            <TouchableOpacity
              style={styles.visibilityButton}
              onPress={() => setShowPassword(previous => !previous)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? t('profile_password_hide') : t('profile_password_show')}
            >
              <Ionicons name={showPassword ? 'eye-off' : 'eye'} size={20} color={themeColors.onSurfaceMuted} />
            </TouchableOpacity>
          </View>
          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              value={confirmation}
              onChangeText={setConfirmation}
              placeholder={t('reset_password_confirmation')}
              secureTextEntry={!showConfirmation}
              autoCapitalize="none"
              textContentType="newPassword"
            />
            <TouchableOpacity
              style={styles.visibilityButton}
              onPress={() => setShowConfirmation(previous => !previous)}
              accessibilityRole="button"
              accessibilityLabel={showConfirmation ? t('profile_password_hide') : t('profile_password_show')}
            >
              <Ionicons name={showConfirmation ? 'eye-off' : 'eye'} size={20} color={themeColors.onSurfaceMuted} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.button} onPress={() => void submit()} disabled={loading}>
            <Text style={styles.buttonText}>
              {loading ? t('reset_password_saving') : t('reset_password_action')}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const baseStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background, padding: 24 },
  content: { flexGrow: 1, paddingBottom: 24 },
  back: { marginTop: 18, marginBottom: 28, width: 44 },
  card: { backgroundColor: COLORS.surface, borderRadius: 20, padding: 24, gap: 16 },
  title: { color: COLORS.onSurface, fontSize: 24, fontWeight: '700' },
  subtitle: { color: COLORS.onSurfaceMuted, lineHeight: 21 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 14, backgroundColor: COLORS.background },
  input: { flex: 1, minWidth: 0, paddingVertical: 13, color: COLORS.onSurface },
  visibilityButton: { padding: 6 },
  button: { backgroundColor: COLORS.primary, borderRadius: 12, padding: 15, alignItems: 'center' },
  buttonText: { color: COLORS.white, fontWeight: '700' },
});
