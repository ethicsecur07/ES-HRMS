import React, { useState, createContext, useContext } from 'react';
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
  FolderOpen,
  MessageSquare,
  Video
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

// ─── Sidebar Expanded Context (so Layout can react) ───────────────────────────
export const SidebarExpandedContext = createContext<{
  expanded: boolean;
  setExpanded: (v: boolean) => void;
}>({ expanded: false, setExpanded: () => { } });

export const useSidebarExpanded = () => useContext(SidebarExpandedContext);

// ─── Props ────────────────────────────────────────────────────────────────────
interface SidebarProps {
  isOpen: boolean;   // mobile drawer open state
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { user, role, logout } = useAuthStore();
  const { notifications, unreadCount, markAsRead } = useNotificationStore();
  const { theme, toggleTheme } = useThemeStore();
  const { moduleRoutes, enabledModules } = useModuleStore();
  const { hasPermission } = usePermission();
  const [showNotifs, setShowNotifs] = useState(false);
  const navigate = useNavigate();

  // Desktop hover-expand state
  const { expanded, setExpanded } = useSidebarExpanded();

  const handleLogoutClick = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      logout();
    }
  };

  const handleMobileLogoutClick = () => {
    if (window.confirm("Are you sure you want to log out?")) {
      logout();
      onClose();
    }
  };

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
    INTERN: 'bg-teal-500/10 text-teal-500 border-teal-500/20',
  };

  const handleNotificationClick = (n: any) => {
    markAsRead(n._id);
    setShowNotifs(false);
    onClose();
    const typeStr = (n.type || '').toUpperCase();
    if (typeStr === 'PAYROLL') navigate('/payroll');
    else if (typeStr === 'WFH' || typeStr === 'LEAVE' || typeStr === 'PERMISSION') navigate('/leave-wfh');
    else if (typeStr === 'ATTENDANCE') navigate('/attendance');
    else if (typeStr === 'FINANCE') navigate('/finance');
    else if (typeStr === 'EMPLOYEE') navigate('/employees');
    else if (typeStr === 'REPORT' || typeStr === 'TASK') navigate('/task-reports');
    else navigate('/dashboard');
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
      case '/organization': return Network;
      case '/documents': return FolderOpen;
      case '/chat': return MessageSquare;
      case '/projects': return ListTodo;
      case '/recruitment': return Users;
      case '/notifications': return Bell;
      case '/meetings': return Video;
      default: return LayoutDashboard;
    }
  };

  const compiledItems = moduleRoutes
    .filter(route => enabledModules.includes(route.moduleCode))
    .map(route => {
      let displayName = route.displayName;
      if (route.moduleCode === 'EMPLOYEES') {
        if (role === 'EMPLOYEE' || role === 'INTERN') {
          displayName = 'Colleagues';
        } else {
          displayName = 'Employees';
        }
      }
      return {
        name: displayName,
        path: route.routePath,
        icon: getIcon(route.routePath),
        moduleCode: route.moduleCode,
      };
    });

  const filteredItems = compiledItems.filter((item) => {
    if (role === 'INTERN') {
      const allowedInternModules = ['DASHBOARD', 'ATTENDANCE', 'DOCUMENTS', 'CHAT', 'NOTIFICATIONS'];
      return allowedInternModules.includes(item.moduleCode) && hasPermission(item.moduleCode, 'view');
    }
    if (item.moduleCode === 'PAYROLL') {
      return role === 'ADMIN' || role === 'HR';
    }
    if (item.moduleCode === 'RECRUITMENT') {
      return role === 'HR' || role === 'MANAGER';
    }
    return hasPermission(item.moduleCode, 'view');
  });

  // ─── Sidebar content shared between mobile & desktop ───────────────────────
  const navItems = (
    <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 space-y-1">
      {filteredItems.map((item) => {
        const Icon = item.icon;
        return (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={onClose}
            title={!expanded ? item.name : undefined}
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-3 py-2.5 mx-2 rounded-xl font-medium text-sm transition-all duration-200 group ${isActive
                ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`
            }
          >
            <Icon className="h-5 w-5 flex-shrink-0" />
            <span
              className={`whitespace-nowrap overflow-hidden transition-all duration-300 ${expanded ? 'opacity-100 max-w-[160px]' : 'opacity-0 max-w-0'
                }`}
            >
              {item.name}
            </span>

            {/* Tooltip when collapsed */}
            {!expanded && (
              <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-popover border border-border text-foreground text-xs font-semibold rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50">
                {item.name}
              </div>
            )}
          </NavLink>
        );
      })}
    </div>
  );

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-sm animate-in fade-in duration-200"
          onClick={onClose}
        />
      )}

      {/* ── DESKTOP sidebar (hover to expand) ── */}
      <aside
        onMouseEnter={() => setExpanded(true)}
        onMouseLeave={() => setExpanded(false)}
        className={`hidden lg:flex flex-col fixed left-0 top-0 h-screen z-40 bg-card border-r border-border shadow-sm backdrop-blur-md transition-all duration-300 ease-in-out overflow-hidden ${expanded ? 'w-64' : 'w-16'
          }`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 p-3 border-b border-border h-20 flex-shrink-0 overflow-hidden">
          <img src={ESLogo} alt="EthicSec" className="h-9 w-9 object-contain flex-shrink-0" />
          <div
            className={`flex flex-col text-left overflow-hidden transition-all duration-300 ${expanded ? 'opacity-100 max-w-[160px]' : 'opacity-0 max-w-0'
              }`}
          >
            <span className="font-bold text-sm text-foreground tracking-tight leading-none whitespace-nowrap">ES EthicSecur</span>
            <span className="text-[10px] text-muted-foreground mt-0.5 font-medium tracking-wide uppercase whitespace-nowrap">SofTec HRMS</span>
          </div>
        </div>

        {/* Nav items */}
        {navItems}

        {/* Bottom: theme + logout */}
        <div className="border-t border-border py-2 space-y-1 flex-shrink-0">
          {/* Theme */}
          {/* <button
            onClick={toggleTheme}
            title={!expanded ? (theme === 'dark' ? 'Light Mode' : 'Dark Mode') : undefined}
            className="relative flex items-center gap-3 px-3 py-2.5 mx-2 rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200 group"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5 flex-shrink-0" /> : <Moon className="h-5 w-5 flex-shrink-0" />}
            <span className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${expanded ? 'opacity-100 max-w-[160px]' : 'opacity-0 max-w-0'}`}>
              {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            </span>
            {!expanded && (
              <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-popover border border-border text-foreground text-xs font-semibold rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50">
                {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
              </div>
            )}
          </button> */}

          {/* Logout */}
          <button
            onClick={handleLogoutClick}
            title={!expanded ? 'Logout' : undefined}
            className="relative flex items-center gap-3 px-3 py-2.5 mx-2 rounded-xl text-destructive hover:bg-destructive/10 transition-all duration-200 group"
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            <span className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ${expanded ? 'opacity-100 max-w-[160px]' : 'opacity-0 max-w-0'}`}>
              Logout
            </span>
            {!expanded && (
              <div className="absolute left-full ml-2 px-2.5 py-1.5 bg-popover border border-border text-foreground text-xs font-semibold rounded-lg shadow-lg whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 z-50">
                Logout
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* ── MOBILE sidebar (slide-in drawer from right) ── */}
      <aside
        className={`lg:hidden w-64 bg-card border-l border-border flex flex-col min-h-screen fixed right-0 top-0 z-40 shadow-2xl backdrop-blur-md transition-transform duration-300 ${isOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
      >
        {/* Mobile header */}
        <div className="p-5 border-b border-border flex items-center gap-3">
          <img src={ESLogo} alt="EthicSec Logo" className="h-10 w-10 object-contain drop-shadow-md flex-shrink-0" />
          <div className="flex flex-col text-left">
            <span className="font-bold text-lg text-foreground tracking-tight leading-none">ES EthicSecur</span>
            <span className="text-xs text-muted-foreground mt-1 font-medium tracking-wide uppercase">SofTec HRMS</span>
          </div>
        </div>

        {/* Mobile user profile */}
        <div className="p-4 border-b border-border bg-muted/50 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <div
              onClick={() => { navigate('/profile'); onClose(); }}
              className="relative h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-base shadow-md overflow-hidden flex-shrink-0 cursor-pointer"
            >
              {profileImg ? (
                <img src={profileImg} alt={user?.name || 'Profile'} className="w-full h-full object-cover rounded-full" />
              ) : (
                <img src={ESLogo} alt="Default Profile" className="w-full h-full object-contain p-1 rounded-full bg-muted" />
              )}
            </div>
            <div onClick={() => { navigate('/profile'); onClose(); }} className="flex flex-col text-left cursor-pointer flex-1 min-w-0">
              <span className="text-sm font-bold text-foreground leading-none mb-1 tracking-tight truncate">{user?.name || 'User'}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-max border uppercase tracking-wider ${role ? roleColors[role as Role] : ''}`}>
                {employeeData?.designation || user?.ssoData?.jobTitle || role || 'EMPLOYEE'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border/50">
            <button onClick={toggleTheme} className="flex items-center justify-center gap-1.5 flex-1 py-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all text-xs font-medium">
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
            </button>

            <div className="relative flex-1">
              <button
                onClick={() => { navigate('/notifications'); onClose(); }}
                className="flex items-center justify-center gap-1.5 w-full py-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all text-xs font-medium relative"
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
                  </div>
                  <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                    {notifications.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No notifications</p>
                    ) : (
                      notifications.map((n) => (
                        <div
                          key={n._id}
                          onClick={() => handleNotificationClick(n)}
                          className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${n.read ? 'bg-background border-border text-muted-foreground' : 'bg-primary/5 border-primary/20 text-foreground shadow-sm hover:border-primary/40'
                            }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold uppercase tracking-wider text-primary">{n.type}</span>
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

        {/* Mobile nav */}
        <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1.5">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${isActive ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-[1.02]' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  }`
                }
              >
                <Icon className="h-5 w-5" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </div>

        {/* Mobile logout */}
        <div className="p-4 border-t border-border mt-auto bg-card">
          <button
            onClick={handleMobileLogoutClick}
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
