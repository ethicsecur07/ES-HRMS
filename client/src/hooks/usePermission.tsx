import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { authPermissionApi } from '../api_service/authPermissionApi';
import type { PermissionActions } from '../api_service/authPermissionApi';

interface UserPermission {
  actions: PermissionActions;
  restrictedFields: string[];
  policyCondition?: any;
}

interface PermissionContextType {
  permissions: Record<string, UserPermission>;
  isLoading: boolean;
  hasPermission: (moduleCode: string, action: keyof PermissionActions) => boolean;
  isFieldRestricted: (moduleCode: string, field: string) => boolean;
  refetchPermissions: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType | undefined>(undefined);

export const PermissionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, user, token } = useAuthStore();
  const [permissions, setPermissions] = useState<Record<string, UserPermission>>({});
  const [isLoading, setIsLoading] = useState(false);

  const fetchPermissions = useCallback(async () => {
    if (!isAuthenticated || !token) {
      setPermissions({});
      return;
    }

    setIsLoading(true);
    try {
      const data = await authPermissionApi.getMyPermissions();
      setPermissions(data || {});
    } catch (error) {
      console.error('Failed to fetch user permissions:', error);
      setPermissions({});
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions, user?.role]); // Refetch if role changes or session is bootstrapped

  const hasPermission = useCallback(
    (moduleCode: string, action: keyof PermissionActions): boolean => {
      const modPerm = permissions[moduleCode];
      if (!modPerm) return false;

      return !!modPerm.actions[action];
    },
    [permissions]
  );

  const isFieldRestricted = useCallback(
    (moduleCode: string, field: string): boolean => {
      const modPerm = permissions[moduleCode];
      if (!modPerm) return false;

      return modPerm.restrictedFields.includes(field);
    },
    [permissions]
  );

  const refetchPermissions = useCallback(async () => {
    await fetchPermissions();
  }, [fetchPermissions]);

  return (
    <PermissionContext.Provider
      value={{
        permissions,
        isLoading,
        hasPermission,
        isFieldRestricted,
        refetchPermissions,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
};

// eslint-disable-next-line react-refresh/only-export-components
export const usePermission = () => {
  const context = useContext(PermissionContext);
  if (context === undefined) {
    throw new Error('usePermission must be used within a PermissionProvider');
  }
  return context;
};
