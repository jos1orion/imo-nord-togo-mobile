import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { Ionicons } from '@expo/vector-icons';

import { useApp } from '../context/AppContext';
import { useThemedStyles } from '../theme/useThemedStyles';
import { RootStackParamList } from '../../App';
import COLORS from '../theme/colors';

type MortgageCalculatorScreenNavigationProp = StackNavigationProp<RootStackParamList, 'MortgageCalculator'>;

const MortgageCalculatorScreen = () => {
  const styles = useThemedStyles(baseStyles);
  const { calculateMortgage, t, theme } = useApp();
  const navigation = useNavigation<MortgageCalculatorScreenNavigationProp>();
  const isDark = theme === 'dark';

  const [propertyPrice, setPropertyPrice] = useState('');
  const [downPayment, setDownPayment] = useState('');
  const [interestRate, setInterestRate] = useState('5.5');
  const [loanTerm, setLoanTerm] = useState('25');
  const [result, setResult] = useState<ReturnType<typeof calculateMortgage> | null>(null);

  const palette = useMemo(
    () =>
      isDark
        ? {
            screenBg: '#0F172A',
            headerBg: '#1E293B',
            headerBorder: '#334155',
            titleColor: '#F1F5F9',
            cardBg: '#1E293B',
            labelColor: '#CBD5E1',
            inputBg: '#334155',
            inputBorder: '#475569',
            inputText: '#F1F5F9',
            resultBorder: '#334155',
          }
        : {
            screenBg: COLORS.background,
            headerBg: COLORS.card,
            headerBorder: COLORS.border,
            titleColor: COLORS.primary,
            cardBg: COLORS.card,
            labelColor: COLORS.text,
            inputBg: COLORS.card,
            inputBorder: COLORS.border,
            inputText: COLORS.text,
            resultBorder: '#f0f0f0',
          },
    [isDark]
  );

  const handleCalculate = () => {
    const price = parseFloat(propertyPrice);
    const down = parseFloat(downPayment);
    const rate = parseFloat(interestRate);
    const term = parseInt(loanTerm, 10);

    if (!price || !down || !rate || !term) {
      Alert.alert(t('error'), t('fillAllFields'));
      return;
    }

    if (down >= price) {
      Alert.alert(t('error'), t('downPaymentTooHigh'));
      return;
    }

    const calculation = calculateMortgage({
      propertyPrice: price,
      downPayment: down,
      interestRate: rate,
      loanTerm: term,
    });

    setResult(calculation);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'XOF',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: palette.screenBg }]}>
      <View
        style={[
          styles.header,
          { backgroundColor: palette.headerBg, borderBottomColor: palette.headerBorder },
        ]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: palette.titleColor }]}>{t('mortgageCalculator')}</Text>
        <View style={{ width: 24 }} />
      </View>

      <View style={[styles.form, { backgroundColor: palette.cardBg }]}>
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: palette.labelColor }]}>{t('propertyPrice')}</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: palette.inputBg,
                borderColor: palette.inputBorder,
                color: palette.inputText,
              },
            ]}
            value={propertyPrice}
            onChangeText={setPropertyPrice}
            placeholder="50000000"
            placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: palette.labelColor }]}>{t('downPayment')}</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: palette.inputBg,
                borderColor: palette.inputBorder,
                color: palette.inputText,
              },
            ]}
            value={downPayment}
            onChangeText={setDownPayment}
            placeholder="10000000"
            placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: palette.labelColor }]}>
            {t('interestRate')} (%)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: palette.inputBg,
                borderColor: palette.inputBorder,
                color: palette.inputText,
              },
            ]}
            value={interestRate}
            onChangeText={setInterestRate}
            placeholder="5.5"
            placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: palette.labelColor }]}>
            {t('loanTerm')} ({t('years')})
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: palette.inputBg,
                borderColor: palette.inputBorder,
                color: palette.inputText,
              },
            ]}
            value={loanTerm}
            onChangeText={setLoanTerm}
            placeholder="25"
            placeholderTextColor={isDark ? '#64748B' : '#9CA3AF'}
            keyboardType="numeric"
          />
        </View>

        <TouchableOpacity style={styles.calculateButton} onPress={handleCalculate}>
          <Text style={styles.calculateButtonText}>{t('calculate')}</Text>
        </TouchableOpacity>
      </View>

      {result && (
        <View style={[styles.results, { backgroundColor: palette.cardBg }]}>
          <Text style={[styles.resultsTitle, { color: COLORS.primary }]}>{t('results')}</Text>

          <View style={[styles.resultItem, { borderBottomColor: palette.resultBorder }]}>
            <Text style={[styles.resultLabel, { color: palette.labelColor }]}>{t('monthlyPayment')}</Text>
            <Text style={[styles.resultValue, { color: COLORS.primary }]}>
              {formatCurrency(result.monthlyPayment)}
            </Text>
          </View>

          <View style={[styles.resultItem, { borderBottomColor: palette.resultBorder }]}>
            <Text style={[styles.resultLabel, { color: palette.labelColor }]}>{t('totalPayment')}</Text>
            <Text style={[styles.resultValue, { color: COLORS.primary }]}>
              {formatCurrency(result.totalPayment)}
            </Text>
          </View>

          <View style={[styles.resultItem, { borderBottomColor: palette.resultBorder }]}>
            <Text style={[styles.resultLabel, { color: palette.labelColor }]}>{t('totalInterest')}</Text>
            <Text style={[styles.resultValue, { color: COLORS.primary }]}>
              {formatCurrency(result.totalInterest)}
            </Text>
          </View>

          <View style={[styles.resultItem, { borderBottomColor: palette.resultBorder }]}>
            <Text style={[styles.resultLabel, { color: palette.labelColor }]}>{t('loanAmount')}</Text>
            <Text style={[styles.resultValue, { color: COLORS.primary }]}>
              {formatCurrency(result.propertyPrice - result.downPayment)}
            </Text>
          </View>
        </View>
      )}
    </ScrollView>
  );
};

const baseStyles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 15,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  form: {
    margin: 10,
    borderRadius: 10,
    padding: 20,
  },
  inputGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  calculateButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  calculateButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  results: {
    margin: 10,
    borderRadius: 10,
    padding: 20,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  resultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  resultLabel: {
    fontSize: 16,
  },
  resultValue: {
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default MortgageCalculatorScreen;
