import { Platform, Share } from 'react-native';

export type ShareContent = {
  title?: string;
  message: string;
  url?: string;
};

export type ShareContentResult = 'shared' | 'copied' | 'cancelled';

const getShareText = ({ message, url }: ShareContent) =>
  [message, url && !message?.includes(url) ? url : null]
    .filter((value): value is string => Boolean(value))
    .join('\n');

export const shareContent = async (
  content: ShareContent
): Promise<ShareContentResult> => {
  if (Platform.OS !== 'web') {
    await Share.share(content);
    return 'shared';
  }

  const text = getShareText(content);
  if (!text) throw new Error('There is no content to share.');

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: content.title,
        text: content.message,
        url: content.url,
      });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }
      if (!navigator.clipboard?.writeText) throw error;
    }
  }

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return 'copied';
  }

  throw new Error('Sharing and clipboard access are unavailable in this browser.');
};
