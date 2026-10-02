import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  Platform,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useEventListener } from 'expo';
import type {
  ExpoSpeechRecognitionErrorEvent,
  ExpoSpeechRecognitionResultEvent,
} from 'expo-speech-recognition';
import COLORS from '../theme/colors';
import { useApp } from '../context/AppContext';
import { useThemedStyles } from '../theme/useThemedStyles';

const noopEmitter = {
  addListener: () => ({ remove: () => {} }),
};

const loadSpeechRecognitionModule = () => {
  try {
    // Can throw at runtime if the native module isn't present (e.g. Expo Go).
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require('expo-speech-recognition').ExpoSpeechRecognitionModule as any;
  } catch {
    return null;
  }
};

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  onSearch?: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChangeText,
  placeholder,
  onSearch,
}) => {
  const styles = useThemedStyles(baseStyles);
  const { language, t } = useApp();
  const speechModule = useMemo(loadSpeechRecognitionModule, []);
  const speechEventEmitter = (speechModule ?? noopEmitter) as unknown as Parameters<
    typeof useEventListener
  >[0];

  const [isListening, setIsListening] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const [textWidth, setTextWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const isListeningRef = useRef(false);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  useEffect(() => {
    let mounted = true;
    const checkAvailability = () => {
      if (Platform.OS === 'web') {
        if (mounted) setVoiceAvailable(false);
        return;
      }
      if (!speechModule) {
        if (mounted) setVoiceAvailable(false);
        return;
      }
      try {
        const available =
          typeof speechModule.isRecognitionAvailable === 'function'
            ? speechModule.isRecognitionAvailable()
            : true;
        if (mounted) setVoiceAvailable(Boolean(available));
      } catch {
        if (mounted) setVoiceAvailable(false);
      }
    };

    checkAvailability();

    return () => {
      mounted = false;
      if (isListeningRef.current && speechModule) {
        try {
          speechModule.abort();
        } catch {
          /* ignore */
        }
      }
    };
  }, [speechModule]);

  useEventListener(speechEventEmitter, 'start' as never, () => {
    setIsListening(true);
  });
  useEventListener(speechEventEmitter, 'end' as never, () => {
    setIsListening(false);
  });
  useEventListener(
    speechEventEmitter,
    'error' as never,
    (event: ExpoSpeechRecognitionErrorEvent) => {
      setIsListening(false);
      const message = event?.message || t('voice_search_start_error');
      Alert.alert(t('voice_search_title'), message);
    }
  );
  useEventListener(
    speechEventEmitter,
    'result' as never,
    (event: ExpoSpeechRecognitionResultEvent) => {
      const transcript = event?.results?.[0]?.transcript?.trim?.() ?? '';
      if (!transcript) return;
      onChangeText(transcript);
      if (event?.isFinal ?? true) {
        onSearch?.();
      }
    }
  );

  useEffect(() => {
    const canAnimate = containerWidth > 0 && textWidth > 0 && value.length === 0;
    if (!canAnimate) {
      if (animationRef.current) {
        animationRef.current.stop();
        animationRef.current = null;
      }
      translateX.setValue(0);
      return;
    }

    const startX = containerWidth;
    const endX = -textWidth;
    translateX.setValue(startX);
    const duration = Math.max(6000, (containerWidth + textWidth) * 18);
    const anim = Animated.loop(
      Animated.timing(translateX, {
        toValue: endX,
        duration,
        useNativeDriver: true,
      })
    );
    animationRef.current = anim;
    anim.start();

    return () => {
      anim.stop();
    };
  }, [containerWidth, textWidth, value.length, translateX]);

  const handleSearch = () => {
    onSearch?.();
  };

  const voiceButtonDisabled = !voiceAvailable && Boolean(speechModule);

  const ensureVoicePermission = async () => {
    try {
      if (!speechModule?.requestPermissionsAsync) return false;
      const result = await speechModule.requestPermissionsAsync();
      return Boolean(result?.granted);
    } catch {
      return false;
    }
  };

  const toggleVoiceSearch = async () => {
    if (Platform.OS === 'web') return;
    if (!speechModule) {
      Alert.alert(
        t('voice_search_title'),
        t('voice_search_dev_build')
      );
      return;
    }
    if (!voiceAvailable) {
      Alert.alert(t('voice_search_title'), t('voice_search_unavailable'));
      return;
    }

    try {
      if (isListening) {
        speechModule.stop?.();
        setIsListening(false);
        return;
      }

      const allowed = await ensureVoicePermission();
      if (!allowed) {
        Alert.alert(t('voice_search_title'), t('voice_microphone_denied'));
        return;
      }

      setIsListening(true);
      speechModule.start({
        lang: language === 'fr' ? 'fr-FR' : 'en-US',
        interimResults: true,
        continuous: false,
      });
    } catch {
      setIsListening(false);
      Alert.alert(t('voice_search_title'), t('voice_search_start_error'));
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity onPress={handleSearch} style={styles.searchButton}>
        <Ionicons name="search" size={20} color="#9CA3AF" />
      </TouchableOpacity>
      <View
        style={styles.inputWrap}
        onLayout={event => setContainerWidth(event.nativeEvent.layout.width)}
      >
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder=""
          placeholderTextColor="#94A3B8"
          returnKeyType="search"
          onSubmitEditing={handleSearch}
        />
        {value.length === 0 && (
          <Animated.View
            pointerEvents="none"
            style={[styles.placeholderWrap, { transform: [{ translateX }] }]}
          >
            <Text
              style={styles.placeholderText}
              onLayout={event => setTextWidth(event.nativeEvent.layout.width)}
              numberOfLines={1}
            >
              {placeholder ?? t('search_bar_placeholder')}
            </Text>
          </Animated.View>
        )}
      </View>
      {Platform.OS !== 'web' && (
        <TouchableOpacity
          onPress={toggleVoiceSearch}
          style={[styles.voiceButton, voiceButtonDisabled && styles.voiceButtonDisabled]}
          disabled={voiceButtonDisabled}
        >
          <Ionicons
            name={isListening ? 'mic' : 'mic-outline'}
            size={18}
            color={isListening ? COLORS.primary : '#9CA3AF'}
          />
        </TouchableOpacity>
      )}
      {value.length > 0 && (
        <TouchableOpacity onPress={() => onChangeText('')} style={styles.clearButton}>
          <Ionicons name="close-circle" size={18} color="#9CA3AF" />
        </TouchableOpacity>
      )}
      {isListening && (
        <View style={styles.voiceIndicator}>
          <Ionicons name="mic" size={12} color={COLORS.primary} />
          <Text style={styles.voiceIndicatorText}>{t('voice_search_listening')}</Text>
        </View>
      )}
    </View>
  );
};

const baseStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F7FA',
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 48,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchButton: {
    paddingRight: 8,
  },
  inputWrap: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  input: {
    fontSize: 15,
    color: '#111827',
  },
  placeholderWrap: {
    position: 'absolute',
    left: 0,
  },
  placeholderText: {
    fontSize: 15,
    color: '#9CA3AF',
  },
  voiceButton: {
    padding: 4,
    marginRight: 6,
  },
  voiceButtonDisabled: {
    opacity: 0.5,
  },
  clearButton: {
    padding: 4,
  },
  voiceIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#EFF6FF',
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  voiceIndicatorText: {
    fontSize: 11,
    fontWeight: '700',
    color: COLORS.primary,
  },
});

export default SearchBar;
