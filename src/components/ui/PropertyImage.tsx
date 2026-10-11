import React, { useState } from 'react';
import { Image, ImageResizeMode, ImageStyle, StyleProp } from 'react-native';

type PropertyImageProps = {
  uri?: string;
  style: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  accessibilityLabel?: string;
  onLoadEnd?: () => void;
};

const PropertyImage: React.FC<PropertyImageProps> = ({
  uri,
  style,
  resizeMode = 'cover',
  accessibilityLabel,
  onLoadEnd,
}) => {
  const [failedUri, setFailedUri] = useState<string | null>(null);
  const source = uri && uri !== failedUri
    ? { uri }
    : require('../../../assets/branding/maison-ocre.jpg');

  return (
    <Image
      source={source}
      style={style}
      resizeMode={resizeMode}
      accessibilityLabel={accessibilityLabel}
      onLoadEnd={onLoadEnd}
      onError={() => {
        if (uri) setFailedUri(uri);
      }}
    />
  );
};

export default PropertyImage;
