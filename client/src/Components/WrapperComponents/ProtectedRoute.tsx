import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../store/useAuthStore';
import { useModuleStore } from '../../store/useModuleStore';
import { usePermission } from '../../hooks/usePermission';
import type { Role } from '../../types';

interface ProtectedRouteProps {
  allowedRoles?: Role[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ allowedRoles }) => {
  const { isAuthenticated, role } = useAuthStore();
  const { enabledModules, moduleRoutes } = useModuleStore();
  const { permissions, hasPermission, isLoading: isPermissionLoading } = usePermission();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const hasPermissionsLoaded = Object.keys(permissions || {}).length > 0;

  // Only show the loading indicator if we are loading AND we don't have cached permissions yet
  if (isPermissionLoading && !hasPermissionsLoaded) {
    return (
      <div className="flex items-center justify-center h-screen text-indigo-400 font-semibold">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
          <p className="text-xs tracking-wider uppercase text-slate-400">Verifying Access...</p>
        </div>
      </div>
    );
  }

  if (allowedRoles && role && !allowedRoles.includes(role)) {
    if (location.pathname !== '/dashboard') return <Navigate to="/dashboard" replace />;
  }

  // Find the most specific (longest) module route that matches the current pathname
  const matchedRoute = moduleRoutes
    .filter(route => {
      // Direct match
      if (route.routePath === location.pathname) return true;
      // Handle dynamic route parameters (e.g., /employees/:id)
      if (route.routePath.includes('/:')) {
        const baseRoute = route.routePath.split('/:')[0];
        if (location.pathname.startsWith(baseRoute + '/') || location.pathname === baseRoute) {
           return true;
        }
      }
      // General sub-path match (e.g., /settings/roles matching /settings)
      if (location.pathname.startsWith(route.routePath + '/')) return true;
      
      return false;
    })
    .sort((a, b) => b.routePath.length - a.routePath.length)[0];

  if (matchedRoute) {
    if (enabledModules.length > 0 && !enabledModules.includes(matchedRoute.moduleCode)) {
      if (location.pathname !== '/dashboard') return <Navigate to="/dashboard" replace />;
    }
    
    // Dynamic permission check for the module
    if (!hasPermission(matchedRoute.moduleCode, 'view')) {
      if (location.pathname !== '/dashboard') return <Navigate to="/dashboard" replace />;
    }
  }

  return <Outlet />;
};

