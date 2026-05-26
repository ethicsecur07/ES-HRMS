import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authPermissionApi, type PermissionData, type PermissionActions, type MatrixUpdateRequest } from '../api_service/authPermissionApi';
import { employeeApi } from '../api_service/employeeApi';
import { useNotificationStore } from '../store/useNotificationStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input } from '../Components/WrapperComponents/Input';
import { Settings, ShieldCheck, Users, Save, ShieldAlert, FileJson, AlertTriangle, Plus, Trash2, Search, Sparkles, RefreshCw } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const ACTIONS_LIST: (keyof PermissionActions)[] = ['view', 'create', 'edit', 'delete', 'approve', 'assign', 'export'];

export const PermissionPage: React.FC = () => {
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  const [activeSubTab, setActiveSubTab] = useState<'matrix' | 'overrides'>('matrix');

  // Matrix State
  const [selectedRoleId, setSelectedRoleId] = useState<string>('');
  const [matrixState, setMatrixState] = useState<Record<string, Record<string, PermissionActions>>>({});

  // Overrides State
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [selectedUserOverrides, setSelectedUserOverrides] = useState<PermissionData[]>([]);
  const [editingOverrideModule, setEditingOverrideModule] = useState<string>('');
  
  // Override form states
  const [overrideActions, setOverrideActions] = useState<PermissionActions>({
    view: false, create: false, edit: false, delete: false, approve: false, assign: false, export: false
  });
  const [restrictedFieldsInput, setRestrictedFieldsInput] = useState('');
  const [policyJson, setPolicyJson] = useState('');

  // Fetch Matrix
  const { data: matrixData, isLoading: isMatrixLoading } = useQuery({
    queryKey: ['permissionMatrix'],
    queryFn: authPermissionApi.getMatrix,
    enabled: activeSubTab === 'matrix',
  });

  // Fetch Employees
  const { data: employees = [], isLoading: isEmployeesLoading } = useQuery({
    queryKey: ['employeesList'],
    queryFn: () => employeeApi.getAll().then(res => res.employees),
    enabled: activeSubTab === 'overrides',
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
  const selectedEmployee = employees.find(e => e._id === selectedEmployeeId);

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

  // Fetch Overrides when employee changes
  useEffect(() => {
    const fetchOverrides = async () => {
      if (selectedEmployee && selectedEmployee.userId) {
        try {
          const overrides = await authPermissionApi.getUserOverrides(selectedEmployee.userId);
          setSelectedUserOverrides(overrides || []);
          // Reset edit override state
          setEditingOverrideModule('');
        } catch (error) {
          console.error('Failed to fetch user overrides:', error);
          setSelectedUserOverrides([]);
        }
      } else {
        setSelectedUserOverrides([]);
      }
    };

    fetchOverrides();
  }, [selectedEmployee]);

  // Set form when editing an override
  const handleEditOverride = (moduleCode: string) => {
    setEditingOverrideModule(moduleCode);
    const existing = selectedUserOverrides.find(o => o.module === moduleCode);
    if (existing) {
      setOverrideActions({ ...existing.actions });
      setRestrictedFieldsInput((existing.restrictedFields || []).join(', '));
      setPolicyJson(existing.policyCondition ? JSON.stringify(existing.policyCondition, null, 2) : '');
    } else {
      setOverrideActions({
        view: false, create: false, edit: false, delete: false, approve: false, assign: false, export: false
      });
      setRestrictedFieldsInput('');
      setPolicyJson('');
    }
  };

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
        addToast('Permissions Synced', 'All role permissions have been refreshed including PROJECTS and RECRUITMENT modules.', 'success');
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

  // Save Override Mutation
  const saveOverrideMutation = useMutation({
    mutationFn: authPermissionApi.upsertUserOverride,
    onSuccess: (res: any) => {
      if (res && (res.success || res._id || res.module)) {
        addToast('Override Saved', 'User-specific override updated successfully.', 'success');
        if (selectedEmployee && selectedEmployee.userId) {
          // Refetch overrides
          authPermissionApi.getUserOverrides(selectedEmployee.userId).then((overrides) => {
            setSelectedUserOverrides(overrides || []);
          });
        }
        setEditingOverrideModule('');
      } else {
        addToast('Error', res.message || 'Failed to save override', 'error');
      }
    },
    onError: (err: any) => {
      addToast('Error', err.response?.data?.message || 'Could not save override', 'error');
    },
  });

  // Delete Override Mutation
  const deleteOverrideMutation = useMutation({
    mutationFn: ({ userId, module }: { userId: string; module: string }) => 
      authPermissionApi.deleteUserOverride(userId, module),
    onSuccess: (res) => {
      if (res.success) {
        addToast('Override Removed', 'User-specific override cleared.', 'warning');
        if (selectedEmployee && selectedEmployee.userId) {
          authPermissionApi.getUserOverrides(selectedEmployee.userId).then((overrides) => {
            setSelectedUserOverrides(overrides || []);
          });
        }
      } else {
        addToast('Error', res.message || 'Failed to remove override', 'error');
      }
    },
    onError: (err: any) => {
      addToast('Error', err.response?.data?.message || 'Could not remove override', 'error');
    },
  });

  const handleSaveOverride = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEmployee?.userId || !editingOverrideModule || editingOverrideModule === 'SELECT_MODULE') return;

    let parsedPolicy = null;
    if (policyJson.trim()) {
      try {
        parsedPolicy = JSON.parse(policyJson);
      } catch (err) {
        addToast('Invalid JSON', 'ABAC Policy JSON is invalid. Please verify syntax.', 'error');
        return;
      }
    }

    const fields = restrictedFieldsInput
      .split(',')
      .map(f => f.trim())
      .filter(f => f.length > 0);

    saveOverrideMutation.mutate({
      userId: selectedEmployee.userId,
      module: editingOverrideModule,
      actions: overrideActions,
      restrictedFields: fields,
      policyCondition: parsedPolicy,
    });
  };

  const insertOwnershipPolicyTemplate = () => {
    const template = [
      [
        {
          attribute: "resource.employeeId",
          operator: "EQUALS",
          value: "user.employeeId"
        }
      ]
    ];
    setPolicyJson(JSON.stringify(template, null, 2));
  };

  // Filter employees
  const filteredEmployees = employees.filter((e) =>
    e.fullName.toLowerCase().includes(employeeSearch.toLowerCase()) ||
    e.employeeCode.toLowerCase().includes(employeeSearch.toLowerCase())
  );

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
          title="Re-sync all role permissions to include new modules (PROJECTS, RECRUITMENT, etc.)"
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
      </div>

      {/* Inner Sub Tabs */}
      <div className="flex items-center gap-3 bg-muted/40 p-1.5 rounded-xl w-max border border-border">
        <button
          onClick={() => setActiveSubTab('matrix')}
          className={`px-4 py-2 font-bold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 ${
            activeSubTab === 'matrix'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShieldCheck className="w-4 h-4" /> Dynamic Access Matrix
        </button>
        <button
          onClick={() => {
            if (hasAnyUnsavedChanges) {
              if (!window.confirm('You have unsaved changes in the Access Matrix. Switching tabs will discard these changes. Do you want to proceed?')) {
                return;
              }
            }
            setActiveSubTab('overrides');
          }}
          className={`px-4 py-2 font-bold text-xs uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 ${
            activeSubTab === 'overrides'
              ? 'bg-card text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShieldAlert className="w-4 h-4" /> User Permission Overrides
        </button>
      </div>

      {activeSubTab === 'matrix' ? (
        /* DYNAMIC ACCESS MATRIX TAB */
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
      ) : (
        /* USER OVERRIDES TAB */
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Employee Directory Panel */}
          <div className="w-full lg:w-80 flex-shrink-0">
            <Card className="p-4 space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search employee..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="pl-9 text-xs"
                />
              </div>

              <div className="max-h-[500px] overflow-y-auto pr-1 space-y-1.5">
                {isEmployeesLoading ? (
                  <div className="text-center py-8 text-xs text-muted-foreground animate-pulse">Loading employee directory...</div>
                ) : filteredEmployees.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">No employees found.</div>
                ) : (
                  filteredEmployees.map((emp) => (
                    <button
                      key={emp._id}
                      onClick={() => setSelectedEmployeeId(emp._id)}
                      className={`w-full flex items-start gap-3 p-2.5 rounded-xl border text-left text-xs transition-all ${
                        selectedEmployeeId === emp._id
                          ? 'bg-primary/10 border-primary text-primary shadow-sm'
                          : 'border-transparent hover:bg-muted/50 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center font-bold text-foreground text-xs uppercase flex-shrink-0 border border-border">
                        {emp.fullName.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-bold text-foreground block truncate">{emp.fullName}</span>
                        <span className="text-[10px] text-muted-foreground block truncate">{emp.designation}</span>
                        {emp.ssoData && (
                          <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded text-[8px] font-black bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/25 uppercase tracking-wider">
                            SSO: {emp.ssoData.provider} {emp.ssoData.jobTitle ? `(${emp.ssoData.jobTitle})` : ''}
                          </span>
                        )}
                        {!emp.userId && (
                          <span className="text-[8px] font-black uppercase text-amber-600 dark:text-amber-400 mt-1 block">No User Account</span>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </Card>
          </div>

          {/* Overrides Configuration Panel */}
          <div className="flex-1 min-w-0">
            {!selectedEmployeeId ? (
              <Card className="p-12 text-center text-muted-foreground">
                <ShieldAlert className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
                <p className="font-semibold">Select an Employee</p>
                <p className="text-xs mt-1">Select a member from the directory list on the left to configure custom permission overrides.</p>
              </Card>
            ) : !selectedEmployee?.userId ? (
              <Card className="p-12 text-center text-muted-foreground border-l-4 border-l-amber-500 bg-amber-500/5">
                <AlertTriangle className="w-12 h-12 mx-auto text-amber-500 mb-3" />
                <p className="font-semibold text-foreground">No Registered User Profile</p>
                <p className="text-xs mt-1">
                  Employee <strong className="text-foreground">{selectedEmployee?.fullName}</strong> does not have an active user credential/account linked. To set permission overrides, please register their user login in the employees roster.
                </p>
              </Card>
            ) : (
              <div className="space-y-6">
                <Card className="p-6 space-y-4">
                  <div className="flex items-center gap-2 border-b border-border pb-3">
                    <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-foreground">User-Specific Override Matrix</h3>
                      <p className="text-xs text-muted-foreground">
                        Custom rules declared here will explicitly override the role-level matrix settings for <strong className="text-foreground">{selectedEmployee.fullName}</strong>.
                      </p>
                    </div>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-border bg-card">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border bg-muted/40 text-[10px] font-black uppercase text-muted-foreground tracking-wider">
                          <th className="p-4 w-40">Module</th>
                          <th className="p-4">Actions Allowed</th>
                          <th className="p-4">Field Restrictions</th>
                          <th className="p-4">ABAC Rules</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border text-xs">
                        {selectedUserOverrides.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="p-8 text-center text-muted-foreground">
                              No overrides configured. This user operates strictly under default role policies.
                            </td>
                          </tr>
                        ) : (
                          selectedUserOverrides.map((over) => (
                            <tr key={over.module} className="hover:bg-muted/10 transition-colors">
                              <td className="p-4 font-bold text-foreground font-mono">{over.module}</td>
                              <td className="p-4">
                                <div className="flex flex-wrap gap-1">
                                  {Object.entries(over.actions).some(([_, allowed]) => allowed) ? (
                                    Object.entries(over.actions)
                                      .filter(([_, allowed]) => allowed)
                                      .map(([act]) => (
                                        <span key={act} className="px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 font-black text-[9px] uppercase tracking-wider">
                                          {act}
                                        </span>
                                      ))
                                  ) : (
                                    <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive border border-destructive/20 font-black text-[9px] uppercase tracking-wider">
                                      Explicitly Blocked
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="p-4 text-muted-foreground">
                                {over.restrictedFields && over.restrictedFields.length > 0
                                  ? over.restrictedFields.join(', ')
                                  : 'None'}
                              </td>
                              <td className="p-4">
                                {over.policyCondition ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-indigo-400 font-bold bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-lg">
                                    <FileJson className="w-3 h-3" /> Configured
                                  </span>
                                ) : (
                                  <span className="text-muted-foreground">None</span>
                                )}
                              </td>
                              <td className="p-4 text-right">
                                <div className="flex gap-2 justify-end">
                                  <button
                                    onClick={() => handleEditOverride(over.module)}
                                    className="px-2.5 py-1 text-[10px] font-bold uppercase rounded border border-border hover:bg-muted text-foreground"
                                  >
                                    Edit
                                  </button>
                                  <button
                                    onClick={() => {
                                      if (window.confirm(`Remove custom override for module ${over.module}?`)) {
                                        deleteOverrideMutation.mutate({
                                          userId: selectedEmployee.userId!,
                                          module: over.module,
                                        });
                                      }
                                    }}
                                    className="p-1 rounded border border-border hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {!editingOverrideModule && (
                    <div className="pt-2">
                      <Button
                        onClick={() => {
                          setEditingOverrideModule('SELECT_MODULE');
                          setOverrideActions({
                            view: false, create: false, edit: false, delete: false, approve: false, assign: false, export: false
                          });
                          setRestrictedFieldsInput('');
                          setPolicyJson('');
                        }}
                        className="bg-foreground text-background hover:bg-foreground/90 font-bold text-xs"
                      >
                        <Plus className="w-4 h-4 mr-1.5" /> CONFIGURE NEW MODULE OVERRIDE
                      </Button>
                    </div>
                  )}
                </Card>

                {editingOverrideModule && (
                  <Card className="p-6 space-y-6 border-2 border-primary/20 animate-in slide-in-from-bottom-3 duration-300">
                    <h4 className="text-base font-bold text-foreground border-b border-border pb-3 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-primary" /> 
                      {editingOverrideModule === 'SELECT_MODULE' 
                        ? 'Create Custom Override' 
                        : selectedUserOverrides.some(o => o.module === editingOverrideModule)
                          ? `Edit Override for ${editingOverrideModule.replace(/_/g, ' ')}` 
                          : `Create Override for ${editingOverrideModule.replace(/_/g, ' ')}`
                      }
                    </h4>

                    <form onSubmit={handleSaveOverride} className="space-y-5">
                      {!selectedUserOverrides.some(o => o.module === editingOverrideModule) ? (
                        <div className="space-y-1.5 text-left">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Select Module *</label>
                          <select
                            value={editingOverrideModule}
                            onChange={(e) => setEditingOverrideModule(e.target.value)}
                            required
                            className="h-10 w-full px-3 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors disabled:opacity-50 text-sm cursor-pointer"
                          >
                            <option value="SELECT_MODULE" disabled>-- Choose Module --</option>
                            {matrixData?.modules
                              .filter((m) => !selectedUserOverrides.some((o) => o.module === m) || m === editingOverrideModule)
                              .map((m) => (
                                <option key={m} value={m}>{m.replace(/_/g, ' ')} ({m})</option>
                              ))
                            }
                          </select>
                        </div>
                      ) : (
                        <div className="space-y-1.5 text-left">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Module</label>
                          <Input
                            value={`${editingOverrideModule.replace(/_/g, ' ')} (${editingOverrideModule})`}
                            disabled
                            className="bg-muted text-muted-foreground cursor-not-allowed"
                          />
                        </div>
                      )}

                      <div className="space-y-2 text-left">
                        <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Override Capability Clearances</label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-3">
                          {ACTIONS_LIST.map((action) => (
                            <label
                              key={action}
                              className={`flex flex-col items-center justify-center p-3 rounded-xl border text-[10px] font-black uppercase tracking-wider cursor-pointer transition-all ${
                                overrideActions[action]
                                  ? 'bg-primary/10 border-primary text-primary shadow-sm'
                                  : 'bg-muted/10 border-border text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={!!overrideActions[action]}
                                onChange={() => setOverrideActions(prev => ({ ...prev, [action]: !prev[action] }))}
                                className="hidden"
                              />
                              <span>{action}</span>
                            </label>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Restricted Fields */}
                        <div className="space-y-1.5 text-left">
                          <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Field-Level Access Restrictions</label>
                          <Input
                            placeholder="e.g. salary, address, emergencyContact"
                            value={restrictedFieldsInput}
                            onChange={(e) => setRestrictedFieldsInput(e.target.value)}
                          />
                          <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
                            List schema attributes (comma-separated) you wish to HIDE from this user in this module.
                          </p>
                        </div>

                        {/* ABAC Policy JSON */}
                        <div className="space-y-1.5 text-left">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">ABAC Policy Condition JSON</label>
                            <button
                              type="button"
                              onClick={insertOwnershipPolicyTemplate}
                              className="text-[10px] font-bold text-primary hover:underline"
                            >
                              + Insert Ownership Rule
                            </button>
                          </div>
                          <textarea
                            placeholder='[ [{"attribute": "resource.employeeId", "operator": "EQUALS", "value": "user.employeeId"}] ]'
                            value={policyJson}
                            onChange={(e) => setPolicyJson(e.target.value)}
                            rows={4}
                            className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors disabled:opacity-50 text-xs font-mono resize-none"
                          />
                          <p className="text-[10px] text-muted-foreground leading-relaxed mt-1">
                            Provide structured array conditions to enforce contextual ownership limits.
                          </p>
                        </div>
                      </div>

                      <div className="flex justify-end gap-3 pt-4 border-t border-border">
                        <Button type="button" variant="outline" onClick={() => setEditingOverrideModule('')}>CANCEL</Button>
                        <Button 
                          type="submit" 
                          className="bg-primary text-white font-bold"
                          isLoading={saveOverrideMutation.isPending}
                          disabled={editingOverrideModule === 'SELECT_MODULE'}
                        >
                          SAVE OVERRIDE RULES
                        </Button>
                      </div>
                    </form>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
