import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  StyleProp,
  StyleSheet,
  View,
  ImageResizeMode,
  ViewStyle,
} from 'react-native';
import COLORS from '../theme/colors';
import { useThemeColors, useThemedStyles } from '../theme/useThemedStyles';

type LazyImageProps = {
  uri: string;
  style: StyleProp<ViewStyle>;
  resizeMode?: ImageResizeMode;
};

const LazyImage: React.FC<LazyImageProps> = ({
  uri,
  style,
  resizeMode = 'cover',
}) => {
  const styles = useThemedStyles(baseStyles);
  const themeColors = useThemeColors();
  const [loaded, setLoaded] = useState(false);

  return (
    <View style={[styles.wrapper, style]}>
      <Image
        source={{ uri }}
        style={StyleSheet.absoluteFill}
        resizeMode={resizeMode}
        onLoadEnd={() => setLoaded(true)}
      />

      {!loaded && (
        <View style={styles.placeholder}>
          <ActivityIndicator color={themeColors.primary} />
        </View>
      )}
    </View>
  );
};

const baseStyles = StyleSheet.create({
  wrapper: {
    backgroundColor: COLORS.background,
  },

  placeholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default LazyImage;