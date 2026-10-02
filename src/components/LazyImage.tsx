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
          <ActivityIndicator color={COLORS.primary} />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
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