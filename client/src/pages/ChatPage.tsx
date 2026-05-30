import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { chatApi } from '../api_service/chatApi';
import { employeeApi } from '../api_service/employeeApi';
import { projectApi } from '../api_service/projectApi';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MessageSquare, Send, Users, Radio, Hash, Volume2, Search,
  Shield, CheckCheck, Check, User, Paperclip, X,
  FileText, Download, Smile, ChevronLeft
} from 'lucide-react';

type SidebarTab = 'direct' | 'groups' | 'broadcast';

// ── Emoji Quick-Picker ────────────────────────────────────────────────────────
const QUICK_EMOJIS = ['😊', '😂', '❤️', '👍', '🙏', '🔥', '😮', '👏', '🎉', '😢', '🤔', '💯', '✅', '🚀', '💪'];

// ── Utility: format file size ─────────────────────────────────────────────────
const formatFileSize = (bytes?: number) => {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ── Utility: group messages by date ──────────────────────────────────────────
const formatDateLabel = (dateStr: string) => {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
};

export const ChatPage: React.FC = () => {
  const { user } = useAuthStore();
  const { socket, setActiveChatUserId, onlineUserIds, unreadChatCounts, lastMessageAt, clearUnreadChat } = useNotificationStore();
  const qc = useQueryClient();
  const otherOnlineCount = onlineUserIds.filter(id => id !== user?._id).length;

  const { data: recentConversations = [] } = useQuery({
    queryKey: ['chat', 'recent'],
    queryFn: () => chatApi.getRecentConversations(),
  });

  useEffect(() => {
    if (recentConversations.length > 0) {
      const updates: Record<string, string> = {};
      recentConversations.forEach((conv: any) => {
        if (conv._id && conv.lastMessageAt) {
          updates[conv._id] = conv.lastMessageAt;
        }
      });
      useNotificationStore.setState((s) => ({
        lastMessageAt: { ...s.lastMessageAt, ...updates }
      }));
    }
  }, [recentConversations]);

  const [activeTab, setActiveTab] = useState<SidebarTab>('direct');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [filePreview, setFilePreview] = useState<{ file: File; previewUrl: string } | null>(null);
  const [activeImageUrl, setActiveImageUrl] = useState<string | null>(null);


  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastScrollUserRef = useRef<string | null>(null);
  const lastMessageCountRef = useRef<number>(0);
  const lastMessageIdRef = useRef<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ── Data queries ─────────────────────────────────────────────────────────────
  const { data: employeesData } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeApi.getAll(),
  });
  const employees = employeesData?.employees || [];

  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectApi.getProjects(),
  });
  const projects = projectsData?.projects || [];

  const departments = Array.from(new Set(employees.map(emp => emp.department).filter(Boolean)));

  const { data: messages = [] } = useQuery({
    queryKey: ['chat', selectedUser],
    queryFn: () => chatApi.getConversation(selectedUser!),
    enabled: !!selectedUser,
    refetchInterval: 8000,
  });

  // ── Unread count per conversation (from store, driven by socket) ──────────
  // (no local state needed — comes directly from notification store)

  // ── Send text mutation ────────────────────────────────────────────────────
  const sendMutation = useMutation({
    mutationFn: () => chatApi.sendMessage(selectedUser!, message.trim()),
    onSuccess: (newMsg) => {
      setMessage('');
      qc.setQueryData<typeof messages>(['chat', selectedUser], (old = []) => [...old, newMsg]);
      useNotificationStore.setState((s) => ({
        lastMessageAt: { ...s.lastMessageAt, [selectedUser!]: newMsg.createdAt || new Date().toISOString() }
      }));
      qc.invalidateQueries({ queryKey: ['chat', 'recent'] });
    },
  });

  // ── Send file mutation ────────────────────────────────────────────────────
  const fileMutation = useMutation({
    mutationFn: (file: File) => chatApi.sendFile(selectedUser!, file),
    onSuccess: (newMsg) => {
      setFilePreview(null);
      qc.setQueryData<typeof messages>(['chat', selectedUser], (old = []) => [...old, newMsg]);
      useNotificationStore.setState((s) => ({
        lastMessageAt: { ...s.lastMessageAt, [selectedUser!]: newMsg.createdAt || new Date().toISOString() }
      }));
      qc.invalidateQueries({ queryKey: ['chat', 'recent'] });
    },
  });

  // ── Socket: receive messages ──────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const handleReceiveMessage = (msg: any) => {
      const isBroadcast = selectedUser === 'broadcast' && msg.receiverId === 'broadcast';
      const isGroup = selectedUser?.startsWith('group_') && msg.receiverId === selectedUser;
      const isDirect =
        !selectedUser?.startsWith('group_') &&
        selectedUser !== 'broadcast' &&
        ((msg.senderId === selectedUser && msg.receiverId === user?._id) ||
          (msg.senderId === user?._id && msg.receiverId === selectedUser));

      if (isBroadcast || isGroup || isDirect) {
        qc.setQueryData<typeof messages>(['chat', selectedUser], (old = []) => {
          const exists = old.some(m => m._id === msg._id);
          return exists ? old : [...old, msg];
        });
      }
    };

    const handleMessagesRead = ({ messageIds }: { messageIds: string[] }) => {
      if (!selectedUser) return;
      qc.setQueryData<typeof messages>(['chat', selectedUser], (old = []) =>
        old.map(m => messageIds.includes(m._id) ? { ...m, read: true } : m)
      );
    };

    const handleMessageRead = ({ messageId }: { messageId: string }) => {
      if (!selectedUser) return;
      qc.setQueryData<typeof messages>(['chat', selectedUser], (old = []) =>
        old.map(m => m._id === messageId ? { ...m, read: true } : m)
      );
    };

    const handleUserTyping = ({ userId, receiverId }: { userId: string; receiverId: string }) => {
      const isRelevant =
        receiverId === selectedUser ||
        (selectedUser?.startsWith('group_') && receiverId === selectedUser) ||
        (selectedUser === 'broadcast' && receiverId === 'broadcast');
      if (isRelevant && userId !== user?._id) {
        setTypingUsers(prev => prev.includes(userId) ? prev : [...prev, userId]);
      }
    };

    const handleUserStopTyping = ({ userId }: { userId: string }) => {
      setTypingUsers(prev => prev.filter(id => id !== userId));
    };

    socket.on('receive_message', handleReceiveMessage);
    socket.on('messages_read', handleMessagesRead);
    socket.on('message_read', handleMessageRead);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stop_typing', handleUserStopTyping);

    return () => {
      socket.off('receive_message', handleReceiveMessage);
      socket.off('messages_read', handleMessagesRead);
      socket.off('message_read', handleMessageRead);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stop_typing', handleUserStopTyping);
    };
  }, [socket, selectedUser, user?._id, qc]);

  // ── Join group/broadcast rooms ────────────────────────────────────────────
  useEffect(() => {
    if (socket && selectedUser && (selectedUser.startsWith('group_') || selectedUser === 'broadcast')) {
      socket.emit('join_room', selectedUser);
    }
  }, [socket, selectedUser]);

  // ── Active chat context + clear unread when opening ─────────────────────
  useEffect(() => {
    setActiveChatUserId(selectedUser);
    // Clear unread badge for this conversation when it's opened
    if (selectedUser) clearUnreadChat(selectedUser);
    return () => { setActiveChatUserId(null); };
  }, [selectedUser, setActiveChatUserId, clearUnreadChat]);

  // Update lastMessageAt dynamically when messages are fetched/loaded
  useEffect(() => {
    if (selectedUser && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      const time = lastMsg.createdAt;
      useNotificationStore.setState((s) => ({
        lastMessageAt: { ...s.lastMessageAt, [selectedUser]: time }
      }));
    }
  }, [messages, selectedUser]);

  // ── Auto-scroll messages ──────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedUser) {
      lastScrollUserRef.current = null;
      lastMessageCountRef.current = 0;
      lastMessageIdRef.current = null;
      return;
    }
    const currentLength = messages.length;
    const currentLastId = currentLength > 0 ? messages[currentLength - 1]._id : null;
    const userChanged = lastScrollUserRef.current !== selectedUser;
    const newMessages = currentLength > lastMessageCountRef.current || currentLastId !== lastMessageIdRef.current;

    if (userChanged || newMessages) {
      messagesEndRef.current?.scrollIntoView({ behavior: userChanged ? 'auto' : 'smooth' });
      lastScrollUserRef.current = selectedUser;
      lastMessageCountRef.current = currentLength;
      lastMessageIdRef.current = currentLastId;
    }
  }, [messages, selectedUser]);

  // ── Typing indicator emit ─────────────────────────────────────────────────
  const handleTyping = useCallback((val: string) => {
    setMessage(val);
    if (!socket || !selectedUser) return;
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    socket.emit('typing_start', { receiverId: selectedUser });
    typingTimerRef.current = setTimeout(() => {
      socket.emit('typing_stop', { receiverId: selectedUser });
    }, 2000);
  }, [socket, selectedUser]);

  // ── Send handlers ─────────────────────────────────────────────────────────
  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (filePreview) {
      fileMutation.mutate(filePreview.file);
      return;
    }
    if (!message.trim() || !selectedUser) return;
    sendMutation.mutate();
    if (socket) socket.emit('typing_stop', { receiverId: selectedUser });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const previewUrl = file.type.startsWith('image/') ? URL.createObjectURL(file) : '';
    setFilePreview({ file, previewUrl });
    e.target.value = '';
  };

  const cancelFilePreview = () => {
    if (filePreview?.previewUrl) URL.revokeObjectURL(filePreview.previewUrl);
    setFilePreview(null);
  };

  // ── Helpers ───────────────────────────────────────────────────────────────
  const getSenderName = (senderId: string) => {
    if (senderId === user?._id) return 'You';
    const emp = employees.find(e => e.userId === senderId);
    return emp ? emp.fullName : 'Unknown';
  };

  const getSenderInitial = (senderId: string) => {
    const name = getSenderName(senderId);
    return name.charAt(0).toUpperCase();
  };

  const getSenderProfileImage = (senderId: string) => {
    const emp = employees.find(e => e.userId === senderId);
    return emp?.profileImage || null;
  };

  const isOnline = (userId: string) => onlineUserIds.includes(userId);

  const filteredEmployees = employees.filter((emp: any) =>
    emp.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (emp.department && emp.department.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  // ── DM list sorted by last message time (most recent on top) ────────────
  const sortedEmployees = React.useMemo(() => {
    return [...filteredEmployees].sort((a, b) => {
      const aTime = a.userId ? (lastMessageAt[a.userId] || '') : '';
      const bTime = b.userId ? (lastMessageAt[b.userId] || '') : '';
      // Descending: most recent first
      if (aTime > bTime) return -1;
      if (aTime < bTime) return 1;
      return 0;
    });
  }, [filteredEmployees, lastMessageAt]);

  const filteredProjects = projects.filter((p: any) => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const filteredDepartments = departments.filter((d: any) => d.toLowerCase().includes(searchTerm.toLowerCase()));

  const getHeaderTitle = () => {
    if (selectedUser === 'broadcast') return 'Global Organization Broadcast';
    if (selectedUser?.startsWith('group_project_')) {
      const projId = selectedUser.replace('group_project_', '');
      const p = projects.find((proj: any) => proj._id === projId);
      return p ? p.name : 'Project Group';
    }
    if (selectedUser?.startsWith('group_dept_')) {
      return selectedUser.replace('group_dept_', '');
    }
    const emp = employees.find(e => e.userId === selectedUser);
    return emp ? emp.fullName : 'Conversation';
  };

  const getHeaderSubtitle = () => {
    if (selectedUser === 'broadcast') return 'Announcement to all employees';
    if (selectedUser?.startsWith('group_project_')) return 'Project Channel';
    if (selectedUser?.startsWith('group_dept_')) return 'Department Channel';
    const emp = employees.find(e => e.userId === selectedUser);
    if (!emp) return '';
    return isOnline(selectedUser || '') ? 'Online' : emp.designation;
  };

  const getTypingLabel = () => {
    const names = typingUsers.map(id => {
      const e = employees.find(emp => emp.userId === id);
      return e ? e.fullName.split(' ')[0] : 'Someone';
    });
    if (names.length === 0) return null;
    if (names.length === 1) return `${names[0]} is typing...`;
    if (names.length === 2) return `${names[0]} and ${names[1]} are typing...`;
    return 'Several people are typing...';
  };

  // ── Message grouping ──────────────────────────────────────────────────────
  const groupedMessages = React.useMemo(() => {
    const groups: { date: string; msgs: typeof messages }[] = [];
    for (const msg of messages) {
      const label = formatDateLabel(msg.createdAt);
      const last = groups[groups.length - 1];
      if (last && last.date === label) {
        last.msgs.push(msg);
      } else {
        groups.push({ date: label, msgs: [msg] });
      }
    }
    return groups;
  }, [messages]);

  // ── Role badge color ──────────────────────────────────────────────────────
  const getRoleBadgeClass = (role: string) => {
    if (role === 'ADMIN') return 'bg-red-500/10 dark:bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20 dark:border-red-500/25';
    if (role === 'HR') return 'bg-indigo-500/10 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 dark:border-indigo-500/25';
    if (role === 'MANAGER') return 'bg-amber-500/10 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20 dark:border-amber-500/25';
    if (role === 'TEAM_LEAD') return 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/25';
    return 'bg-slate-500/10 dark:bg-slate-500/15 text-slate-600 dark:text-slate-400 border border-slate-500/15 dark:border-slate-500/20';
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-3 font-sans">

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <div
        className={`
          flex flex-col w-80 shrink-0 rounded-2xl border border-border
          bg-card shadow-sm overflow-hidden transition-all duration-300
          ${selectedUser ? 'hidden md:flex' : 'flex'}
        `}
      >
        {/* Sidebar header */}
        <div className="p-4 border-b border-border bg-card">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-extrabold text-base text-foreground tracking-tight">Messages</h2>
            <div className="flex items-center gap-1.5">
              <span
                className="w-2 h-2 rounded-full bg-primary animate-pulse"
                style={{ boxShadow: '0 0 6px 2px hsl(var(--primary) / 0.3)' }}
              ></span>
              <span className="text-[10px] text-muted-foreground font-semibold">{otherOnlineCount > 0 ? `${onlineUserIds.length} online` : 'online'}</span>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-muted/50 border border-border rounded-xl pl-9 pr-4 py-2 text-xs text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/40 focus:bg-background transition-all"
            />
          </div>

          {/* Tabs */}
          <div className="flex bg-muted/60 p-1 rounded-xl gap-1">
            {(['direct', 'groups', 'broadcast'] as SidebarTab[]).map(tab => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setSelectedUser(null); }}
                className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                  activeTab === tab
                    ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                }`}
              >
                {tab === 'direct' && <><User className="w-3 h-3" /> DMs</>}
                {tab === 'groups' && <><Users className="w-3 h-3" /> Groups</>}
                {tab === 'broadcast' && <><Radio className="w-3 h-3" /> Broadcast</>}
              </button>
            ))}
          </div>
        </div>

        {/* Sidebar list */}
        <div className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5 custom-scrollbar">
          <AnimatePresence mode="wait">

            {/* Direct Messages */}
            {activeTab === 'direct' && (
              <motion.div key="direct" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-0.5">
                {sortedEmployees.map(emp => {
                  if (!emp.userId || emp.userId === user?._id) return null;
                  const online = isOnline(emp.userId);
                  const isSelected = selectedUser === emp.userId;
                  const unread = unreadChatCounts[emp.userId] || 0;
                  return (
                    <button
                      key={emp._id}
                      onClick={() => setSelectedUser(emp.userId || null)}
                      className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 group ${
                        isSelected
                          ? 'bg-primary/10 border border-primary/20 shadow-sm'
                          : unread > 0
                            ? 'bg-primary/5 border border-primary/15 hover:bg-primary/10'
                            : 'hover:bg-muted/50 border border-transparent'
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold overflow-hidden border-2 ${isSelected ? 'border-primary/60' : 'border-border'}`}>
                          {emp.profileImage
                            ? <img src={emp.profileImage} alt="" className="w-full h-full object-cover" />
                            : <span className="bg-gradient-to-br from-primary/40 to-primary/20 text-primary w-full h-full flex items-center justify-center">{emp.fullName.charAt(0).toUpperCase()}</span>
                          }
                        </div>
                        <span
                          className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-card ${online ? 'bg-primary' : 'bg-muted-foreground/65'}`}
                          style={online ? { boxShadow: '0 0 4px 1px hsl(var(--primary) / 0.4)' } : undefined}
                        ></span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-1">
                          <span className={`text-xs truncate ${unread > 0 ? 'font-bold text-foreground' : 'font-semibold text-foreground/90'}`}>{emp.fullName}</span>
                          <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase shrink-0 ${getRoleBadgeClass((emp as any).role || '')}`}>
                            {(emp as any).role || 'Staff'}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] mt-0.5 min-w-0">
                          <div className="truncate pr-2">
                            {online
                              ? <span className="text-primary font-semibold">● Online</span>
                              : <span className="text-muted-foreground">{emp.designation}</span>
                            }
                          </div>
                          {unread > 0 && !isSelected && (
                            <span className="min-w-[18px] h-[18px] px-1.5 rounded-full bg-primary text-primary-foreground text-[9px] font-extrabold flex items-center justify-center shadow-lg shadow-primary/40 animate-pulse shrink-0">
                              {unread > 99 ? '99+' : unread}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
                {sortedEmployees.filter(e => e.userId && e.userId !== user?._id).length === 0 && (
                  <div className="text-center py-8 text-muted-foreground text-xs">No employees found</div>
                )}
              </motion.div>
            )}

            {/* Groups */}
            {activeTab === 'groups' && (
              <motion.div key="groups" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4 pt-1">
                {filteredProjects.length > 0 && (
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/80 px-3 mb-1.5">Project Channels</p>
                    <div className="space-y-0.5">
                      {filteredProjects.map((p: any) => {
                        const roomId = `group_project_${p._id}`;
                        const isSelected = selectedUser === roomId;
                        return (
                          <button
                            key={p._id}
                            onClick={() => setSelectedUser(roomId)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 ${
                              isSelected ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50 border border-transparent'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                              <Hash className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-xs text-foreground truncate">{p.name}</div>
                              <div className="text-[10px] text-muted-foreground">Project channel</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {filteredDepartments.length > 0 && (
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground/80 px-3 mb-1.5">Department Channels</p>
                    <div className="space-y-0.5">
                      {filteredDepartments.map(dept => {
                        const roomId = `group_dept_${dept}`;
                        const isSelected = selectedUser === roomId;
                        return (
                          <button
                            key={dept}
                            onClick={() => setSelectedUser(roomId)}
                            className={`w-full text-left px-3 py-2.5 rounded-xl transition-all flex items-center gap-3 ${
                              isSelected ? 'bg-primary/10 border border-primary/20' : 'hover:bg-muted/50 border border-transparent'
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${isSelected ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                              <Hash className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-xs text-foreground truncate">{dept}</div>
                              <div className="text-[10px] text-muted-foreground">Department channel</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Broadcast */}
            {activeTab === 'broadcast' && (
              <motion.div key="broadcast" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-0.5">
                <button
                  onClick={() => setSelectedUser('broadcast')}
                  className={`w-full text-left px-3 py-3 rounded-xl transition-all flex items-center gap-3 group ${
                    selectedUser === 'broadcast'
                      ? 'bg-primary/10 border border-primary/20'
                      : 'hover:bg-muted/50 border border-transparent'
                  }`}
                >
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${selectedUser === 'broadcast' ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    <Volume2 className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-xs text-foreground truncate">Tenant Broadcast</div>
                    <div className="text-[10px] text-muted-foreground">Announcements for everyone</div>
                  </div>
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>

      {/* ── Conversation Panel ────────────────────────────────────────────────── */}
      <div
        className={`
          flex-1 flex flex-col rounded-2xl border border-border bg-card shadow-sm overflow-hidden
          ${!selectedUser ? 'hidden md:flex' : 'flex'}
        `}
      >
        {selectedUser ? (
          <>
            {/* Conversation Header */}
            <div className="px-4 py-3 border-b border-border bg-card flex items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                {/* Mobile back button */}
                <button
                  onClick={() => setSelectedUser(null)}
                  className="md:hidden p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {/* Avatar */}
                {selectedUser === 'broadcast' ? (
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20">
                    <Volume2 className="w-4 h-4" />
                  </div>
                ) : selectedUser?.startsWith('group_') ? (
                  <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20">
                    <Users className="w-4 h-4" />
                  </div>
                ) : (
                  <div className="relative">
                    <div className="w-9 h-9 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm overflow-hidden">
                      {(() => {
                        const emp = employees.find(e => e.userId === selectedUser);
                        return emp?.profileImage
                          ? <img src={emp.profileImage} alt="" className="w-full h-full object-cover" />
                          : getHeaderTitle().charAt(0).toUpperCase();
                      })()}
                    </div>
                    {isOnline(selectedUser) && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card"></span>
                    )}
                  </div>
                )}

                <div>
                  <h3 className="font-bold text-sm text-foreground leading-tight">{getHeaderTitle()}</h3>
                  <p className={`text-[10px] font-medium flex items-center gap-1 mt-0.5 ${
                    !selectedUser?.startsWith('group_') && selectedUser !== 'broadcast' && isOnline(selectedUser)
                      ? 'text-primary'
                      : 'text-muted-foreground'
                  }`}>
                    {!selectedUser?.startsWith('group_') && selectedUser !== 'broadcast' && isOnline(selectedUser) && (
                      <span className="w-1.5 h-1.5 rounded-full bg-primary inline-block"></span>
                    )}
                    {getHeaderSubtitle()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 text-[9px] text-muted-foreground bg-muted/65 px-2 py-1 rounded-lg border border-border">
                  <Shield className="w-3 h-3" />
                  <span>End-to-end isolated</span>
                </div>
              </div>
            </div>

            {/* Messages Feed */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-1 custom-scrollbar bg-muted/20">
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center flex-col gap-3 text-muted-foreground">
                  <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center">
                    <MessageSquare className="w-8 h-8 opacity-30" />
                  </div>
                  <p className="text-sm font-medium text-foreground/80">No messages yet</p>
                  <p className="text-xs text-muted-foreground">Send a message to start the conversation</p>
                </div>
              ) : (
                groupedMessages.map(group => (
                  <div key={group.date}>
                    {/* Date separator */}
                    <div className="flex items-center gap-3 my-4">
                      <div className="flex-1 h-px bg-border"></div>
                      <span className="text-[10px] text-muted-foreground font-semibold px-2 py-0.5 bg-muted rounded-full border border-border">{group.date}</span>
                      <div className="flex-1 h-px bg-border"></div>
                    </div>

                    {group.msgs.map((msg, idx) => {
                      const isMe = msg.senderId === user?._id;
                      const prevMsg = idx > 0 ? group.msgs[idx - 1] : null;
                      const isConsecutive = prevMsg && prevMsg.senderId === msg.senderId;
                      const showAvatar = !isMe && (selectedUser.startsWith('group_') || selectedUser === 'broadcast');

                      return (
                        <motion.div
                          key={msg._id}
                          initial={{ opacity: 0, y: 6 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.15 }}
                          className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${isConsecutive ? 'mt-0.5' : 'mt-3'}`}
                        >
                          {/* Sender name in groups */}
                          {!isMe && showAvatar && !isConsecutive && (
                            <div className="flex items-center gap-2 ml-10 mb-1">
                              <span className="text-[10px] font-bold text-muted-foreground">{getSenderName(msg.senderId)}</span>
                            </div>
                          )}

                          <div className={`flex items-end gap-2 max-w-[72%] ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                            {/* Avatar for groups */}
                            {showAvatar && (
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mb-1 overflow-hidden border border-border`}>
                                {getSenderProfileImage(msg.senderId)
                                  ? <img src={getSenderProfileImage(msg.senderId)!} alt="" className="w-full h-full object-cover" />
                                  : <span className="bg-gradient-to-br from-primary/40 to-primary/20 text-primary w-full h-full flex items-center justify-center">{getSenderInitial(msg.senderId)}</span>
                                }
                              </div>
                            )}

                            {/* Bubble */}
                            <div className={`rounded-2xl px-3.5 py-2.5 shadow-sm ${
                              isMe
                                ? 'bg-primary text-primary-foreground rounded-br-md shadow-primary/20'
                                : 'bg-muted border border-border text-foreground rounded-bl-md'
                            }`}>
                              {/* File/Image message */}
                              {msg.messageType === 'image' && msg.fileUrl ? (
                                <div className="space-y-1.5">
                                  <div onClick={() => setActiveImageUrl(msg.fileUrl || null)}>
                                    <img
                                      src={msg.fileUrl}
                                      alt={msg.fileName || 'Image'}
                                      className="max-w-[240px] max-h-[200px] rounded-xl object-cover cursor-zoom-in hover:opacity-90 transition-opacity"
                                    />
                                  </div>
                                </div>
                              ) : msg.messageType === 'file' && msg.fileUrl ? (
                                <a
                                  href={msg.fileUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={msg.fileName}
                                  className={`flex items-center gap-2.5 py-1 group/file ${isMe ? 'text-primary-foreground/90' : 'text-foreground/90'}`}
                                >
                                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isMe ? 'bg-white/20' : 'bg-background border border-border'}`}>
                                    <FileText className="w-4 h-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold truncate max-w-[160px]">{msg.fileName || 'File'}</div>
                                    <div className="text-[10px] opacity-60">{formatFileSize(msg.fileSize)}</div>
                                  </div>
                                  <Download className="w-3.5 h-3.5 shrink-0 opacity-60 group-hover/file:opacity-100 transition-opacity" />
                                </a>
                              ) : (
                                <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
                              )}

                              {/* Timestamp + read receipt */}
                              <div className={`flex items-center justify-end gap-1 mt-1.5 ${isMe ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                                <span className="text-[9px] font-medium">
                                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                                {isMe && (
                                  msg.read
                                    ? <CheckCheck className="w-3 h-3 text-sky-200" />
                                    : <Check className="w-3 h-3 opacity-60" />
                                )}
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ))
              )}

              {/* Typing indicator */}
              <AnimatePresence>
                {typingUsers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 4 }}
                    className="flex items-center gap-2 mt-2 ml-1"
                  >
                    <div className="flex gap-1 items-center bg-muted border border-border px-3 py-2 rounded-2xl rounded-bl-md">
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium">{getTypingLabel()}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <div ref={messagesEndRef} className="h-1" />
            </div>

            {/* File preview area */}
            <AnimatePresence>
              {filePreview && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="mx-4 mb-0 border border-border rounded-xl bg-muted/30 overflow-hidden"
                >
                  <div className="flex items-center gap-3 px-4 py-2.5">
                    {filePreview.previewUrl ? (
                      <img src={filePreview.previewUrl} alt="Preview" className="w-12 h-12 rounded-lg object-cover border border-border" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-muted border border-border flex items-center justify-center text-muted-foreground">
                        <FileText className="w-5 h-5" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-foreground truncate">{filePreview.file.name}</div>
                      <div className="text-[10px] text-muted-foreground">{formatFileSize(filePreview.file.size)}</div>
                    </div>
                    <button onClick={cancelFilePreview} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input bar */}
            <div className="p-3 border-t border-border bg-card shrink-0">
              {/* Emoji picker */}
              <AnimatePresence>
                {showEmoji && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    className="mb-2 flex flex-wrap gap-1.5 p-2.5 bg-card border border-border rounded-xl shadow-xl"
                  >
                    {QUICK_EMOJIS.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => { setMessage(prev => prev + emoji); setShowEmoji(false); textareaRef.current?.focus(); }}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-foreground text-lg transition-colors"
                      >
                        {emoji}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleSend} className="flex items-end gap-2">
                {/* Emoji button */}
                <button
                  type="button"
                  onClick={() => setShowEmoji(v => !v)}
                  className={`p-2 rounded-xl transition-all shrink-0 ${showEmoji ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
                >
                  <Smile className="w-5 h-5" />
                </button>

                {/* File attach */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all shrink-0"
                >
                  <Paperclip className="w-5 h-5" />
                </button>
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" />

                {/* Text input */}
                <div className="flex w-full relative">
                  <textarea
                    ref={textareaRef}
                    rows={1}
                    value={message}
                    onChange={e => handleTyping(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={
                      filePreview ? 'Add a caption (optional)...' :
                      selectedUser === 'broadcast' ? 'Broadcast announcement...' :
                      selectedUser?.startsWith('group_') ? 'Message group...' :
                      'Type a message... '
                    }
                    disabled={fileMutation.isPending || sendMutation.isPending}
                    className="w-full bg-muted/50 border border-border rounded-xl px-4 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/40 focus:bg-background transition-all resize-none min-h-[40px] max-h-[120px] overflow-y-auto disabled:opacity-50"
                    style={{ height: 'auto' }}
                    onInput={e => {
                      const t = e.target as HTMLTextAreaElement;
                      t.style.height = 'auto';
                      t.style.height = Math.min(t.scrollHeight, 120) + 'px';
                    }}
                  />
                </div>

                {/* Send button */}
                <button
                  type="submit"
                  disabled={(!message.trim() && !filePreview) || sendMutation.isPending || fileMutation.isPending}
                  className="p-2.5 rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/95 disabled:opacity-50 disabled:cursor-not-allowed transition-all shrink-0 hover:scale-105 active:scale-95"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </>
        ) : (
          /* Empty state */
          <div className="flex-1 flex items-center justify-center flex-col gap-4 p-8 text-center bg-card">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                <MessageSquare className="w-10 h-10 text-primary opacity-40" />
              </div>
              {otherOnlineCount > 0 && (
                <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-primary border-2 border-card flex items-center justify-center">
                  <span className="text-[8px] font-bold text-white">{onlineUserIds.length}</span>
                </div>
              )}
            </div>
            <div>
              <h4 className="font-extrabold text-foreground text-lg tracking-tight">EthicSecur Realtime Chat</h4>
              <p className="text-sm text-muted-foreground max-w-xs mt-1.5 font-medium leading-relaxed">
                Select a direct message, group channel, or broadcast feed from the sidebar to begin.
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] text-muted-foreground font-medium mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary"></div>
                <span>{otherOnlineCount > 0 ? `${onlineUserIds.length} people online` : 'online'}</span>
              </div>
              <div className="w-1 h-1 rounded-full bg-border"></div>
              <div className="flex items-center gap-1.5">
                <Shield className="w-3 h-3" />
                <span>Tenant-isolated</span>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: hsl(var(--muted-foreground) / 0.15); border-radius: 99px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: hsl(var(--muted-foreground) / 0.3); }
      `}</style>

      {/* Enlarged Image Modal */}
      <AnimatePresence>
        {activeImageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setActiveImageUrl(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm cursor-zoom-out"
          >
            <motion.div
              initial={{ scale: 0.95, y: 15 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-4xl max-h-[85vh] overflow-hidden rounded-2xl bg-card border border-border p-2 shadow-2xl flex flex-col items-center justify-center"
            >
              <button
                onClick={() => setActiveImageUrl(null)}
                className="absolute top-4 right-4 p-2 rounded-full bg-background/60 hover:bg-background/80 text-foreground transition-all hover:scale-105 active:scale-95 z-10"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={activeImageUrl}
                alt="Enlarged chat visual"
                className="max-w-full max-h-[80vh] rounded-xl object-contain"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
