import React, { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { chatApi } from '../api_service/chatApi';
import { employeeApi } from '../api_service/employeeApi';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { MessageSquare, Send } from 'lucide-react';

export const ChatPage: React.FC = () => {
  const { user } = useAuthStore();
  const { setActiveChatUserId } = useNotificationStore();
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const lastScrollUserRef = useRef<string | null>(null);
  const lastMessageCountRef = useRef<number>(0);
  const lastMessageIdRef = useRef<string | null>(null);

  const { data } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeApi.getAll()
  });

  const employees = data?.employees || [];

  const { data: messages = [], refetch } = useQuery({
    queryKey: ['chat', selectedUser],
    queryFn: () => chatApi.getConversation(selectedUser!),
    enabled: !!selectedUser,
    refetchInterval: 3000 // Poll as a fallback if socket misses
  });

  const sendMutation = useMutation({
    mutationFn: () => chatApi.sendMessage(selectedUser!, message),
    onSuccess: () => {
      setMessage('');
      refetch();
    }
  });

  useEffect(() => {
    setActiveChatUserId(selectedUser);
    return () => {
      setActiveChatUserId(null);
    };
  }, [selectedUser, setActiveChatUserId]);

  useEffect(() => {
    if (!selectedUser) {
      lastScrollUserRef.current = null;
      lastMessageCountRef.current = 0;
      lastMessageIdRef.current = null;
      return;
    }

    const currentLength = messages.length;
    const currentLastMessageId = currentLength > 0 ? messages[currentLength - 1]._id : null;

    const userChanged = lastScrollUserRef.current !== selectedUser;
    const newMessagesReceived = currentLength > lastMessageCountRef.current || currentLastMessageId !== lastMessageIdRef.current;

    if (userChanged || newMessagesReceived) {
      messagesEndRef.current?.scrollIntoView({ behavior: userChanged ? "auto" : "smooth" });
      
      lastScrollUserRef.current = selectedUser;
      lastMessageCountRef.current = currentLength;
      lastMessageIdRef.current = currentLastMessageId;
    }
  }, [messages, selectedUser]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !selectedUser) return;
    sendMutation.mutate();
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4">
      <Card className="w-1/3 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-border bg-muted/30">
          <h2 className="font-bold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" /> Employees Directory
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {employees.map(emp => (
            emp.userId && emp.userId !== user?._id && (
              <button
                key={emp._id}
                onClick={() => setSelectedUser(emp.userId || null)}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center gap-3 ${
                  selectedUser === emp.userId ? 'bg-primary text-primary-foreground shadow-md' : 'hover:bg-muted text-foreground'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-slate-300 overflow-hidden shrink-0">
                  {emp.profileImage ? <img src={emp.profileImage} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-400"></div>}
                </div>
                <div>
                  <div className="font-bold text-sm">{emp.fullName}</div>
                  <div className={`text-[10px] ${selectedUser === emp.userId ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>{emp.designation}</div>
                </div>
              </button>
            )
          ))}
        </div>
      </Card>

      <Card className="flex-1 flex flex-col overflow-hidden">
        {selectedUser ? (
          <>
            <div className="p-4 border-b border-border bg-muted/30 shadow-sm z-10">
              <h3 className="font-bold text-lg">Conversation</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-muted/5">
              {messages.map(msg => {
                const isMe = msg.senderId === user?._id;
                return (
                  <div key={msg._id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[70%] p-3 rounded-2xl ${
                      isMe ? 'bg-primary text-primary-foreground rounded-br-none shadow-md' : 'bg-card border border-border rounded-bl-none shadow-sm'
                    }`}>
                      <p className="text-sm">{msg.content}</p>
                      <span className={`text-[9px] mt-1 block text-right opacity-70`}>
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
            <form onSubmit={handleSend} className="p-4 border-t border-border bg-card flex gap-2">
              <input
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 h-10 rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors disabled:opacity-50"
              />
              <Button type="submit" disabled={!message.trim() || sendMutation.isPending} className="shrink-0 flex items-center gap-2">
                <Send className="w-4 h-4" /> Send
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground flex-col gap-3">
            <MessageSquare className="w-12 h-12 opacity-20" />
            <p>Select an employee to start chatting</p>
          </div>
        )}
      </Card>
    </div>
  );
};
