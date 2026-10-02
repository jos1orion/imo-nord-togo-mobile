import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import COLORS from '../theme/colors';
import { getCurrentLanguage, translate } from '../i18n';

type Props = { children: ReactNode };

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

    if (__DEV__) console.error('ErrorBoundary', error, componentStack);
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    backgroundColor: COLORS.background,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  body: {
    fontSize: 14,
    color: COLORS.textMuted,
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    marginTop: 12,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  secondaryButtonText: {
    color: COLORS.text,
  },
  details: {
    alignSelf: 'stretch',
    maxHeight: 240,
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: '#00000008',
  },
  detailsInner: {
    padding: 12,
  },
  detailsText: {
    fontSize: 12,
    lineHeight: 16,
    color: COLORS.text,
  },
});
