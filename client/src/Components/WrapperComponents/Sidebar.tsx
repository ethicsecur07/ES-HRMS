import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  CalendarCheck,
  Palmtree,
  CreditCard,
  BarChart3,
  ShieldCheck,
  Settings,
  Wallet,
} from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose }) => {
  const { role } = useAuthStore();

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'HR', 'EMPLOYEE'] },
    { name: 'Employees', path: '/employees', icon: Users, roles: ['ADMIN', 'HR'] },
    { name: 'Attendance', path: '/attendance', icon: CalendarCheck, roles: ['ADMIN', 'HR', 'EMPLOYEE'] },
    { name: 'Leave & WFH', path: '/leave-wfh', icon: Palmtree, roles: ['ADMIN', 'HR', 'EMPLOYEE'] },
    { name: 'Payroll', path: '/payroll', icon: CreditCard, roles: ['ADMIN', 'HR', 'EMPLOYEE'] },
    { name: 'Finance & Maintenance', path: '/finance', icon: Wallet, roles: ['ADMIN', 'HR'] },
    { name: 'Reports', path: '/reports', icon: BarChart3, roles: ['ADMIN', 'HR'] },
    { name: 'Audit Logs', path: '/audit-logs', icon: ShieldCheck, roles: ['ADMIN'] },
    { name: 'Settings', path: '/settings', icon: Settings, roles: ['ADMIN'] },
  ];

  const filteredItems = navItems.filter((item) => role && item.roles.includes(role));

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-30 lg:hidden backdrop-blur-sm animate-in fade-in duration-200"
          onClick={onClose}
        />
      )}
      <aside
        className={`w-64 bg-card border-r border-border flex flex-col h-screen fixed left-0 top-0 z-40 shadow-2xl lg:shadow-sm backdrop-blur-md bg-opacity-95 dark:bg-opacity-90 transition-transform duration-300 ${
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-6 border-b border-border flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/30 text-white font-bold text-xl tracking-wider">
            ES
          </div>
          <div className="flex flex-col text-left">
            <span className="font-bold text-lg text-foreground tracking-tight leading-none">ETHICSEC</span>
            <span className="text-xs text-muted-foreground mt-1 font-medium tracking-wide uppercase">Enterprise HRMS</span>
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
                  `flex items-center gap-3.5 px-4 py-3 rounded-xl font-medium text-sm transition-all duration-200 ${
                    isActive
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
        </div>

      </aside>
    </>
  );
};
