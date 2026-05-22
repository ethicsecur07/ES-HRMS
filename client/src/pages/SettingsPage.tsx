import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { analyticsApi } from '../api_service/analyticsApi';
import { departmentApi } from '../api_service/departmentApi';
import { designationApi } from '../api_service/designationApi';
import { useNotificationStore } from '../store/useNotificationStore';
import { useAuthStore } from '../store/useAuthStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input } from '../Components/WrapperComponents/Input';
import {
  Settings,
  Wifi,
  Save,
  Plus,
  Trash2,
  Users,
  ShieldCheck,
  Edit2,
  Briefcase,
  FolderTree,
  X,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { addToast } = useNotificationStore();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === 'ADMIN';
  const [activeSubTab, setActiveSubTab] = useState<'global' | 'departments' | 'designations'>(
    isAdmin ? 'global' : 'departments'
  );

  // --- Global Settings State & Queries ---
  const { data: settings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: analyticsApi.getSettings,
    enabled: isAdmin,
  });

  const [companyName, setCompanyName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [monthlyLeaveLimit, setMonthlyLeaveLimit] = useState(2);
  const [monthlyWFHLimit, setMonthlyWFHLimit] = useState(1);
  const [monthlyPermissionHours, setMonthlyPermissionHours] = useState(3);
  const [officeIPs, setOfficeIPs] = useState<string[]>([]);
  const [newIP, setNewIP] = useState('');

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.companyName);
      setAdminEmail(settings.adminEmail);
      setMonthlyLeaveLimit(settings.monthlyLeaveLimit);
      setMonthlyWFHLimit(settings.monthlyWFHLimit);
      setMonthlyPermissionHours(settings.monthlyPermissionHours);
      setOfficeIPs(settings.officeWiFiIPs || []);
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => analyticsApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      addToast('Settings Saved', 'Global settings updated successfully.', 'success');
    },
    onError: (err: any) => {
      addToast('Error', err.message || 'Could not save settings.', 'error');
    },
  });

  const handleAddIP = () => {
    if (!newIP.trim()) return;
    if (officeIPs.includes(newIP.trim())) {
      addToast('Duplicate IP', 'This IP address is already whitelisted.', 'warning');
      return;
    }
    setOfficeIPs([...officeIPs, newIP.trim()]);
    setNewIP('');
  };

  const handleRemoveIP = (ip: string) => {
    setOfficeIPs(officeIPs.filter((item) => item !== ip));
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate({
      companyName,
      adminEmail,
      monthlyLeaveLimit,
      monthlyWFHLimit,
      monthlyPermissionHours,
      officeWiFiIPs: officeIPs,
    });
  };

  // --- Departments Queries & Mutations ---
  const { data: departments = [], isLoading: isDeptsLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: departmentApi.getAll,
  });

  const [isDeptModalOpen, setIsDeptModalOpen] = useState(false);
  const [deptModalMode, setDeptModalMode] = useState<'create' | 'edit'>('create');
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptName, setDeptName] = useState('');
  const [deptCode, setDeptCode] = useState('');
  const [deptHead, setDeptHead] = useState('');

  const deptCreateMutation = useMutation({
    mutationFn: (data: any) => departmentApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      addToast('Success', 'Department created successfully.', 'success');
      setIsDeptModalOpen(false);
    },
    onError: (err: any) => {
      addToast('Error', err.response?.data?.message || 'Could not create department.', 'error');
    },
  });

  const deptUpdateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => departmentApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      addToast('Success', 'Department updated successfully.', 'success');
      setIsDeptModalOpen(false);
    },
    onError: (err: any) => {
      addToast('Error', err.response?.data?.message || 'Could not update department.', 'error');
    },
  });

  const deptDeleteMutation = useMutation({
    mutationFn: (id: string) => departmentApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['departments'] });
      addToast('Success', 'Department deactivated/deleted successfully.', 'success');
    },
    onError: (err: any) => {
      addToast('Error', err.response?.data?.message || 'Could not delete department.', 'error');
    },
  });

  const handleOpenDeptModal = (mode: 'create' | 'edit', dept?: any) => {
    setDeptModalMode(mode);
    if (mode === 'edit' && dept) {
      setEditingDeptId(dept._id);
      setDeptName(dept.name);
      setDeptCode(dept.code);
      setDeptHead(dept.headOfDepartment || '');
    } else {
      setEditingDeptId(null);
      setDeptName('');
      setDeptCode('');
      setDeptHead('');
    }
    setIsDeptModalOpen(true);
  };

  const handleSaveDept = (e: React.FormEvent) => {
    e.preventDefault();
    if (!deptName.trim() || !deptCode.trim()) {
      addToast('Validation', 'Name and Code are required.', 'warning');
      return;
    }
    const payload = {
      name: deptName.trim(),
      code: deptCode.toUpperCase().trim(),
      headOfDepartment: deptHead.trim(),
    };
    if (deptModalMode === 'edit' && editingDeptId) {
      deptUpdateMutation.mutate({ id: editingDeptId, data: payload });
    } else {
      deptCreateMutation.mutate(payload);
    }
  };

  // --- Designations Queries & Mutations ---
  const { data: designations = [], isLoading: isDesigsLoading } = useQuery({
    queryKey: ['designations'],
    queryFn: () => designationApi.getAll(),
  });

  const [isDesigModalOpen, setIsDesigModalOpen] = useState(false);
  const [desigModalMode, setDesigModalMode] = useState<'create' | 'edit'>('create');
  const [editingDesigId, setEditingDesigId] = useState<string | null>(null);
  const [desigName, setDesigName] = useState('');
  const [desigCode, setDesigCode] = useState('');
  const [desigDeptId, setDesigDeptId] = useState('');

  const desigCreateMutation = useMutation({
    mutationFn: (data: any) => designationApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['designations'] });
      addToast('Success', 'Designation created successfully.', 'success');
      setIsDesigModalOpen(false);
    },
    onError: (err: any) => {
      addToast('Error', err.response?.data?.message || 'Could not create designation.', 'error');
    },
  });

  const desigUpdateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => designationApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['designations'] });
      addToast('Success', 'Designation updated successfully.', 'success');
      setIsDesigModalOpen(false);
    },
    onError: (err: any) => {
      addToast('Error', err.response?.data?.message || 'Could not update designation.', 'error');
    },
  });

  const desigDeleteMutation = useMutation({
    mutationFn: (id: string) => designationApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['designations'] });
      addToast('Success', 'Designation deactivated/deleted successfully.', 'success');
    },
    onError: (err: any) => {
      addToast('Error', err.response?.data?.message || 'Could not delete designation.', 'error');
    },
  });

  const handleOpenDesigModal = (mode: 'create' | 'edit', desig?: any) => {
    setDesigModalMode(mode);
    if (mode === 'edit' && desig) {
      setEditingDesigId(desig._id);
      setDesigName(desig.name);
      setDesigCode(desig.code);
      setDesigDeptId(desig.departmentId?._id || desig.departmentId || '');
    } else {
      setEditingDesigId(null);
      setDesigName('');
      setDesigCode('');
      setDesigDeptId(departments[0]?._id || '');
    }
    setIsDesigModalOpen(true);
  };

  const handleSaveDesig = (e: React.FormEvent) => {
    e.preventDefault();
    if (!desigName.trim() || !desigCode.trim() || !desigDeptId) {
      addToast('Validation', 'Name, Code, and Department are required.', 'warning');
      return;
    }
    const payload = {
      name: desigName.trim(),
      code: desigCode.toUpperCase().trim(),
      departmentId: desigDeptId,
    };
    if (desigModalMode === 'edit' && editingDesigId) {
      desigUpdateMutation.mutate({ id: editingDesigId, data: payload });
    } else {
      desigCreateMutation.mutate(payload);
    }
  };

  const isLoading = (isAdmin && isSettingsLoading) || isDeptsLoading || isDesigsLoading;

  if (isLoading) {
    return (
      <Card className="animate-pulse h-96 bg-muted/20 flex items-center justify-center">
        <div className="text-muted-foreground">Loading configurations...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            System & Organization Settings
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure company global policies, whitelisted networks, departments, and designations.
          </p>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex flex-wrap border-b border-border">
        {isAdmin && (
          <button
            type="button"
            onClick={() => setActiveSubTab('global')}
            className={`px-6 py-3 font-bold text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              activeSubTab === 'global'
                ? 'border-primary text-primary font-extrabold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <Settings className="w-4 h-4" /> Global Settings
          </button>
        )}
        <button
          type="button"
          onClick={() => setActiveSubTab('departments')}
          className={`px-6 py-3 font-bold text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
            activeSubTab === 'departments'
              ? 'border-primary text-primary font-extrabold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FolderTree className="w-4 h-4" /> Departments
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('designations')}
          className={`px-6 py-3 font-bold text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
            activeSubTab === 'designations'
              ? 'border-primary text-primary font-extrabold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Briefcase className="w-4 h-4" /> Designations
        </button>
        <NavLink
          to="/settings/roles"
          className={({ isActive }) =>
            `px-6 py-3 font-bold text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              isActive
                ? 'border-primary text-primary font-extrabold'
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
                ? 'border-primary text-primary font-extrabold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`
          }
        >
          <ShieldCheck className="w-4 h-4" /> Permissions Matrix
        </NavLink>
      </div>

      {/* Tab Panels */}
      {activeSubTab === 'global' && isAdmin && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <Card className="space-y-6 border-l-4 border-l-primary shadow-md">
            <h3 className="text-lg font-bold text-foreground border-b border-border pb-3">General Company Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Input label="Company Name *" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
              <Input label="Admin Contact Email *" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
            </div>
          </Card>

          <Card className="space-y-6 border-l-4 border-l-foreground shadow-md">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Wifi className="w-5 h-5 text-foreground" />
              <h3 className="text-lg font-bold text-foreground">Office WiFi IP Whitelist (Attendance Security)</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Attendance check-ins are restricted to the IP addresses listed below. Logins from external networks will be flagged as remote and require an approved WFH override.
            </p>

            <div className="flex items-center gap-3 max-w-md">
              <Input placeholder="Add new IP address (e.g. 192.168.29.100)..." value={newIP} onChange={(e) => setNewIP(e.target.value)} />
              <Button type="button" onClick={handleAddIP} className="flex-shrink-0 bg-foreground text-background hover:bg-foreground/90 shadow-md">
                <Plus className="w-4 h-4 mr-1" /> Add IP
              </Button>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {officeIPs.map((ip) => (
                <div key={ip} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted border border-border text-xs font-mono font-bold text-foreground shadow-sm">
                  <span>{ip}</span>
                  <button type="button" onClick={() => handleRemoveIP(ip)} className="text-primary hover:text-primary/80 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-6 border-l-4 border-l-muted-foreground shadow-md">
            <h3 className="text-lg font-bold text-foreground border-b border-border pb-3">Monthly Global Allowance Policies</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <Input label="Casual Leave Limit (Days/Month) *" type="number" value={monthlyLeaveLimit} onChange={(e) => setMonthlyLeaveLimit(Number(e.target.value))} required />
              <Input label="WFH Limit (Days/Month) *" type="number" value={monthlyWFHLimit} onChange={(e) => setMonthlyWFHLimit(Number(e.target.value))} required />
              <Input label="Permission Limit (Hours/Month) *" type="number" value={monthlyPermissionHours} onChange={(e) => setMonthlyPermissionHours(Number(e.target.value))} required />
            </div>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="submit" isLoading={updateSettingsMutation.isPending} size="lg" className="bg-primary text-white font-bold tracking-wider shadow-lg shadow-primary/20">
              <Save className="w-5 h-5 mr-2" />
              SAVE ALL SETTINGS
            </Button>
          </div>
        </form>
      )}

      {activeSubTab === 'departments' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-foreground">Departments Directory</h3>
            <Button onClick={() => handleOpenDeptModal('create')} className="bg-primary hover:bg-primary/95 text-white shadow-md">
              <Plus className="w-4 h-4 mr-2" /> Add Department
            </Button>
          </div>

          <Card className="overflow-hidden shadow-md p-0 border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Code</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Department Name</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Head of Department</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {departments.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                        No departments found. Create one to get started!
                      </td>
                    </tr>
                  ) : (
                    departments.map((dept: any) => (
                      <tr key={dept._id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-4 text-sm font-mono font-bold text-primary">{dept.code}</td>
                        <td className="p-4 text-sm font-semibold text-foreground">{dept.name}</td>
                        <td className="p-4 text-sm text-muted-foreground">{dept.headOfDepartment || 'Not Assigned'}</td>
                        <td className="p-4 text-xs">
                          <span className={`px-2.5 py-1 rounded-full font-bold ${dept.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {dept.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-right space-x-2">
                          <button
                            onClick={() => handleOpenDeptModal('edit', dept)}
                            className="p-1.5 rounded-lg bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to deactivate/delete ${dept.name}?`)) {
                                deptDeleteMutation.mutate(dept._id);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeSubTab === 'designations' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-foreground">Designations Directory</h3>
            <Button onClick={() => handleOpenDesigModal('create')} className="bg-primary hover:bg-primary/95 text-white shadow-md">
              <Plus className="w-4 h-4 mr-2" /> Add Designation
            </Button>
          </div>

          <Card className="overflow-hidden shadow-md p-0 border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Code</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Designation Name</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Department</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {designations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-sm text-muted-foreground">
                        No designations found. Create one to get started!
                      </td>
                    </tr>
                  ) : (
                    designations.map((desig: any) => (
                      <tr key={desig._id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-4 text-sm font-mono font-bold text-primary">{desig.code}</td>
                        <td className="p-4 text-sm font-semibold text-foreground">{desig.name}</td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {desig.departmentId?.name || (typeof desig.departmentId === 'string' ? desig.departmentId : 'Unassigned')}
                        </td>
                        <td className="p-4 text-xs">
                          <span className={`px-2.5 py-1 rounded-full font-bold ${desig.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {desig.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="p-4 text-sm text-right space-x-2">
                          <button
                            onClick={() => handleOpenDesigModal('edit', desig)}
                            className="p-1.5 rounded-lg bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => {
                              if (confirm(`Are you sure you want to deactivate/delete ${desig.name}?`)) {
                                desigDeleteMutation.mutate(desig._id);
                              }
                            }}
                            className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* --- Department Modal --- */}
      {isDeptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-border pb-3 mb-4">
              <h4 className="text-lg font-bold text-foreground">
                {deptModalMode === 'edit' ? 'Edit Department' : 'Create Department'}
              </h4>
              <button onClick={() => setIsDeptModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveDept} className="space-y-4">
              <Input
                label="Department Name *"
                placeholder="e.g. Human Resources"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                required
              />
              <Input
                label="Department Code *"
                placeholder="e.g. HR"
                value={deptCode}
                onChange={(e) => setDeptCode(e.target.value)}
                required
                disabled={deptModalMode === 'edit'}
              />
              <Input
                label="Head of Department"
                placeholder="e.g. Jane Doe"
                value={deptHead}
                onChange={(e) => setDeptHead(e.target.value)}
              />
              <div className="flex justify-end gap-3 pt-3 border-t border-border mt-6">
                <Button type="button" onClick={() => setIsDeptModalOpen(false)} className="bg-muted hover:bg-muted/80 text-foreground">
                  Cancel
                </Button>
                <Button type="submit" isLoading={deptCreateMutation.isPending || deptUpdateMutation.isPending} className="bg-primary text-white">
                  Save Department
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- Designation Modal --- */}
      {isDesigModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-card border border-border p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-border pb-3 mb-4">
              <h4 className="text-lg font-bold text-foreground">
                {desigModalMode === 'edit' ? 'Edit Designation' : 'Create Designation'}
              </h4>
              <button onClick={() => setIsDesigModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveDesig} className="space-y-4">
              <Input
                label="Designation Name *"
                placeholder="e.g. Senior HR Specialist"
                value={desigName}
                onChange={(e) => setDesigName(e.target.value)}
                required
              />
              <Input
                label="Designation Code *"
                placeholder="e.g. SRHR"
                value={desigCode}
                onChange={(e) => setDesigCode(e.target.value)}
                required
                disabled={desigModalMode === 'edit'}
              />
              <div className="space-y-1 text-left">
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Department *</label>
                <select
                  value={desigDeptId}
                  onChange={(e) => setDesigDeptId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  required
                >
                  <option value="" disabled>Select Department</option>
                  {departments.map((dept: any) => (
                    <option key={dept._id} value={dept._id}>
                      {dept.name} ({dept.code})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-3 border-t border-border mt-6">
                <Button type="button" onClick={() => setIsDesigModalOpen(false)} className="bg-muted hover:bg-muted/80 text-foreground">
                  Cancel
                </Button>
                <Button type="submit" isLoading={desigCreateMutation.isPending || desigUpdateMutation.isPending} className="bg-primary text-white">
                  Save Designation
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
