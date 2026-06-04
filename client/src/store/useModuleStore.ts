import { create } from 'zustand';
import { moduleApi, type ModuleRouteData } from '../api_service/moduleApi.js';

interface ModuleState {
  enabledModules: string[];
  moduleRoutes: ModuleRouteData[];
  isLoading: boolean;
  isLoaded: boolean;
  fetchModulesAndRoutes: () => Promise<void>;
}

const fallbackModuleRoutes: ModuleRouteData[] = [
  { moduleCode: 'DASHBOARD', routePath: '/dashboard', displayName: 'Dashboard', order: 1 },
  { moduleCode: 'EMPLOYEES', routePath: '/employees', displayName: 'Employees', order: 2 },
  { moduleCode: 'ATTENDANCE', routePath: '/attendance', displayName: 'Attendance History', order: 3 },
  { moduleCode: 'LEAVES', routePath: '/leave-wfh', displayName: 'Leave / WFH / Perms', order: 4 },
  { moduleCode: 'TASKS', routePath: '/task-reports', displayName: 'Task & Daily Reports', order: 5 },
  { moduleCode: 'PAYROLL', routePath: '/payroll', displayName: 'Payroll', order: 6 },
  { moduleCode: 'PROJECTS', routePath: '/projects', displayName: 'Projects', order: 7 },
  { moduleCode: 'DOCUMENTS', routePath: '/documents', displayName: 'Documents', order: 8 },
  { moduleCode: 'CHAT', routePath: '/chat', displayName: 'Chat', order: 9 },
  { moduleCode: 'MEETINGS', routePath: '/meetings', displayName: 'Meetings', order: 10 },
  { moduleCode: 'NOTIFICATIONS', routePath: '/notifications', displayName: 'Notifications', order: 11 },
  { moduleCode: 'RECRUITMENT', routePath: '/recruitment', displayName: 'Recruitment', order: 12 },
  { moduleCode: 'FINANCE', routePath: '/finance', displayName: 'Finance & Maintenance', order: 13 },
  { moduleCode: 'REPORTS', routePath: '/reports', displayName: 'Reports & Analytics', order: 14 },
  { moduleCode: 'SELF_SERVICE', routePath: '/self-service', displayName: 'Self Service', order: 15 },
  { moduleCode: 'AUDIT_LOGS', routePath: '/audit-logs', displayName: 'Audit Logs', order: 16 },
  { moduleCode: 'SETTINGS', routePath: '/settings', displayName: 'Settings', order: 17 },
];

const mergeKnownRoutes = (routes: ModuleRouteData[]) => {
  const routeMap = new Map<string, ModuleRouteData>();
  fallbackModuleRoutes.forEach((route) => routeMap.set(route.moduleCode, route));
  routes.forEach((route) => routeMap.set(route.moduleCode, route));
  return Array.from(routeMap.values()).sort((a, b) => (a.order || 999) - (b.order || 999));
};

export const useModuleStore = create<ModuleState>((set, get) => ({
  enabledModules: [],
  moduleRoutes: [],
  isLoading: false,
  isLoaded: false,

  fetchModulesAndRoutes: async () => {
    // Prevent double fetch
    if (get().isLoading) return;

    set({ isLoading: true });
    try {
      const [modules, routes] = await Promise.all([
        moduleApi.getEnabledModules(),
        moduleApi.getModuleRoutes()
      ]);
      set({
        enabledModules: modules,
        moduleRoutes: mergeKnownRoutes(routes),
        isLoaded: true,
        isLoading: false
      });
    } catch (err) {
      console.error('Failed to bootstrap modules/routes', err);
      // Fallback defaults to ensure app doesn't crash on network/auth errors
      set({
        enabledModules: fallbackModuleRoutes.map((route) => route.moduleCode),
        moduleRoutes: [...fallbackModuleRoutes].sort((a, b) => (a.order || 999) - (b.order || 999)),
        isLoaded: true,
        isLoading: false
      });
    }
  }
}));
