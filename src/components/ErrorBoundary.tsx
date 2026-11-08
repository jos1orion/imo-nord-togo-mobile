import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { THEME_PALETTES, type ThemeMode, type ThemePalette } from '../theme/colors';
import { getCurrentLanguage, translate } from '../i18n';
import { logger } from '../lib/logger';

type Props = { children: ReactNode; theme?: ThemeMode };

type State = {
  hasError: boolean;
  message?: string;
  stack?: string;
  componentStack?: string;
  showDetails: boolean;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, showDetails: __DEV__ };

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      message: error.message,
      stack: error.stack,
      componentStack: undefined,
      showDetails: __DEV__,
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    const componentStack = info.componentStack ?? undefined;
    this.setState({ componentStack });

    const payload = {
      message: error.message,
      stack: error.stack,
      componentStack,
      at: new Date().toISOString(),
    };

    void (async () => {
      try {
        await AsyncStorage.setItem('imo:lastCrash', JSON.stringify(payload));
      } catch {
        /* ignore */
      }
    })();

    logger.error('ErrorBoundary', { error, componentStack });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      message: undefined,
      stack: undefined,
      componentStack: undefined,
      showDetails: __DEV__,
    });
  };

  render() {
    if (this.state.hasError) {
      const styles = createStyles(THEME_PALETTES[this.props.theme ?? 'light']);
      const t = (key: Parameters<typeof translate>[1]) => translate(getCurrentLanguage(), key);
      const details = [this.state.stack, this.state.componentStack].filter(Boolean).join('\n\n');
      return (
        <View style={styles.container}>
          <Text style={styles.title}>{t('app_error_title')}</Text>
          <Text style={styles.body}>
            {this.state.message ? `${this.state.message}` : t('app_error_unexpected')}
          </Text>

          {details ? (
            <TouchableOpacity
              style={[styles.button, styles.secondaryButton]}
              onPress={() => this.setState(s => ({ ...s, showDetails: !s.showDetails }))}
              accessibilityRole="button"
            >
              <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                {this.state.showDetails ? t('app_error_hide_details') : t('app_error_show_details')}
              </Text>
            </TouchableOpacity>
          ) : null}

          {this.state.showDetails && details ? (
            <ScrollView style={styles.details} contentContainerStyle={styles.detailsInner}>
              <Text selectable style={styles.detailsText}>
                {details}
              </Text>
            </ScrollView>
          ) : null}

          <TouchableOpacity style={styles.button} onPress={this.handleReset} accessibilityRole="button">
            <Text style={styles.buttonText}>{t('app_error_retry')}</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return this.props.children;
  }
}

const createStyles = (palette: ThemePalette) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: palette.background,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: palette.onSurface,
    marginBottom: 8,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: palette.onSurfaceMuted,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: palette.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    marginTop: 12,
  },
  buttonText: {
    color: palette.onBrand,
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: palette.border,
  },
  secondaryButtonText: {
    color: palette.onSurface,
  },
  details: {
    alignSelf: 'stretch',
    maxHeight: 240,
    marginTop: 12,
    borderWidth: 1,
    borderColor: palette.border,
    borderRadius: 12,
    backgroundColor: palette.overlay,
  },
  detailsInner: {
    padding: 12,
  },
  detailsText: {
    fontSize: 12,
    lineHeight: 16,
    color: palette.onSurface,
  },
});
