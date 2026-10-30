import type { Chat, Message } from '../types';

export const getChatKey = (participants: string[], propertyId?: string) =>
  JSON.stringify([[...participants].sort(), propertyId ?? null]);

export const buildChatsFromMessages = (items: Message[]): Chat[] => {
  const chats = new Map<string, Chat>();
  for (const message of items) {
    const participants = [message.senderId, message.receiverId].sort();
    const key = getChatKey(participants, message.propertyId);
    const existing = chats.get(key);
    const unreadCount = existing?.unreadCount ? { ...existing.unreadCount } : {};
    if (!message.read) {
      unreadCount[message.receiverId] = (unreadCount[message.receiverId] || 0) + 1;
    }

    const lastMessage =
      !existing?.lastMessage ||
      new Date(message.timestamp).getTime() > new Date(existing.lastMessage.timestamp).getTime()
        ? message
        : existing.lastMessage;
    const updatedAt =
      !existing?.updatedAt ||
      new Date(message.timestamp).getTime() > new Date(existing.updatedAt).getTime()
        ? message.timestamp
        : existing.updatedAt;
    chats.set(key, {
      id: existing?.id ?? key,
      participants,
      propertyId: message.propertyId,
      lastMessage,
      updatedAt,
      unreadCount,
    });
  }
  return Array.from(chats.values()).sort(
    (first, second) => new Date(second.updatedAt).getTime() - new Date(first.updatedAt).getTime()
  );
};
