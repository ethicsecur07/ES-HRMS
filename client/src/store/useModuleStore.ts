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
  { moduleCode: 'FINANCE', routePath: '/finance', displayName: 'Finance & Maintenance', order: 7 },
  { moduleCode: 'EMPLOYEE_LIFECYCLE', routePath: '/lifecycle', displayName: 'Employee Lifecycle', order: 8 },
  { moduleCode: 'ORG_STRUCTURE', routePath: '/organization', displayName: 'Organization Structure', order: 9 },
  { moduleCode: 'WORKFLOW', routePath: '/workflows', displayName: 'Workflow Engine', order: 10 },
  { moduleCode: 'REPORTS', routePath: '/reports', displayName: 'Reports & Analytics', order: 11 },
  { moduleCode: 'AUDIT_LOGS', routePath: '/audit-logs', displayName: 'Audit Logs', order: 12 },
  { moduleCode: 'SETTINGS', routePath: '/settings', displayName: 'Settings', order: 13 },
  { moduleCode: 'SELF_SERVICE', routePath: '/self-service', displayName: 'Self Service', order: 14 },
  { moduleCode: 'DOCUMENTS', routePath: '/documents', displayName: 'Documents', order: 15 },
  { moduleCode: 'PROJECTS', routePath: '/projects', displayName: 'Projects', order: 16 },
  { moduleCode: 'RECRUITMENT', routePath: '/recruitment', displayName: 'Recruitment', order: 17 },
  { moduleCode: 'CHAT', routePath: '/chat', displayName: 'Chat', order: 18 },
  { moduleCode: 'NOTIFICATIONS', routePath: '/notifications', displayName: 'Notifications', order: 19 },
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
        moduleRoutes: fallbackModuleRoutes,
        isLoaded: true,
        isLoading: false
      });
    }
  }
}));
