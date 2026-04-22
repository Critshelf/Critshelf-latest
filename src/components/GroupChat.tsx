import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Send, Smile, MoreHorizontal, Crown } from 'lucide-react';
import { db, OperationType, handleFirestoreError } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  updateDoc,
  doc,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore';
import { cn } from '../lib/utils';
import { useUser } from '../contexts/UserContext';
import UserAvatar from './UserAvatar';

interface ChatMessage {
  id: string;
  groupId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  reactions?: { [key: string]: string[] };
  createdAt: any;
}

interface GroupChatProps {
  groupId: string;
}

const REACTION_ICONS = {
  meeple: '♟️',
  die: '🎲',
  crown: '👑'
};

export default function GroupChat({ groupId }: GroupChatProps) {
  const { user, profile } = useUser();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!groupId || !user) return;

    const q = query(
      collection(db, 'messages'),
      where('groupId', '==', groupId),
      orderBy('createdAt', 'asc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
      if (msgs.length === 0 && user) {
        seedMockChat(groupId);
      } else {
        setMessages(msgs);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'messages');
    });

    return () => unsubscribe();
  }, [groupId, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const seedMockChat = async (groupId: string) => {
    if (!user) return;
    
    const mockMessages = [
      {
        groupId,
        userId: 'natasha_id',
        userName: 'Natasha',
        userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Natasha',
        text: "Are we ordering pizza for Saturday?",
        reactions: { meeple: ['natasha_id'] },
        createdAt: serverTimestamp()
      },
      {
        groupId,
        userId: user.uid,
        userName: user.displayName || 'Me',
        userAvatar: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        text: "Yes! I'll put an order in. Also, I'm bringing my new copy of Love Letter!",
        createdAt: serverTimestamp()
      },
      {
        groupId,
        userId: 'corey_id',
        userName: 'Corey',
        userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Corey',
        text: "Can't wait! I'm also bringing my 'Worker Removal' prototype. It's finally ready for a group test! 🎲",
        reactions: { die: ['natasha_id'] },
        createdAt: serverTimestamp()
      },
      {
        groupId,
        userId: 'natasha_id',
        userName: 'Natasha',
        userAvatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Natasha',
        text: "Worker Removal? Sounds brutal... I'm in! 👑",
        createdAt: serverTimestamp()
      }
    ];

    for (const msg of mockMessages) {
      await addDoc(collection(db, 'messages'), msg);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user || isSending) return;

    setIsSending(true);
    try {
      await addDoc(collection(db, 'messages'), {
        groupId,
        userId: user.uid,
        userName: profile?.displayName || user.displayName || 'Me',
        userAvatar: profile?.photoURL || user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
        avatarPreference: profile?.avatarPreference || 'google',
        avatarSeed: profile?.avatarSeed || user.uid,
        text: newMessage.trim(),
        createdAt: serverTimestamp()
      });
      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'messages');
    } finally {
      setIsSending(false);
    }
  };

  const toggleReaction = async (messageId: string, reactionType: string) => {
    if (!user) return;
    const messageRef = doc(db, 'messages', messageId);
    const message = messages.find(m => m.id === messageId);
    const hasReacted = message?.reactions?.[reactionType]?.includes(user.uid);

    try {
      await updateDoc(messageRef, {
        [`reactions.${reactionType}`]: hasReacted 
          ? arrayRemove(user.uid) 
          : arrayUnion(user.uid)
      });
    } catch (error) {
      console.error("Error toggling reaction:", error);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-white/5 backdrop-blur-xl rounded-[3rem] shadow-2xl border border-white/10 overflow-hidden">
      {/* Chat Header */}
      <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-accent/10 rounded-xl flex items-center justify-center text-emerald-accent shadow-md border border-emerald-accent/20">
            <Smile className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-black text-white tracking-tight">Group Chat</h3>
            <p className="text-[10px] font-black text-emerald-accent/60 uppercase tracking-widest">Real-time updates</p>
          </div>
        </div>
        <button className="p-2 hover:bg-white/5 rounded-xl transition-colors text-white/20">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar bg-charcoal/30"
      >
        {messages.map((msg, idx) => {
          const isMe = msg.userId === user?.uid;
          const showAvatar = idx === 0 || messages[idx - 1].userId !== msg.userId;

          return (
            <div 
              key={msg.id} 
              className={cn(
                "flex items-end gap-3",
                isMe ? "flex-row-reverse" : "flex-row"
              )}
            >
              {showAvatar ? (
                <UserAvatar 
                  user={{ 
                    photoURL: msg.userAvatar, 
                    avatarPreference: msg.avatarPreference, 
                    avatarSeed: msg.avatarSeed,
                    uid: msg.userId,
                    displayName: msg.userName 
                  }} 
                  size="xs" 
                  className="w-8 h-8 rounded-full border-2 border-white/10" 
                />
              ) : (
                <div className="w-8" />
              )}
              
              <div className={cn(
                "max-w-[70%] group relative",
                isMe ? "items-end" : "items-start"
              )}>
                {!isMe && showAvatar && (
                  <span className="text-[10px] font-black text-white/20 uppercase tracking-widest ml-2 mb-1 block">
                    {msg.userName}
                  </span>
                )}
                
                <div className={cn(
                  "p-4 rounded-[1.5rem] shadow-sm relative",
                  isMe 
                    ? "bg-emerald-accent text-charcoal rounded-br-none" 
                    : "bg-white/10 text-white rounded-bl-none border border-white/10"
                )}>
                  <p className="text-sm font-bold leading-relaxed">{msg.text}</p>
                  
                  {/* Reactions Display */}
                  {msg.reactions && Object.entries(msg.reactions).some(([_, uids]) => (uids as string[]).length > 0) && (
                    <div className={cn(
                      "absolute -bottom-3 flex gap-1",
                      isMe ? "right-0" : "left-0"
                    )}>
                      {Object.entries(msg.reactions).map(([type, uids]) => (
                        (uids as string[]).length > 0 && (
                          <button
                            key={type}
                            onClick={() => toggleReaction(msg.id, type)}
                            className="bg-charcoal border border-white/10 rounded-full px-1.5 py-0.5 shadow-sm flex items-center gap-1 hover:scale-110 transition-transform"
                          >
                            <span className="text-xs">{REACTION_ICONS[type as keyof typeof REACTION_ICONS]}</span>
                            <span className="text-[10px] font-black text-white/40">{(uids as string[]).length}</span>
                          </button>
                        )
                      ))}
                    </div>
                  )}
                </div>

                {/* Reaction Picker (Hover) */}
                <div className={cn(
                  "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 bg-charcoal p-1 rounded-full shadow-lg border border-white/10 z-10",
                  isMe ? "-left-20" : "-right-20"
                )}>
                  {Object.entries(REACTION_ICONS).map(([type, icon]) => (
                    <button
                      key={type}
                      onClick={() => toggleReaction(msg.id, type)}
                      className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
                    >
                      <span className="text-xs">{icon}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input Area */}
      <form 
        onSubmit={handleSendMessage}
        className="p-6 bg-white/5 border-t border-white/10 flex items-center gap-4"
      >
        <input
          type="text"
          placeholder="Type a message..."
          className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-6 py-4 font-bold outline-none focus:border-emerald-accent transition-all text-white placeholder:text-white/20"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          disabled={isSending}
        />
        <button
          type="submit"
          disabled={!newMessage.trim() || isSending}
          className="w-14 h-14 bg-emerald-accent text-charcoal rounded-2xl flex items-center justify-center shadow-lg hover:shadow-emerald-accent/20 transition-all disabled:opacity-50 active:scale-95"
        >
          <Send className="w-6 h-6" />
        </button>
      </form>
    </div>
  );
}
