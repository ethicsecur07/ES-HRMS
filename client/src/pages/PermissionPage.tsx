import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authPermissionApi, type PermissionActions, type MatrixUpdateRequest } from '../api_service/authPermissionApi';
import { useNotificationStore } from '../store/useNotificationStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Settings, ShieldCheck, Users, Save, AlertTriangle, RefreshCw, Calendar } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { usePermission } from '../hooks/usePermission';
import { SettingsSkeleton } from '../Components/WrapperComponents/Skeleton';


const ACTIONS_LIST: (keyof PermissionActions)[] = ['view', 'create', 'edit', 'delete', 'approve', 'assign', 'export'];

export const PermissionPage: React.FC = () => {
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();

  // Matrix State
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');

  const [matrixState, setMatrixState] = useState<Record<string, Record<string, PermissionActions>>>({});

  // Fetch Matrix
  const { data: matrixData, isLoading: isMatrixLoading } = useQuery({
    queryKey: ['permissionMatrix'],
    queryFn: authPermissionApi.getMatrix,
  });

  // Set initial selectedRoleId when matrixData loads
  useEffect(() => {
    if (matrixData && !selectedRoleId) {
      const initialRoleId = matrixData.roles[0]?._id || '';
      if (initialRoleId) {
        setSelectedRoleId(initialRoleId);
      }
    }
  }, [matrixData, selectedRoleId]);

  // Initialize Matrix State when data loads
  useEffect(() => {
    if (matrixData) {
      // Build state map: roleId -> moduleCode -> actions
      const tempState: Record<string, Record<string, PermissionActions>> = {};
      matrixData.roles.forEach((role) => {
        tempState[role._id!] = {};
        matrixData.modules.forEach((mod) => {
          // Find if there is an existing permission record
          const existing = matrixData.permissions.find(
            (p) => p.roleId === role._id && p.module === mod
          );
          tempState[role._id!][mod] = existing
            ? { ...existing.actions }
            : { view: false, create: false, edit: false, delete: false, approve: false, assign: false, export: false };
        });
      });
      setMatrixState(tempState);
    }
  }, [matrixData]);

  const selectedRole = matrixData?.roles.find(r => r._id === selectedRoleId);

  const hasRoleUnsavedChanges = (roleId: string): boolean => {
    if (!matrixData || !matrixState[roleId]) return false;
    const roleState = matrixState[roleId];
    
    return matrixData.modules.some((mod) => {
      const currentActions = roleState[mod];
      if (!currentActions) return false;
      
      const original = matrixData.permissions.find(
        (p) => p.roleId === roleId && p.module === mod
      );
      
      const originalActions = original?.actions || {
        view: false, create: false, edit: false, delete: false, approve: false, assign: false, export: false
      };
      
      return ACTIONS_LIST.some((action) => currentActions[action] !== originalActions[action]);
    });
  };

  const hasAnyUnsavedChanges = matrixData?.roles.some((role) => hasRoleUnsavedChanges(role._id!)) || false;

  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasAnyUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes in the Access Matrix. Are you sure you want to leave?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasAnyUnsavedChanges]);



  const isActionAllChecked = (action: keyof PermissionActions): boolean => {
    if (!selectedRoleId || !matrixData) return false;
    const rolePerms = matrixState[selectedRoleId];
    if (!rolePerms) return false;
    
    return matrixData.modules.every((mod) => !!rolePerms[mod]?.[action]);
  };

  const handleActionColumnToggle = (action: keyof PermissionActions) => {
    if (!selectedRoleId || !matrixData) return;
    const allChecked = isActionAllChecked(action);
    
    setMatrixState((prev) => {
      const rolePerms = prev[selectedRoleId] || {};
      const updatedRolePerms = { ...rolePerms };
      
      matrixData.modules.forEach((mod) => {
        const modActions = updatedRolePerms[mod] || { view: false, create: false, edit: false, delete: false, approve: false, assign: false, export: false };
        updatedRolePerms[mod] = { ...modActions, [action]: !allChecked };
      });
      
      return {
        ...prev,
        [selectedRoleId]: updatedRolePerms,
      };
    });
  };

  const isModuleAllChecked = (moduleCode: string): boolean => {
    if (!selectedRoleId) return false;
    const rolePerms = matrixState[selectedRoleId] || {};
    const modActions = rolePerms[moduleCode];
    if (!modActions) return false;
    
    return ACTIONS_LIST.every((action) => !!modActions[action]);
  };

  const handleModuleRowToggle = (moduleCode: string) => {
    if (!selectedRoleId || !matrixData) return;
    const allChecked = isModuleAllChecked(moduleCode);
    
    setMatrixState((prev) => {
      const rolePerms = prev[selectedRoleId] || {};
      const modActions = rolePerms[moduleCode] || { view: false, create: false, edit: false, delete: false, approve: false, assign: false, export: false };
      
      const updatedActions = { ...modActions };
      ACTIONS_LIST.forEach((action) => {
        updatedActions[action] = !allChecked;
      });
      
      return {
        ...prev,
        [selectedRoleId]: {
          ...rolePerms,
          [moduleCode]: updatedActions,
        },
      };
    });
  };

  const handleActionToggle = (moduleCode: string, action: keyof PermissionActions) => {
    if (!selectedRoleId) return;
    setMatrixState((prev) => {
      const rolePerms = prev[selectedRoleId] || {};
      const modActions = rolePerms[moduleCode] || { view: false, create: false, edit: false, delete: false, approve: false, assign: false, export: false };
      const updatedActions = { ...modActions, [action]: !modActions[action] };
      return {
        ...prev,
        [selectedRoleId]: {
          ...rolePerms,
          [moduleCode]: updatedActions,
        },
      };
    });
  };

  // Sync Permissions Mutation
  const syncPermissionsMutation = useMutation({
    mutationFn: authPermissionApi.syncPermissions,
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['permissionMatrix'] });
        addToast('Permissions Synced', 'All role permissions have been refreshed including PROJECTS, RECRUITMENT, and LEAVE_POLICY modules.', 'success');
      } else {
        addToast('Sync Failed', data.message || 'Failed to sync permissions', 'error');
      }
    },
    onError: (err: any) => {
      addToast('Sync Error', err.response?.data?.message || 'Could not sync permissions', 'error');
    },
  });

  // Matrix Update Mutation
  const updateMatrixMutation = useMutation({
    mutationFn: authPermissionApi.updateMatrix,
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['permissionMatrix'] });
        addToast('Success', 'Access matrix updated successfully.', 'success');
      } else {
        addToast('Error', data.message || 'Failed to update access matrix', 'error');
      }
    },
    onError: (err: any) => {
      addToast('Error', err.response?.data?.message || 'Could not save access matrix', 'error');
    },
  });

  const handleSaveMatrix = () => {
    if (!matrixData) return;

    const updates: MatrixUpdateRequest[] = [];
    matrixData.roles.forEach((role) => {
      const roleId = role._id!;
      if (hasRoleUnsavedChanges(roleId)) {
        const roleState = matrixState[roleId];
        if (roleState) {
          Object.entries(roleState).forEach(([moduleCode, actions]) => {
            updates.push({
              roleId,
              module: moduleCode,
              actions,
            });
          });
        }
      }
    });

    if (updates.length === 0) {
      addToast('No Changes', 'There are no unsaved changes to save.', 'info');
      return;
    }

    updateMatrixMutation.mutate(updates);
  };

  if (isMatrixLoading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            System & Security Settings
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure company global policies, office WiFi whitelisting for IP attendance, and admin preferences
          </p>
        </div>
        <Button
          onClick={() => {
            if (window.confirm('Are you sure you want to sync default permissions? This will reset all roles to their default permissions and may overwrite any custom matrix configurations.')) {
              syncPermissionsMutation.mutate();
            }
          }}
          isLoading={syncPermissionsMutation.isPending}
          variant="outline"
          className="flex items-center gap-1.5 text-xs font-bold border-primary/30 text-primary hover:bg-primary/10"
          title="Re-sync all role permissions to include new modules (PROJECTS, RECRUITMENT, LEAVE_POLICY, etc.)"
        >
          <RefreshCw className="w-4 h-4" />
          Sync Default Permissions
        </Button>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex border-b border-border">
        <NavLink
          to="/settings"
          end
          className={({ isActive }) =>
            `px-6 py-3 font-bold text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`
          }
        >
          <Settings className="w-4 h-4" /> Global Settings
        </NavLink>
        <NavLink
          to="/settings/roles"
          className={({ isActive }) =>
            `px-6 py-3 font-bold text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`
          }
        >
          <Users className="w-4 h-4" /> Role Management
        </NavLink>
        <NavLink
          to="/settings/permissions"
          className={({ isActive }) =>
            `px-6 py-3 font-bold text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`
          }
        >
          <ShieldCheck className="w-4 h-4" /> Permissions Matrix
        </NavLink>
        {hasPermission('LEAVE_POLICY', 'view') && (
          <NavLink
            to="/settings/leave-policy"
            className={({ isActive }) =>
              `px-6 py-3 font-bold text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
                isActive
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <Calendar className="w-4 h-4" /> Leave Policy
          </NavLink>
        )}
      </div>


      <div className="space-y-6">
          <div className="flex flex-col md:flex-row gap-6">
            {/* Roles Sidebar */}
            <div className="w-full md:w-64 flex-shrink-0">
              <Card className="p-4 space-y-3">
                <h4 className="text-xs font-black text-muted-foreground uppercase tracking-widest border-b border-border pb-2">Select Target Role</h4>
                {isMatrixLoading ? (
                  <div className="space-y-2 py-4">
                    {[1, 2, 3, 4, 5].map(n => <div key={n} className="h-9 bg-muted/30 rounded-lg animate-pulse" />)}
                  </div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {matrixData?.roles.map((role) => {
                      const hasUnsaved = hasRoleUnsavedChanges(role._id!);
                      return (
                        <button
                          key={role._id}
                          onClick={() => setSelectedRoleId(role._id!)}
                          className={`flex flex-col text-left px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all ${
                            selectedRoleId === role._id
                              ? 'bg-primary/10 border-primary text-primary shadow-sm'
                              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
                          }`}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="font-bold">{role.name}</span>
                            {hasUnsaved && (
                              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse flex-shrink-0" title="Unsaved changes" />
                            )}
                          </div>
                          <span className="text-[9px] font-black uppercase opacity-85 mt-0.5">{role.code}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>

            {/* Matrix Sheet */}
            <div className="flex-1 min-w-0">
              <Card className="p-6 space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
                  <div>
                    <h3 className="text-lg font-bold text-foreground">
                      Access Matrix {selectedRole ? `for ${selectedRole.name}` : ''}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Toggle standard capabilities (View, Create, Edit, etc.) on modules for the selected role.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {hasAnyUnsavedChanges && (
                      <span className="text-xs text-amber-500 font-semibold flex items-center gap-1.5 animate-pulse">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Unsaved Changes
                      </span>
                    )}
                    <Button 
                      onClick={handleSaveMatrix} 
                      isLoading={updateMatrixMutation.isPending} 
                      className="bg-primary text-white font-bold text-xs shadow-lg shadow-primary/25"
                    >
                      <Save className="w-4 h-4 mr-1.5" /> SAVE MATRIX
                    </Button>
                  </div>
                </div>

                {isMatrixLoading ? (
                  <div className="py-20 text-center text-muted-foreground animate-pulse">Loading Matrix Sheet...</div>
                ) : !selectedRoleId ? (
                  <div className="py-20 text-center text-muted-foreground">Select a role to inspect permissions.</div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-border bg-card">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                          <th className="p-4 w-48">Module Name</th>
                          {ACTIONS_LIST.map((action) => (
                            <th key={action} className="p-4 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span>{action}</span>
                                <input
                                  type="checkbox"
                                  checked={isActionAllChecked(action)}
                                  onChange={() => handleActionColumnToggle(action)}
                                  className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary focus:ring-offset-background cursor-pointer"
                                  title={`Toggle all ${action} permissions`}
                                />
                              </div>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-xs">
                        {matrixData?.modules.map((moduleCode) => {
                          const rolePerms = matrixState[selectedRoleId] || {};
                          const modActions = rolePerms[moduleCode] || { view: false, create: false, edit: false, delete: false, approve: false, assign: false, export: false };

                          return (
                            <tr key={moduleCode} className="hover:bg-muted/10 transition-colors">
                              <td className="p-4 font-bold text-foreground">
                                <div className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={isModuleAllChecked(moduleCode)}
                                    onChange={() => handleModuleRowToggle(moduleCode)}
                                    className="h-3.5 w-3.5 rounded border-border text-primary focus:ring-primary focus:ring-offset-background cursor-pointer"
                                    title="Toggle all actions for this module"
                                  />
                                  <div>
                                    {moduleCode.replace(/_/g, ' ')}
                                    <span className="block text-[9px] font-medium text-muted-foreground font-mono mt-0.5">{moduleCode}</span>
                                  </div>
                                </div>
                              </td>
                              {ACTIONS_LIST.map((action) => (
                                <td key={action} className="p-4 text-center">
                                  <input
                                    type="checkbox"
                                    checked={!!modActions[action]}
                                    onChange={() => handleActionToggle(moduleCode, action)}
                                    className="h-4.5 w-4.5 rounded border-border text-primary focus:ring-primary focus:ring-offset-background cursor-pointer"
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          </div>
        </div>
    </div>
  );
};
