import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import TextInput from '../../components/ui/AccessibleTextInput';
import type { AdminTranslationKey } from '../../i18n/admin';
import type { AdminTheme, createAdminStyles } from '../AdminScreen.styles';

type AdminGateProps = {
  mode: 'setup' | 'unlock';
  pinInput: string;
  setPinInput: (value: string) => void;
  pinConfirm: string;
  setPinConfirm: (value: string) => void;
  onSetup: () => void;
  onUnlock: () => void;
  translate: (key: AdminTranslationKey) => string;
  theme: AdminTheme;
  styles: ReturnType<typeof createAdminStyles>;
};

const AdminGate: React.FC<AdminGateProps> = ({
  mode,
  pinInput,
  setPinInput,
  pinConfirm,
  setPinConfirm,
  onSetup,
  onUnlock,
  translate,
  theme,
  styles,
}) => {
  const isSetup = mode === 'setup';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.gateScrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="none"
      >
        <View style={[styles.container, styles.gateContainer]}>
          <View style={styles.gateCard}>
            <Ionicons
              name={isSetup ? 'lock-closed' : 'shield-checkmark'}
              size={28}
              color={theme.accent}
            />
            <Text style={styles.gateTitle}>
              {translate(isSetup ? "Creer un PIN Admin" : "Acces Admin")}
            </Text>
            <Text style={styles.gateSubtitle}>
              {translate(
                isSetup
                  ? "Ce PIN protege l'acces au back-office et la sauvegarde."
                  : "Saisie securisee pour acceder au mini back-office."
              )}
            </Text>

            <TextInput
              style={styles.gateInput}
              value={pinInput}
              onChangeText={setPinInput}
              placeholder={translate(isSetup ? "Nouveau PIN (min 4)" : "PIN")}
              keyboardType="number-pad"
              secureTextEntry
              accessibilityLabel={translate(isSetup ? "Nouveau PIN (min 4)" : "PIN")}
            />
            {isSetup ? (
              <TextInput
                style={styles.gateInput}
                value={pinConfirm}
                onChangeText={setPinConfirm}
                placeholder={translate("Confirmer le PIN")}
                keyboardType="number-pad"
                secureTextEntry
                accessibilityLabel={translate("Confirmer le PIN")}
              />
            ) : null}

            <TouchableOpacity
              style={styles.gateButton}
              onPress={isSetup ? onSetup : onUnlock}
              accessibilityRole="button"
            >
              <Text style={styles.gateButtonText}>
                {translate(isSetup ? "Enregistrer" : "Deverrouiller")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default AdminGate;
