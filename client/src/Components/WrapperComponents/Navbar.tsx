import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Sun, Moon, LogOut, Menu } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { employeeApi } from '../../api_service/employeeApi';
import { useAuthStore } from '../../store/useAuthStore';
import { useNotificationStore } from '../../store/useNotificationStore';
import { useThemeStore } from '../../store/useThemeStore';
import type { Role } from '../../types';
import ESLogo from '../../assets/ES_Logo.png';

interface NavbarProps {
  onToggleSidebar: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onToggleSidebar }) => {
  const { user, role, logout, updateUser } = useAuthStore();
  const { notifications, markAsRead, markAllAsRead, clearNotifications } = useNotificationStore();
  const { theme, toggleTheme } = useThemeStore();
  const [showNotifs, setShowNotifs] = useState(false);
  const navigate = useNavigate();
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const isPrivileged = role === 'ADMIN' || role === 'HR';

  // Filter notifications relevant to current user
  const userNotifications = notifications.filter(
    (n) => n.recipientId === user?._id || 
           n.recipientId === role || 
           n.recipientId === 'all' || 
           (isPrivileged && n.recipientId === 'admin-hr')
  );
  
  const userUnreadCount = userNotifications.filter((n) => !n.read).length;

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowNotifs(false);
      }
    };

    if (showNotifs) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifs]);

  const { data: employeeData } = useQuery({
    queryKey: ['employeeProfile', user?.employeeId],
    queryFn: () => employeeApi.getById(user?.employeeId as string),
    enabled: !!user?.employeeId,
  });

  React.useEffect(() => {
    if (employeeData?.profileImage && employeeData.profileImage !== user?.profileImage) {
      updateUser({ profileImage: employeeData.profileImage });
    }
  }, [employeeData?.profileImage, user?.profileImage, updateUser]);

  const profileImg = user?.profileImage || employeeData?.profileImage;

  const roleColors: Record<Role, string> = {
    ADMIN: 'bg-primary/10 text-primary border-primary/20',
    HR: 'bg-foreground/10 text-foreground border-border',
    EMPLOYEE: 'bg-muted text-muted-foreground border-border',
  };

  const handleNotificationClick = (n: any) => {
    markAsRead(n._id);
    setShowNotifs(false);

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
      navigate('/reports');
    } else {
      navigate('/dashboard');
    }
  };

  return (
    <header className="h-20 bg-card border-b border-border flex items-center justify-between px-4 sm:px-8 fixed top-0 left-0 right-0 lg:left-64 z-20 backdrop-blur-md bg-opacity-95 dark:bg-opacity-90 shadow-sm">
      <div className="flex items-center gap-2 sm:gap-4">
        {/* Mobile Brand Display */}
        <div className="flex items-center gap-3 lg:hidden">
          <img src={ESLogo} alt="EthicSec Logo" className="h-8 w-8 object-contain drop-shadow-md flex-shrink-0" />
          <span className="font-bold text-base text-foreground tracking-tight leading-none">ES EthicSecur</span>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Desktop Navbar Items (hidden on mobile) */}
        <div className="hidden lg:flex items-center gap-2 sm:gap-4">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 sm:p-2.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            title="Toggle Theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4 sm:h-5 sm:w-5" /> : <Moon className="h-4 w-4 sm:h-5 sm:w-5" />}
          </button>

          {/* Notification Bell */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowNotifs(!showNotifs)}
              className="p-2 sm:p-2.5 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all relative"
              title="Notifications"
            >
              <Bell className="h-4 w-4 sm:h-5 sm:w-5" />
              {userUnreadCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 h-4 w-4 sm:h-5 sm:w-5 rounded-full bg-primary text-primary-foreground text-[9px] sm:text-[10px] font-bold flex items-center justify-center shadow-lg shadow-primary/30 animate-bounce">
                  {userUnreadCount}
                </span>
              )}
            </button>

            {showNotifs && (
              <div className="absolute right-0 mt-3 w-80 sm:w-96 rounded-2xl bg-card border border-border shadow-2xl p-4 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
                <div className="flex items-center justify-between pb-3 border-b border-border mb-3">
                  <span className="font-bold text-base text-foreground tracking-tight">Notifications</span>
                  <div className="flex items-center gap-2">
                    {userUnreadCount > 0 && (
                      <button
                        onClick={markAllAsRead}
                        className="text-xs text-primary font-semibold hover:underline"
                      >
                        Mark all as read
                      </button>
                    )}
                    {userUnreadCount > 0 && userNotifications.length > 0 && (
                      <span className="text-muted-foreground text-xs">•</span>
                    )}
                    {userNotifications.length > 0 && (
                      <button
                        onClick={clearNotifications}
                        className="text-xs text-destructive font-semibold hover:underline"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                </div>

                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {userNotifications.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No notifications</p>
                  ) : (
                    userNotifications.map((n) => (
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

          {/* User Profile */}
          <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-4 border-l border-border">
            <div
              onClick={() => navigate('/profile')}
              className="relative group h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center text-white font-bold text-sm sm:text-base shadow-md overflow-hidden flex-shrink-0 cursor-pointer"
              title="Click to view Profile Page"
            >
              {profileImg ? (
                <img src={profileImg} alt={user?.name || 'Profile'} className="w-full h-full object-cover rounded-full" />
              ) : (
                <img src={ESLogo} alt="Default Profile" className="w-full h-full object-contain p-1 rounded-full bg-muted" />
              )}
            </div>
            <div
              onClick={() => navigate('/profile')}
              className="flex flex-col text-left hidden sm:flex cursor-pointer group"
              title="Click to view Profile Page"
            >
              <span className="text-sm font-bold text-foreground leading-none mb-1 tracking-tight group-hover:text-primary transition-colors">
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

        {/* Mobile Hamburger Menu Button */}
        <button
          onClick={onToggleSidebar}
          className="lg:hidden p-2 rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition-all flex-shrink-0"
          title="Toggle Menu"
        >
          <Menu className="h-5 w-5" />
        </button>
      </div>
    </header>
  );
};
