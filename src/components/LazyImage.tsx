import React, { useState } from 'react';
import { ActivityIndicator, ImageResizeMode, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import PropertyImage from './ui/PropertyImage';
import COLORS from '../theme/colors';
import { useThemeColors, useThemedStyles } from '../theme/useThemedStyles';

type LazyImageProps = {
  uri?: string;
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
      <PropertyImage
        uri={uri}
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