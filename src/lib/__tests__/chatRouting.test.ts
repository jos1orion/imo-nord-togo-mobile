import { describe, expect, it } from '@jest/globals';
import { buildChatsFromMessages, getChatKey } from '../chatRouting';

describe('getChatKey', () => {
  it('routes a direct message to the same private conversation regardless of participant order', () => {
    expect(getChatKey(['agent-1', 'user-2'])).toBe(getChatKey(['user-2', 'agent-1']));
  });

  it('keeps conversations for different participants or properties separate', () => {
    expect(getChatKey(['agent-1', 'user-2'])).not.toBe(getChatKey(['agent-1', 'user-3']));
    expect(getChatKey(['agent-1', 'user-2'], 'property-1'))
      .not.toBe(getChatKey(['agent-1', 'user-2'], 'property-2'));
  });

  it('builds an agent-specific thread with the correct unread recipient and latest message', () => {
    const messages = [
      {
        id: 'm1',
        senderId: 'client-1',
        receiverId: 'agent-1',
        content: 'First',
        timestamp: '2026-10-28T10:00:00.000Z',
        read: false,
        type: 'text' as const,
      },
      {
        id: 'm2',
        senderId: 'agent-1',
        receiverId: 'client-1',
        content: 'Reply',
        timestamp: '2026-10-28T10:01:00.000Z',
        read: true,
        type: 'text' as const,
      },
      {
        id: 'm3',
        senderId: 'client-2',
        receiverId: 'agent-2',
        content: 'Other agent',
        timestamp: '2026-10-28T10:02:00.000Z',
        read: false,
        type: 'text' as const,
      },
    ];

    const chats = buildChatsFromMessages(messages);
    const agentOneChat = chats.find(chat => chat.participants.includes('agent-1'));

    expect(chats).toHaveLength(2);
    expect(agentOneChat?.participants).toEqual(['agent-1', 'client-1']);
    expect(agentOneChat?.lastMessage?.content).toBe('Reply');
    expect(agentOneChat?.unreadCount).toEqual({ 'agent-1': 1 });
  });
});
