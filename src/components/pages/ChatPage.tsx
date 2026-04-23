import React, { useEffect, useMemo } from 'react';
import { useStore } from '@nanostores/react';
import AppLayout from '../AppLayout';
import ChatView from '../../views/ChatView';
import { $chats, $activeChatId, $language, ensureChat } from '../../stores/app';
import { getT } from '../../translations';

const ChatPage: React.FC = () => {
  const chats = useStore($chats);
  const activeChatId = useStore($activeChatId);
  const language = useStore($language);
  const t = useMemo(() => getT(language), [language]);

  useEffect(() => { ensureChat(); }, []);

  const activeChat = useMemo(() => {
    if (!chats.length) return null;
    return chats.find(c => c.id === activeChatId) || chats[0];
  }, [chats, activeChatId]);

  return (
    <AppLayout currentPath="/">
      {activeChat
        ? <ChatView activeChat={activeChat} />
        : <div className="flex items-center justify-center h-full text-[10px] font-black uppercase text-charcoal/20 animate-pulse">{t.chat.initializing}</div>
      }
    </AppLayout>
  );
};

export default ChatPage;
