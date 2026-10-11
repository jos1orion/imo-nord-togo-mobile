import React, { forwardRef } from 'react';
import { TextInput } from 'react-native';
import type { TextInputProps } from 'react-native';

const AccessibleTextInput = forwardRef<TextInput, TextInputProps>((props, ref) => (
  <TextInput
    {...props}
    ref={ref}
    accessibilityLabel={props.accessibilityLabel ?? props.placeholder}
  />
));

AccessibleTextInput.displayName = 'AccessibleTextInput';

export default AccessibleTextInput;
