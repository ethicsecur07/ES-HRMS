import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { X } from 'lucide-react';

export const Layout: React.FC = () => {
  const { toasts, removeToast } = useNotificationStore();
  const { role, user } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Socket.io client-side integration for real-time notifications & live updates
  useEffect(() => {
    const socketUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000';
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socket.on('connect', () => {
      console.log('Connected to EthicSec real-time socket server:', socket.id);
      if (role) {
        socket.emit('join_room', role);
      }
      if (user?._id) {
        socket.emit('join_room', user._id);
      }
    });

    socket.on('receive_notification', (data: { title: string; message: string; type?: string; recipientId?: string }) => {
      useNotificationStore.getState().addToast(
        data.title || 'Live Notification',
        data.message || 'New update received from HRMS server.',
        data.type === 'error' ? 'error' : data.type === 'success' ? 'success' : 'info'
      );
      useNotificationStore.getState().addNotification({
        recipientId: data.recipientId || 'all',
        title: data.title || 'System Notification',
        message: data.message || '',
        type: (data.type as any) || 'GENERAL',
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [role, user?._id]);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground overflow-x-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0">
        <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

        <main className="flex-1 p-4 sm:p-8 lg:ml-64 max-w-[1600px] w-full mx-auto animate-in fade-in duration-300">
          <Outlet />
        </main>
      </div>

      {/* Toast Notification Container */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-3 max-w-sm w-full pointer-events-none p-4 sm:p-0">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex items-start justify-between p-4 rounded-2xl shadow-2xl border backdrop-blur-md transition-all animate-in slide-in-from-bottom-5 duration-300 ${
              t.type === 'success' || t.type === 'warning' || t.type === 'error'
                ? 'bg-card border-l-4 border-primary text-foreground shadow-lg shadow-primary/10'
                : 'bg-card border-border text-foreground'
            }`}
          >
            <div className="flex flex-col text-left pr-3">
              <span className="font-bold text-sm tracking-tight mb-0.5">{t.title}</span>
              <span className="text-xs text-muted-foreground leading-relaxed">{t.message}</span>
            </div>
            <button
              onClick={() => removeToast(t.id)}
              className="rounded-full p-1 hover:bg-background/20 transition-colors flex-shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
