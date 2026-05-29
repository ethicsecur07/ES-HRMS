import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roleApi, type RoleData } from '../api_service/roleApi';
import { employeeApi } from '../api_service/employeeApi';
import { useNotificationStore } from '../store/useNotificationStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input } from '../Components/WrapperComponents/Input';
import { Modal } from '../Components/WrapperComponents/Modal';
import { Settings, Plus, Edit2, Trash2, Network, Lock, ShieldAlert, ArrowRight, Users, ShieldCheck, ChevronDown, Check, X, Search, Calendar } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { usePermission } from '../hooks/usePermission';


export const RoleManagementPage: React.FC = () => {
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermission();

  const [isModalOpen, setIsModalOpen] = useState(false);

  const [editingRole, setEditingRole] = useState<RoleData | null>(null);

  // Form states
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [parentRoleId, setParentRoleId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [memberSearch, setMemberSearch] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch all employees to allow mapping of users to roles
  const { data: employeesData } = useQuery({
    queryKey: ['employees-all'],
    queryFn: () => employeeApi.getAll({ limit: 1000 }),
  });
  const employees = employeesData?.employees || [];

  const filteredEmployees = employees.filter(emp =>
    emp.fullName.toLowerCase().includes(memberSearch.toLowerCase()) ||
    emp.email.toLowerCase().includes(memberSearch.toLowerCase())
  );

  // Fetch current role members when editing
  const { data: currentMembers = null } = useQuery({
    queryKey: ['role-members', editingRole?._id],
    queryFn: () => roleApi.getMembers(editingRole?._id!),
    enabled: !!editingRole?._id,
  });

  const updateMembersMutation = useMutation({
    mutationFn: ({ id, userIds }: { id: string; userIds: string[] }) => roleApi.updateMembers(id, userIds),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['role-members', editingRole?._id] });
    },
    onError: (err: any) => {
      addToast('Error', err.response?.data?.message || 'Could not update role members', 'error');
    }
  });

  React.useEffect(() => {
    if (currentMembers && Array.isArray(currentMembers)) {
      const ids = currentMembers.map((m: any) => {
        if (!m.userId) return null;
        return typeof m.userId === 'object' ? m.userId._id || m.userId.id : m.userId;
      });
      setSelectedUserIds(ids.filter(Boolean));
    } else {
      setSelectedUserIds([]);
    }
  }, [currentMembers]);

  // Fetch Roles
  const { data: roles = [], isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: roleApi.getAll,
  });

  const wouldCreateCycle = (roleId?: string, targetParentId?: string): boolean => {
    if (!roleId || !targetParentId) return false;
    if (roleId === targetParentId) return true;
    let current = roles.find(r => r._id === targetParentId);
    while (current) {
      if (current.parentRoleId === roleId) return true;
      const nextParentId = current.parentRoleId;
      if (!nextParentId) break;
      current = roles.find(r => r._id === nextParentId);
    }
    return false;
  };

  const resetForm = () => {
    setName('');
    setCode('');
    setDescription('');
    setParentRoleId(null);
    setIsActive(true);
    setEditingRole(null);
    setSelectedUserIds([]);
    setMemberSearch('');
    setIsDropdownOpen(false);
  };

  const handleOpenCreate = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const handleOpenEdit = (role: RoleData) => {
    setEditingRole(role);
    setName(role.name);
    setCode(role.code);
    setDescription(role.description || '');
    const pId = role.parentRoleId && typeof role.parentRoleId === 'object' ? (role.parentRoleId as any)._id : role.parentRoleId;
    setParentRoleId(pId || null);
    setIsActive(role.isActive);
    setIsModalOpen(true);
  };

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: roleApi.create,
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      // If there are selected users, assign them to the new role
      const createdRole = data; // data is the unwrapped role object
      if (selectedUserIds.length > 0 && createdRole?._id) {
        updateMembersMutation.mutate({
          id: createdRole._id,
          userIds: selectedUserIds
        });
      }
      addToast('Success', 'Role created successfully', 'success');
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      addToast('Error', err.response?.data?.message || 'Could not create role', 'error');
    },
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<RoleData> }) => roleApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      addToast('Success', 'Role updated successfully', 'success');
      setIsModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      addToast('Error', err.response?.data?.message || 'Could not update role', 'error');
    },
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: roleApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      addToast('Success', 'Role deactivated successfully', 'success');
    },
    onError: (err: any) => {
      addToast('Error', err.response?.data?.message || 'Could not delete role', 'error');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRole && editingRole._id) {
      if (wouldCreateCycle(editingRole._id, parentRoleId || undefined)) {
        addToast('Cycle Detected', 'Assigning this parent would create a cyclic reference in the hierarchy!', 'error');
        return;
      }
      updateMutation.mutate({
        id: editingRole._id,
        data: { name, code, description, parentRoleId, isActive },
      });
      updateMembersMutation.mutate({
        id: editingRole._id,
        userIds: selectedUserIds
      });
    } else {
      createMutation.mutate({ name, code, description, parentRoleId, isActive });
    }
  };
  // Find root node or construct a logical tree hierarchy
  const renderHierarchyNode = (role: RoleData, depth = 0) => {
    const children = roles.filter(r => {
      const parentId = r.parentRoleId && typeof r.parentRoleId === 'object' ? (r.parentRoleId as any)._id : r.parentRoleId;
      return parentId === role._id;
    });
    return (
      <div key={role._id} className="relative select-none text-left">
        <div 
          className="flex items-center gap-3 p-3.5 my-2.5 rounded-xl border border-border bg-card shadow-sm hover:border-primary/40 hover:shadow-md transition-all group max-w-2xl"
          style={{ marginLeft: `${depth * 28}px` }}
        >
          {depth > 0 && (
            <div className="absolute left-0 -translate-x-full w-4 h-px bg-border group-hover:bg-primary/40" style={{ marginLeft: `${depth * 28 - 20}px` }} />
          )}
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 text-primary flex items-center justify-center flex-shrink-0">
            <Network className="w-4 h-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-foreground truncate">{role.name}</span>
              <span className="text-[10px] font-black uppercase bg-muted border border-border px-2 py-0.5 rounded text-muted-foreground">{role.code}</span>
              {!role.isActive && (
                <span className="text-[10px] font-bold uppercase bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded">Deactivated</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground truncate mt-0.5">{role.description || 'No description provided.'}</p>
            {role.members && role.members.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5 max-w-full">
                {role.members.map((m: any) => (
                  <span key={m._id || m.id} className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-[10px] font-semibold leading-none">
                    {m.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={() => handleOpenEdit(role)} 
              className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
              title="Edit Role"
            >
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            {['ADMIN', 'MANAGER', 'HR', 'TEAM_LEAD', 'EMPLOYEE'].includes(role.code) ? (
              <span className="p-1.5 text-muted-foreground" title="System roles cannot be deleted">
                <Lock className="w-3.5 h-3.5 opacity-40" />
              </span>
            ) : (
              <button 
                onClick={() => {
                  if (window.confirm(`Are you sure you want to deactivate and soft-delete the role "${role.name}"?`)) {
                    deleteMutation.mutate(role._id!);
                  }
                }} 
                className="p-1.5 rounded-lg border border-border hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                title="Deactivate Role"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
        {children.map(child => renderHierarchyNode(child, depth + 1))}
      </div>
    );
  };

  // Roles without parent are root nodes
  const rootRoles = roles.filter(r => {
    const parentId = r.parentRoleId && typeof r.parentRoleId === 'object' ? (r.parentRoleId as any)._id : r.parentRoleId;
    return !parentId || !roles.some(parent => parent._id === parentId);
  });

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
                  ? 'border-primary text-primary font-extrabold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`
            }
          >
            <Calendar className="w-4 h-4" /> Leave Policy
          </NavLink>
        )}
      </div>


      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 space-y-6">
          <Card className="p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div>
                <h3 className="text-lg font-bold text-foreground">Role Hierarchies</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Visual representation of company role inherits. Higher roles inherit the permission subsets of their direct parents.</p>
              </div>
              <Button onClick={handleOpenCreate} className="bg-primary text-white font-bold text-xs px-4 py-2 shadow-sm">
                <Plus className="w-4 h-4 mr-1.5" /> ADD ROLE
              </Button>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground animate-pulse">Loading roles configuration...</div>
            ) : roles.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">No roles registered for this organization.</div>
            ) : (
              <div className="p-4 rounded-xl border border-border bg-muted/20 overflow-x-auto min-h-[300px]">
                {rootRoles.map(root => renderHierarchyNode(root, 0))}
              </div>
            )}
          </Card>
        </div>

        <div className="w-full lg:w-96">
          <Card className="p-6 space-y-4 border-l-4 border-l-primary bg-card/60">
            <h3 className="text-base font-bold text-foreground flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-primary" /> Role Permissions Inheritance
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              EthicSecur HRMS features an enterprise-grade authorization engine. Lower roles represent the absolute baseline permissions.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Higher roles inherit their parent's configurations recursively. For example:
            </p>
            <div className="p-3.5 rounded-xl border border-border bg-background text-[11px] font-semibold text-foreground space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-primary font-bold">ADMIN</span>
                <ArrowRight className="w-3 h-3 opacity-60" />
                <span>MANAGER</span>
                <ArrowRight className="w-3 h-3 opacity-60" />
                <span>HR</span>
              </div>
              <div className="flex items-center gap-2">
                <span>HR</span>
                <ArrowRight className="w-3 h-3 opacity-60" />
                <span>TEAM_LEAD</span>
                <ArrowRight className="w-3 h-3 opacity-60" />
                <span className="text-muted-foreground">EMPLOYEE</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Assigning a parent link reduces the need to duplicate permission configurations across roles. Modifying a parent's permission propagates automatically downstream.
            </p>
          </Card>
        </div>
      </div>

      {/* CREATE / EDIT MODAL */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRole ? 'Modify System Role' : 'Register New Role'}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <Input 
            label="Role Name *" 
            value={name} 
            onChange={(e) => setName(e.target.value)} 
            placeholder="e.g. Lead Engineer" 
            required 
          />
          <Input 
            label="Role Code *" 
            value={code} 
            onChange={(e) => setCode(e.target.value)} 
            placeholder="e.g. LEAD_ENG" 
            disabled={!!editingRole && ['ADMIN', 'MANAGER', 'HR', 'TEAM_LEAD', 'EMPLOYEE'].includes(editingRole.code)}
            required 
          />
          <div className="space-y-1.5 text-left">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Parent Role (Inherits From)</label>
            <select
              value={parentRoleId || ''}
              onChange={(e) => setParentRoleId(e.target.value || null)}
              disabled={!!editingRole && ['ADMIN', 'MANAGER', 'HR', 'TEAM_LEAD', 'EMPLOYEE'].includes(editingRole.code)}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <option value="">None (Base Level)</option>
              {roles
                .filter(r => !editingRole || (r._id !== editingRole._id && !wouldCreateCycle(editingRole._id, r._id)))
                .map(r => (
                  <option key={r._id} value={r._id}>{r.name} ({r.code})</option>
                ))
              }
            </select>
            <p className="text-[10px] text-muted-foreground mt-1">This role will inherit all permission credentials from the chosen parent.</p>
          </div>

          <div className="space-y-1.5 text-left">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detail the operational scope or access clearance of this role."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all resize-none"
            />
          </div>

          <div className="flex items-center gap-2 py-2 border-t border-border mt-2">
            <input 
              type="checkbox" 
              id="isActive" 
              checked={isActive} 
              onChange={(e) => setIsActive(e.target.checked)} 
              disabled={!!editingRole && ['ADMIN', 'MANAGER', 'HR', 'TEAM_LEAD', 'EMPLOYEE'].includes(editingRole.code)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary focus:ring-offset-background disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <label htmlFor="isActive" className="text-xs font-bold text-foreground cursor-pointer uppercase tracking-wider">Role Active</label>
          </div>

          <div className="space-y-2.5 pt-4 border-t border-border mt-4 text-left" ref={dropdownRef}>
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">Assign Members</label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm transition-all shadow-sm hover:border-primary/30"
              >
                <span className="truncate text-xs">
                  {selectedUserIds.length === 0
                    ? 'Select employees to assign...'
                    : `${selectedUserIds.length} employee(s) selected`}
                </span>
                <ChevronDown className="w-4 h-4 opacity-60 flex-shrink-0" />
              </button>

              {isDropdownOpen && (
                <div className="absolute z-[100] left-0 right-0 mt-1.5 p-3 rounded-xl border border-border bg-card shadow-xl space-y-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                    <input
                      type="text"
                      placeholder="Search employees..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-border bg-background text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                    />
                  </div>

                  <div className="max-h-48 overflow-y-auto divide-y divide-border/50">
                    {filteredEmployees.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-4">No employees found</p>
                    ) : (
                      filteredEmployees.map((emp) => {
                        const uId = emp.userId;
                        const isChecked = uId ? selectedUserIds.includes(uId) : false;

                        return (
                          <div
                            key={emp._id}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (!uId) return;
                              if (isChecked) {
                                setSelectedUserIds(selectedUserIds.filter(id => id !== uId));
                              } else {
                                setSelectedUserIds([...selectedUserIds, uId]);
                              }
                            }}
                            className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors text-xs ${
                              !uId ? 'opacity-50 cursor-not-allowed' : 'hover:bg-muted/50'
                            }`}
                          >
                            <div className="text-left min-w-0 pr-2">
                              <p className="font-bold text-foreground truncate">{emp.fullName}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{emp.email}</p>
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0">
                              {!uId ? (
                                <span className="text-[8px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-500 border border-amber-500/25 px-1.5 py-0.5 rounded">No User</span>
                              ) : isChecked ? (
                                <Check className="w-4 h-4 text-primary" />
                              ) : null}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {selectedUserIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2 max-h-24 overflow-y-auto p-1 rounded-lg border border-border/40 bg-muted/10">
                {selectedUserIds.map((uId) => {
                  const emp = employees.find(e => e.userId === uId);
                  if (!emp) return null;
                  return (
                    <span key={uId} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold">
                      {emp.fullName}
                      <button
                        type="button"
                        onClick={() => setSelectedUserIds(selectedUserIds.filter(id => id !== uId))}
                        className="hover:text-primary-hover flex items-center p-0.5 text-muted-foreground hover:text-primary"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>CANCEL</Button>
            <Button 
              type="submit" 
              className="bg-primary text-white font-bold"
              isLoading={createMutation.isPending || updateMutation.isPending}
            >
              {editingRole ? 'SAVE CHANGES' : 'CREATE ROLE'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
