import type { KeyboardTypeOptions } from 'react-native';

export type AppAlertButton = {
  text: string;
  onPress?: (value?: string) => void;
  style?: 'default' | 'cancel' | 'destructive';
};

type AppAlertOptions = {
  cancelable?: boolean;
  onDismiss?: () => void;
};

export type AppAlertRequest = {
  title: string;
  message?: string;
  buttons?: AppAlertButton[];
  options?: AppAlertOptions;
  input?: {
    defaultValue?: string;
    keyboardType?: KeyboardTypeOptions;
  };
};

type AlertListener = (request: AppAlertRequest) => void;

let listener: AlertListener | null = null;
const pendingRequests: AppAlertRequest[] = [];

export const registerAppAlertListener = (nextListener: AlertListener | null) => {
  listener = nextListener;
  if (listener) {
    while (pendingRequests.length > 0) {
      listener(pendingRequests.shift()!);
    }
  }
};

const alert = (
  title: string,
  message?: string,
  buttons?: AppAlertButton[],
  options?: AppAlertOptions
) => {
  const request = { title, message, buttons, options };
  if (listener) {
    listener(request);
  } else {
    pendingRequests.push(request);
  }
};

const prompt = (
  title: string,
  message?: string,
  buttons?: AppAlertButton[],
  _type?: 'default' | 'plain-text' | 'secure-text' | 'login-password',
  defaultValue?: string,
  keyboardType?: KeyboardTypeOptions,
  options?: AppAlertOptions
) => {
  const request: AppAlertRequest = {
    title,
    message,
    buttons,
    options,
    input: { defaultValue, keyboardType },
  };
  if (listener) {
    listener(request);
  } else {
    pendingRequests.push(request);
  }
};

export const AppAlert = { alert, prompt };
