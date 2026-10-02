import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, AppState, AppStateStatus } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import COLORS from '../../theme/colors';
import { useApp } from '../../context/AppContext';
import { safeGetNetworkStateAsync } from '../../lib/expoNetworkSafe';
import { useThemedStyles } from '../../theme/useThemedStyles';

const OfflineBanner: React.FC = () => {
  const styles = useThemedStyles(baseStyles);
  const { t } = useApp();
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    const s = await safeGetNetworkStateAsync();
    if (s == null) {
      setOffline(false);
      return;
    }
    const noLink = s.isConnected === false;
    const noInternet = s.isInternetReachable === false;
    setOffline(noLink || noInternet);
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 5000);
    const onAppState = (next: AppStateStatus) => {
      if (next === 'active') void refresh();
    };
    const sub = AppState.addEventListener('change', onAppState);
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [refresh]);

  if (!offline) return null;

  return (
    <View style={styles.bar} accessibilityRole="alert">
      <Ionicons name="cloud-offline-outline" size={18} color="#92400E" style={styles.icon} />
      <Text style={styles.text}>{t('offline_message')}</Text>
    </View>
  );
};

const baseStyles = StyleSheet.create({
  icon: { marginRight: 8 },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.warningBg,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#FCD34D',
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: '#92400E',
  },
});

export default OfflineBanner;
