import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Palmtree,
  CreditCard,
  BarChart3,
  ShieldCheck,
  Shield,
  Settings,
  Wallet,
  Bell,
  Sun,
  Moon,
  LogOut,
  ListTodo,
  Network,
  GitBranch,
  FolderOpen,
  Receipt,
  MessageSquare
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { employeeApi } from '../../api_service/employeeApi';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useThemeStore } from '../../store/useThemeStore';
import { useModuleStore } from '../../store/useModuleStore.js';
import { usePermission } from '../../hooks/usePermission';
import type { Role } from '../../types';
import ESLogo from '../../assets/ES_Logo.png';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, role, logout } = useAuthStore();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();
  const { theme, toggleTheme } = useThemeStore();
  const { moduleRoutes, enabledModules } = useModuleStore();
  const { hasPermission } = usePermission();
  const [showNotifs, setShowNotifs] = useState(false);
  const navigate = useNavigate();

  const { data: employeeData } = useQuery({
    queryKey: ['employeeProfile', user?.employeeId],
    queryFn: () => employeeApi.getById(user?.employeeId as string),
    enabled: !!user?.employeeId,
    retry: false,
    throwOnError: false,
  });

  const profileImg = user?.profileImage || employeeData?.profileImage;

  const roleColors: Record<Role, string> = {
    ADMIN: 'bg-primary/10 text-primary border-primary/20',
    MANAGER: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    HR: 'bg-foreground/10 text-foreground border-border',
    TEAM_LEAD: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
    EMPLOYEE: 'bg-muted text-muted-foreground border-border',
  };

  const handleNotificationClick = (n: any) => {
    markAsRead(n._id);
    setShowNotifs(false);
    onClose();

    const typeStr = (n.type || '').toUpperCase();
    if (typeStr === 'PAYROLL') {
      navigate('/payroll');
    } else if (typeStr === 'WFH' || typeStr === 'LEAVE' || typeStr === 'PERMISSION') {
      navigate('/leave-wfh');
    } else if (typeStr === 'ATTENDANCE') {
      navigate('/attendance');
    } else if (typeStr === 'FINANCE') {
      navigate('/finance');
    } else if (typeStr === 'EMPLOYEE') {
      navigate('/employees');
    } else if (typeStr === 'REPORT' || typeStr === 'TASK') {
      navigate('/task-reports');
    } else {
      navigate('/dashboard');
    }
  };

  const getIcon = (path: string) => {
    switch (path) {
      case '/dashboard': return LayoutDashboard;
      case '/employees': return Users;
      case '/attendance': return CalendarCheck;
      case '/leave-wfh': return Palmtree;
      case '/task-reports': return BarChart3;
      case '/payroll': return CreditCard;
      case '/finance': return Wallet;
      case '/reports': return BarChart3;
      case '/audit-logs': return ShieldCheck;
      case '/settings': return Settings;
      case '/settings/leave-policy': return Shield;
      case '/lifecycle': return ListTodo;
      case '/organization': return Network;
      case '/workflows': return GitBranch;
      case '/self-service': return Receipt;
      case '/documents': return FolderOpen;
      default: return LayoutDashboard;
    }
  };

  const compiledItems = moduleRoutes
    .filter(route => enabledModules.includes(route.moduleCode))
    .map(route => ({
      name: route.displayName,
      path: route.routePath,
      icon: getIcon(route.routePath),
      moduleCode: route.moduleCode,
    }));

  const filteredItems = compiledItems.filter((item) => hasPermission(item.moduleCode, 'view'));


  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-sm animate-in fade-in duration-200"
          onClick={onClose}
        />
      )}
      <aside
        className={`w-64 bg-card border-l lg:border-l-0 lg:border-r border-border flex flex-col min-h-screen lg:h-screen fixed right-0 lg:right-auto lg:left-0 top-0 z-40 shadow-2xl lg:shadow-sm backdrop-blur-md bg-opacity-95 dark:bg-opacity-90 transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
          }`}
      >
        <div className="hidden lg:flex p-5 border-b border-border items-center gap-3">
          <img src={ESLogo} alt="EthicSec Logo" className="h-10 w-10 object-contain drop-shadow-md flex-shrink-0" />
          <div className="flex flex-col text-left">
            <span className="font-bold text-lg text-foreground tracking-tight leading-none">ES EthicSecur</span>
            <span className="text-xs text-muted-foreground mt-1 font-medium tracking-wide uppercase"> SofTec HRMS</span>
          </div>
        </div>

        {/* Mobile-only User Profile & Actions Section (hidden on lg screens) */}
        <div className="lg:hidden p-4 border-b border-border bg-muted/50 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div
              onClick={() => { navigate('/profile'); onClose(); }}
              className="relative group h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-base shadow-md overflow-hidden flex-shrink-0 cursor-pointer"
              title="Click to view Profile Page"
            >
              {profileImg ? (
                <img src={profileImg} alt={user?.name || 'Profile'} className="w-full h-full object-cover rounded-full" />
              ) : (
                <img src={ESLogo} alt="Default Profile" className="w-full h-full object-contain p-1 rounded-full bg-muted" />
              )}
            </div>
            <div
              onClick={() => { navigate('/profile'); onClose(); }}
              className="flex flex-col text-left cursor-pointer group flex-1 min-w-0"
              title="Click to view Profile Page"
            >
              <span className="text-sm font-bold text-foreground leading-none mb-1 tracking-tight truncate group-hover:text-primary transition-colors">
                {user?.name || 'User'}
              </span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-max border uppercase tracking-wider ${role ? roleColors[role as Role] : ''}`}>
                {role || 'EMPLOYEE'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center gap-1.5 flex-1 py-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all text-xs font-medium"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>

            {/* Notification Bell */}
            <div className="relative flex-1">
              <button
                onClick={() => {
                  navigate('/notifications');
                  onClose();
                }}
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all text-xs font-medium relative"
                title="Notifications"
              >
                <Bell className="h-4 w-4" />
                <span>Notifs</span>
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shadow-lg shadow-primary/30 animate-bounce">
                    {unreadCount}
                  </span>
                )}
              </button>

              {showNotifs && (
                <div className="absolute right-0 mt-2 w-60 sm:w-64 rounded-2xl bg-card border border-border shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
                  <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
                    <span className="font-bold text-base text-foreground tracking-tight">Notifications</span>
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-primary font-semibold hover:underline"
                      >
                        Mark all as read
                      </button>
                    )}
                  </div>

                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {notifications.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n._id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${n.read
                              ? 'bg-background border-border text-muted-foreground'
                              : 'bg-primary/5 border-primary/20 text-foreground shadow-sm hover:border-primary/40'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-primary">
                              {n.type}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-sm font-semibold mb-0.5">{n.title}</p>
                          <p className="text-xs text-muted-foreground leading-snug">{n.message}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${isActive
                    ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
          
          {/* Hardcoded Projects Link */}
          <NavLink
            to="/chat"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${isActive
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`
            }
          >
            <MessageSquare className="h-5 w-5" />
            <span>Chat</span>
          </NavLink>

          <NavLink
            to="/projects"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${isActive
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`
            }
          >
            <ListTodo className="h-5 w-5" />
            <span>Projects</span>
          </NavLink>

          <NavLink
            to="/recruitment"
            onClick={onClose}
            className={({ isActive }) =>
              `flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${isActive
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`
            }
          >
            <Users className="h-5 w-5" />
            <span>Recruitment ATS</span>
          </NavLink>
        </div>

        {/* Mobile-only Logout Button at Bottom of Screen */}
        <div className="lg:hidden p-4 border-t border-border mt-auto bg-card">
          <button
            onClick={() => { logout(); onClose(); }}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-white font-bold text-sm transition-all shadow-sm"
          >
            <LogOut className="h-4 w-4" />
            <span>LOG OUT</span>
          </button>
        </div>
      </aside>
    </>
  );
};
