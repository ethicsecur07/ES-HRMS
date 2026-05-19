import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { io } from 'socket.io-client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { leaveApi } from '../../api_service/leaveApi';
import { wfhApi } from '../../api_service/wfhApi';
import { permissionApi } from '../../api_service/permissionApi';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { X } from 'lucide-react';

export const Layout: React.FC = () => {
  const { toasts, removeToast, addNotification } = useNotificationStore();
  const { role, user } = useAuthStore();
  const queryClient = useQueryClient();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Fetch requests to populate notifications on load
  const isPrivileged = role === 'ADMIN' || role === 'HR';
  const { data: leaves } = useQuery({ queryKey: ['leaves'], queryFn: leaveApi.getAll, enabled: !!role });
  const { data: wfh } = useQuery({ queryKey: ['wfh'], queryFn: wfhApi.getAll, enabled: !!role });
  const { data: perms } = useQuery({ queryKey: ['permissions'], queryFn: permissionApi.getAll, enabled: !!role });
  
  const injectedNotifs = React.useRef(new Set<string>());

  useEffect(() => {
    if (!role) return;

    const currentNotifications = useNotificationStore.getState().notifications;

    if (isPrivileged) {
      // HR/Admin: Populate PENDING requests
      leaves?.filter(l => l.status === 'PENDING').forEach(l => {
        const uniqueId = `leave-pending-${l._id}`;
        const alreadyExists = currentNotifications.some(n => n._id === uniqueId) || injectedNotifs.current.has(uniqueId);
        if (!alreadyExists) {
          addNotification({
            _id: uniqueId,
            recipientId: role,
            title: 'New Leave Request',
            message: `Pending request for ${l.leaveType}.`,
            type: 'LEAVE',
          } as any);
          injectedNotifs.current.add(uniqueId);
        }
      });

      wfh?.filter(w => w.status === 'PENDING').forEach(w => {
        const uniqueId = `wfh-pending-${w._id}`;
        const alreadyExists = currentNotifications.some(n => n._id === uniqueId) || injectedNotifs.current.has(uniqueId);
        if (!alreadyExists) {
          addNotification({
            _id: uniqueId,
            recipientId: role,
            title: 'New WFH Request',
            message: `Pending WFH request for ${w.startDate}.`,
            type: 'WFH',
          } as any);
          injectedNotifs.current.add(uniqueId);
        }
      });

      perms?.filter(p => p.approvalStatus === 'PENDING').forEach(p => {
        const uniqueId = `perm-pending-${p._id}`;
        const alreadyExists = currentNotifications.some(n => n._id === uniqueId) || injectedNotifs.current.has(uniqueId);
        if (!alreadyExists) {
          addNotification({
            _id: uniqueId,
            recipientId: role,
            title: 'New Permission Request',
            message: `Pending Permission Hours for ${p.date}.`,
            type: 'PERMISSION',
          } as any);
          injectedNotifs.current.add(uniqueId);
        }
      });
    } else {
      // Employee: Populate their own APPROVED/REJECTED requests
      const empIdStr = user?.employeeId;
      if (!empIdStr) return;

      leaves?.filter(l => {
        const itemEmpId = typeof l.employeeId === 'object' ? (l.employeeId as any)?._id : l.employeeId;
        return itemEmpId === empIdStr && (l.status === 'APPROVED' || l.status === 'REJECTED');
      }).forEach(l => {
        const uniqueId = `leave-status-${l._id}-${l.status}`;
        const alreadyExists = currentNotifications.some(n => n._id === uniqueId) || injectedNotifs.current.has(uniqueId);
        if (!alreadyExists) {
          addNotification({
            _id: uniqueId,
            recipientId: user._id,
            title: `Leave Request ${l.status === 'APPROVED' ? 'Approved' : 'Rejected'}`,
            message: `Your leave request for ${l.leaveType} has been ${l.status.toLowerCase()}.`,
            type: 'LEAVE',
          } as any);
          injectedNotifs.current.add(uniqueId);
        }
      });

      wfh?.filter(w => {
        const itemEmpId = typeof w.employeeId === 'object' ? (w.employeeId as any)?._id : w.employeeId;
        return itemEmpId === empIdStr && (w.status === 'APPROVED' || w.status === 'REJECTED');
      }).forEach(w => {
        const uniqueId = `wfh-status-${w._id}-${w.status}`;
        const alreadyExists = currentNotifications.some(n => n._id === uniqueId) || injectedNotifs.current.has(uniqueId);
        if (!alreadyExists) {
          addNotification({
            _id: uniqueId,
            recipientId: user._id,
            title: `WFH Request ${w.status === 'APPROVED' ? 'Approved' : 'Rejected'}`,
            message: `Your WFH request for ${w.startDate} has been ${w.status.toLowerCase()}.`,
            type: 'WFH',
          } as any);
          injectedNotifs.current.add(uniqueId);
        }
      });

      perms?.filter(p => {
        const itemEmpId = typeof p.employeeId === 'object' ? (p.employeeId as any)?._id : p.employeeId;
        return itemEmpId === empIdStr && (p.approvalStatus === 'APPROVED' || p.approvalStatus === 'REJECTED');
      }).forEach(p => {
        const uniqueId = `perm-status-${p._id}-${p.approvalStatus}`;
        const alreadyExists = currentNotifications.some(n => n._id === uniqueId) || injectedNotifs.current.has(uniqueId);
        if (!alreadyExists) {
          addNotification({
            _id: uniqueId,
            recipientId: user._id,
            title: `Permission Request ${p.approvalStatus === 'APPROVED' ? 'Approved' : 'Rejected'}`,
            message: `Your permission request for ${p.date} has been ${p.approvalStatus.toLowerCase()}.`,
            type: 'PERMISSION',
          } as any);
          injectedNotifs.current.add(uniqueId);
        }
      });
    }
  }, [leaves, wfh, perms, isPrivileged, addNotification, role, user]);
  // Socket.io client-side integration for real-time notifications & live updates
  useEffect(() => {
    const getSocketUrl = () => {
      const envApiUrl = import.meta.env.VITE_API_URL;
      if (envApiUrl && !envApiUrl.includes('localhost')) {
        return envApiUrl.replace('/api', '');
      }
      return `${window.location.protocol}//${window.location.hostname}:5000`;
    };
    const socketUrl = getSocketUrl();
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

    socket.on('receive_notification', (data: { _id?: string; title: string; message: string; type?: string; recipientId?: string }) => {
      useNotificationStore.getState().addToast(
        data.title || 'Live Notification',
        data.message || 'New update received from HRMS server.',
        data.type === 'error' ? 'error' : data.type === 'success' ? 'success' : 'info'
      );
      useNotificationStore.getState().addNotification({
        _id: data._id,
        recipientId: data.recipientId || 'all',
        title: data.title || 'System Notification',
        message: data.message || '',
        type: (data.type as 'LEAVE' | 'WFH' | 'ATTENDANCE' | 'PAYROLL' | 'ANNOUNCEMENT' | 'PERMISSION' | 'GENERAL') || 'GENERAL',
      } as any);

      // Invalidate queries to refresh lists in real-time
      const notificationType = (data.type || '').toUpperCase();
      if (notificationType === 'LEAVE') {
        queryClient.invalidateQueries({ queryKey: ['leaves'] });
      } else if (notificationType === 'WFH') {
        queryClient.invalidateQueries({ queryKey: ['wfh'] });
      } else if (notificationType === 'PERMISSION') {
        queryClient.invalidateQueries({ queryKey: ['permissions'] });
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [role, user?._id, queryClient]);

  return (
    <div className="flex min-h-screen w-full bg-background text-foreground overflow-x-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 lg:pl-64 pt-20">
        <Navbar onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

        <main className="flex-1 p-4 sm:p-8 max-w-[1600px] w-full mx-auto animate-in fade-in duration-300">
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
