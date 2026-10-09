import React, { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useThemeColors } from '../../theme/useThemedStyles';

interface SkeletonProps {
  style: StyleProp<ViewStyle>;
  borderRadius?: number;
}

const Skeleton: React.FC<SkeletonProps> = ({ style, borderRadius = 8 }) => {
  const themeColors = useThemeColors();
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1400 }), -1, false);
  }, [shimmer]);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: interpolate(shimmer.value, [0, 1], [-120, 420]) }],
  }));

  return (
    <Animated.View
      style={[
        { backgroundColor: themeColors.borderStrong, borderRadius, overflow: 'hidden' },
        style,
      ]}
    >
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: 72,
            backgroundColor: themeColors.surface,
            opacity: 0.55,
          },
          shimmerStyle,
        ]}
      />
    </Animated.View>
  );
};

export default Skeleton;
