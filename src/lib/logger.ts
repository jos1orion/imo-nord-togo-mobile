type LogDetails = unknown;

export const logger = {
  debug(message: string, details?: LogDetails) {
    if (__DEV__) console.debug(message, details ?? '');
  },
  warn(message: string, details?: LogDetails) {
    if (__DEV__) console.warn(message, details ?? '');
  },
  error(message: string, details?: LogDetails) {
    console.error(message, details ?? '');
  },
};
