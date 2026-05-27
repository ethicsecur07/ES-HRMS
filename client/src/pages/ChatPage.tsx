import React, { useEffect, useState, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { chatApi } from '../api_service/chatApi';
import { employeeApi } from '../api_service/employeeApi';
import { projectApi } from '../api_service/projectApi';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import {
  MessageSquare, Send, Users, Radio, Hash, Volume2, Search,
  Shield, Check, User, Circle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type SidebarTab = 'direct' | 'groups' | 'broadcast';

export const ChatPage: React.FC = () => {
  const { user } = useAuthStore();
  const { socket, setActiveChatUserId } = useNotificationStore();
  const [activeTab, setActiveTab] = useState<SidebarTab>('direct');
  const [selectedUser, setSelectedUser] = useState<string | null>(null); // acts as receiverId (can be userId, group_*, or 'broadcast')
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const lastScrollUserRef = useRef<string | null>(null);
  const lastMessageCountRef = useRef<number>(0);
  const lastMessageIdRef = useRef<string | null>(null);

  // Fetch employees
  const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeApi.getAll()
  });
  const employees = employeesData?.employees || [];

  // Fetch projects (for project groups)
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.getProjects()
  });
  const projects = projectsData?.projects || [];

  // Get unique departments
  const departments = Array.from(new Set(employees.map(emp => emp.department).filter(Boolean)));

  // Fetch messages for selected conversation
  const { data: messages = [], refetch } = useQuery({
    queryKey: ['chat', selectedUser],
    queryFn: () => chatApi.getConversation(selectedUser!),
    enabled: !!selectedUser,
    refetchInterval: 5000 // Fallback poll
  });

  const sendMutation = useMutation({
    mutationFn: () => chatApi.sendMessage(selectedUser!, message),
    onSuccess: () => {
      setMessage('');
      refetch();
    }
  });

  // Socket listener for incoming messages
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (msg: any) => {
      const isBroadcastForCurrentSelection = selectedUser === 'broadcast' && msg.receiverId === 'broadcast';
      const isGroupForCurrentSelection = selectedUser?.startsWith('group_') && msg.receiverId === selectedUser;
      const isDirectForCurrentSelection =
        !selectedUser?.startsWith('group_') &&
        selectedUser !== 'broadcast' &&
        ((msg.senderId === selectedUser && msg.receiverId === user?._id) ||
         (msg.senderId === user?._id && msg.receiverId === selectedUser));

      if (isBroadcastForCurrentSelection || isGroupForCurrentSelection || isDirectForCurrentSelection) {
        refetch();
      }
    };

    socket.on('receive_message', handleReceiveMessage);
    return () => {
      socket.off('receive_message', handleReceiveMessage);
    };
  }, [socket, selectedUser, user?._id, refetch]);

  // Join group rooms when selected
  useEffect(() => {
    if (socket && selectedUser && (selectedUser.startsWith('group_') || selectedUser === 'broadcast')) {
      socket.emit('join_room', selectedUser);
    }
  }, [socket, selectedUser]);

  // Manage Active Chat User context for notifications
  useEffect(() => {
    setActiveChatUserId(selectedUser);
    return () => {
      setActiveChatUserId(null);
    };
  }, [selectedUser, setActiveChatUserId]);

  // Auto-scroll messages
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
      messagesEndRef.current?.scrollIntoView({ behavior: userChanged ? 'auto' : 'smooth' });
      
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

  const getSenderName = (senderId: string) => {
    if (senderId === user?._id) return 'You';
    const emp = employees.find(e => e.userId === senderId);
    return emp ? emp.fullName : 'System';
  };

  const getSenderRole = (senderId: string) => {
    const emp = employees.find(e => e.userId === senderId);
    return emp ? emp.designation : '';
  };

  const filteredEmployees = employees.filter((emp: any) =>
    emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.department && emp.department.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const filteredProjects = projects.filter((p: any) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredDepartments = departments.filter((d: any) =>
    d.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Helper to determine the header title
  const getHeaderTitle = () => {
    if (selectedUser === 'broadcast') return 'Global Organization Broadcast';
    if (selectedUser?.startsWith('group_project_')) {
      const projId = selectedUser.replace('group_project_', '');
      const p = projects.find((proj: any) => proj._id === projId);
      return p ? `Project Group: ${p.name}` : 'Project Group';
    }
    if (selectedUser?.startsWith('group_dept_')) {
      const deptName = selectedUser.replace('group_dept_', '');
      return `Department Group: ${deptName}`;
    }
    const emp = employees.find(e => e.userId === selectedUser);
    return emp ? emp.fullName : 'Conversation';
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-4 bg-background/20 font-sans">
      {/* Sidebar List */}
      <Card className="w-1/3 flex flex-col overflow-hidden border border-white/10 bg-card/60 backdrop-blur-md">
        {/* Search */}
        <div className="p-4 border-b border-white/10 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search chat..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl pl-9 pr-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary/50 transition-colors"
            />
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-white/5 p-1 rounded-xl gap-1">
            <button
              onClick={() => { setActiveTab('direct'); setSelectedUser(null); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'direct' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <User className="w-3.5 h-3.5" /> DMs
            </button>
            <button
              onClick={() => { setActiveTab('groups'); setSelectedUser(null); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'groups' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Users className="w-3.5 h-3.5" /> Groups
            </button>
            <button
              onClick={() => { setActiveTab('broadcast'); setSelectedUser(null); }}
              className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'broadcast' ? 'bg-primary text-white shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              <Radio className="w-3.5 h-3.5" /> Broadcast
            </button>
          </div>
        </div>

        {/* Tab Lists */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          <AnimatePresence mode="wait">
            {activeTab === 'direct' && (
              <motion.div
                key="direct"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-1"
              >
                {filteredEmployees.map(emp => (
                  emp.userId && emp.userId !== user?._id && (
                    <button
                      key={emp._id}
                      onClick={() => setSelectedUser(emp.userId || null)}
                      className={`w-full text-left px-4 py-3 rounded-xl transition-all flex items-center justify-between gap-3 ${
                        selectedUser === emp.userId ? 'bg-primary text-white shadow-lg' : 'hover:bg-white/5 text-foreground'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-primary font-bold text-sm shrink-0 overflow-hidden">
                          {emp.profileImage ? (
                            <img src={emp.profileImage} alt="" className="w-full h-full object-cover" />
                          ) : (
                            emp.fullName.charAt(0).toUpperCase()
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm truncate">{emp.fullName}</div>
                          <div className={`text-[10px] truncate ${selectedUser === emp.userId ? 'text-white/80 font-semibold' : 'text-slate-400'}`}>
                            {emp.designation} · {emp.department}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-extrabold uppercase ${
                          emp.userId === user?._id ? 'bg-white/10 text-white' :
                          (emp as any).role === 'ADMIN' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                          (emp as any).role === 'HR' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                          (emp as any).role === 'MANAGER' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                          'bg-slate-500/10 text-slate-400'
                        }`}>
                          {(emp as any).role || 'Staff'}
                        </span>
                        <div className="flex items-center gap-1">
                          <Circle className="w-2 h-2 fill-emerald-500 text-emerald-500" />
                          <span className="text-[9px] text-slate-500">online</span>
                        </div>
                      </div>
                    </button>
                  )
                ))}
              </motion.div>
            )}

            {activeTab === 'groups' && (
              <motion.div
                key="groups"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-4"
              >
                {/* Project Groups */}
                <div>
                  <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 px-3 mb-2">Project Channels</h4>
                  <div className="space-y-1">
                    {filteredProjects.map((p: any) => (
                      <button
                        key={p._id}
                        onClick={() => setSelectedUser(`group_project_${p._id}`)}
                        className={`w-full text-left px-4 py-2.5 rounded-xl transition-all flex items-center gap-2.5 ${
                          selectedUser === `group_project_${p._id}` ? 'bg-primary text-white shadow-lg' : 'hover:bg-white/5 text-foreground'
                        }`}
                      >
                        <Hash className="w-4 h-4 shrink-0 opacity-60" />
                        <div className="min-w-0">
                          <div className="font-bold text-sm truncate">{p.name}</div>
                          <div className={`text-[10px] truncate ${selectedUser === `group_project_${p._id}` ? 'text-white/80' : 'text-slate-500'}`}>
                            Project Members
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Department Groups */}
                <div>
                  <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 px-3 mb-2">Department Channels</h4>
                  <div className="space-y-1">
                    {filteredDepartments.map(dept => (
                      <button
                        key={dept}
                        onClick={() => setSelectedUser(`group_dept_${dept}`)}
                        className={`w-full text-left px-4 py-2.5 rounded-xl transition-all flex items-center gap-2.5 ${
                          selectedUser === `group_dept_${dept}` ? 'bg-primary text-white shadow-lg' : 'hover:bg-white/5 text-foreground'
                        }`}
                      >
                        <Hash className="w-4 h-4 shrink-0 opacity-60" />
                        <div className="min-w-0">
                          <div className="font-bold text-sm truncate">{dept}</div>
                          <div className={`text-[10px] truncate ${selectedUser === `group_dept_${dept}` ? 'text-white/80' : 'text-slate-500'}`}>
                            Department Members
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {activeTab === 'broadcast' && (
              <motion.div
                key="broadcast"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                className="space-y-1"
              >
                <button
                  onClick={() => setSelectedUser('broadcast')}
                  className={`w-full text-left px-4 py-3.5 rounded-xl transition-all flex items-center gap-3 ${
                    selectedUser === 'broadcast' ? 'bg-primary text-white shadow-lg' : 'hover:bg-white/5 text-foreground'
                  }`}
                >
                  <div className="p-2.5 bg-primary/20 text-primary rounded-xl shrink-0">
                    <Volume2 className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-bold text-sm">Tenant Broadcast</div>
                    <div className={`text-[10px] ${selectedUser === 'broadcast' ? 'text-white/80' : 'text-slate-500'}`}>
                      Announcements for everyone
                    </div>
                  </div>
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Card>

      {/* Conversation Panel */}
      <Card className="flex-1 flex flex-col overflow-hidden border border-white/10 bg-card/40 backdrop-blur-md">
        {selectedUser ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-card/60 shadow-sm z-10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedUser === 'broadcast' ? (
                  <div className="p-2.5 bg-primary/10 text-primary rounded-xl border border-primary/20">
                    <Volume2 className="w-5 h-5" />
                  </div>
                ) : selectedUser?.startsWith('group_') ? (
                  <div className="p-2.5 bg-primary/10 text-primary rounded-xl border border-primary/20">
                    <Users className="w-5 h-5" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                    {getHeaderTitle().charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <h3 className="font-bold text-base text-white">{getHeaderTitle()}</h3>
                  <p className="text-[10px] text-slate-500 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-slate-600" /> End-to-end scope isolated
                  </p>
                </div>
              </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-950/10">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-500 flex-col gap-2">
                  <MessageSquare className="w-8 h-8 opacity-20" />
                  <p className="text-sm">No messages yet. Send a message to start.</p>
                </div>
              ) : (
                messages.map(msg => {
                  const isMe = msg.senderId === user?._id;
                  return (
                    <div key={msg._id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {/* Show sender name for group & broadcast channels */}
                      {!isMe && (selectedUser.startsWith('group_') || selectedUser === 'broadcast') && (
                        <span className="text-[10px] text-slate-500 mb-1 ml-2 font-semibold">
                          {getSenderName(msg.senderId)} <span className="text-[9px] text-slate-600 font-medium">({getSenderRole(msg.senderId)})</span>
                        </span>
                      )}
                      <div className={`max-w-[70%] p-3 rounded-2xl ${
                        isMe ? 'bg-primary text-white rounded-br-none shadow-md' : 'bg-card border border-white/5 rounded-bl-none shadow-sm text-slate-200'
                      }`}>
                        <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                        <span className={`text-[9px] mt-1.5 block text-right opacity-60 flex items-center justify-end gap-1 font-medium`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isMe && <Check className="w-3 h-3 text-white/50" />}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input form */}
            <form onSubmit={handleSend} className="p-4 border-t border-white/10 bg-card/60 flex gap-2">
              <input
                type="text"
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder={
                  selectedUser === 'broadcast' ? 'Broadcast announcement...' :
                  selectedUser.startsWith('group_') ? 'Message group...' :
                  'Type a message...'
                }
                className="flex-1 h-10 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-primary/50 transition-colors disabled:opacity-50"
              />
              <Button type="submit" disabled={!message.trim() || sendMutation.isPending} className="shrink-0 flex items-center gap-2 px-4 h-10 rounded-xl">
                <Send className="w-4 h-4" /> Send
              </Button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-slate-500 flex-col gap-3 p-8">
            <div className="p-4 bg-primary/5 text-primary rounded-2xl border border-primary/10">
              <MessageSquare className="w-12 h-12 opacity-30" />
            </div>
            <h4 className="font-bold text-white text-base">EthicSecur Realtime Chat</h4>
            <p className="text-sm text-slate-400 max-w-sm text-center font-medium">Select a direct conversation, group channel, or broadcast feed from the sidebar to begin chatting.</p>
          </div>
        )}
      </Card>
    </div>
  );
};
