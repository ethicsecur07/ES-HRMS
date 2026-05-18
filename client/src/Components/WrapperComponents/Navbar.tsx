import React, { useState } from 'react';
import { Bell, Sun, Moon, LogOut, Menu } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useThemeStore } from '../../store/useThemeStore';
import type { Role } from '../../types';

interface NavbarProps {
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { user, role, logout } = useAuthStore();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotificationStore();
  const { theme, toggleTheme } = useThemeStore();
  const [showNotifs, setShowNotifs] = useState(false);

  const roleColors: Record<Role, string> = {
    ADMIN: 'bg-primary/10 text-primary border-primary/20',
    HR: 'bg-foreground/10 text-foreground border-border',
    EMPLOYEE: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <header className="h-20 bg-card border-b border-border flex items-center justify-between px-4 sm:px-8 sticky top-0 z-20 backdrop-blur-md bg-opacity-95 dark:bg-opacity-90 shadow-sm lg:pl-72">
      <div className="flex items-center gap-2 sm:gap-4">
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex-shrink-0"
          title="Toggle Menu"
        >
          <Menu className="h-5 w-5" />
        </button>



      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 sm:p-2.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          title="Toggle Theme"
        >
          {theme === 'dark' ? <Sun className="h-4 w-4 sm:h-5 sm:w-5" /> : <Moon className="h-4 w-4 sm:h-5 sm:w-5" />}
        </button>

        {/* Notification Bell */}
        <div className="relative">
          <button
            onClick={() => setShowNotifs(!showNotifs)}
            className="p-2 sm:p-2.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all relative"
            title="Notifications"
          >
            <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-primary text-primary-foreground text-[9px] sm:text-[10px] font-bold flex items-center justify-center shadow-lg shadow-primary/30 animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-card border border-border shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
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

              <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                {notifications.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No notifications</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n._id}
                      onClick={() => markAsRead(n._id)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer text-left ${
                        n.read
                          ? 'bg-background border-border text-muted-foreground'
                          : 'bg-primary/5 border-primary/20 text-foreground shadow-sm'
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

        {/* User Profile */}
        <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-border">
          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-xl bg-gradient-to-tr from-accent to-primary flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-md">
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div className="flex flex-col text-left hidden sm:flex">
            <span className="text-sm font-bold text-foreground leading-none mb-1 tracking-tight">
              {user?.name || 'User'}
            </span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full w-max border uppercase tracking-wider ${role ? roleColors[role] : ''}`}>
              {role || 'EMPLOYEE'}
            </span>
          </div>

          <button
            onClick={logout}
            className="p-2 sm:p-2.5 rounded-xl border border-border bg-primary/10 text-primary hover:bg-primary hover:text-white transition-all ml-1 sm:ml-2"
            title="Log Out"
          >
            <LogOut className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
