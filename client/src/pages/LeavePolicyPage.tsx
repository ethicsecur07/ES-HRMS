import React, { useState, useMemo } from 'react';
import { SettingsSkeleton } from '../Components/WrapperComponents/Skeleton';
import { NavLink } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leavePolicyApi, type LeavePolicy } from '../api_service/leavePolicyApi';
import { holidayCalendarApi, type Holiday } from '../api_service/holidayCalendarApi';
import { useNotificationStore } from '../store/useNotificationStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input, Select } from '../Components/WrapperComponents/Input';
import { Modal } from '../Components/WrapperComponents/Modal';
import { usePermission } from '../hooks/usePermission';

import {
  Shield,
  Calendar,
  Settings,
  Plus,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ChevronLeft,
  ChevronRight,
  Info,
  CheckCircle,
  XCircle,
  Clock,
  Palmtree,
  Globe,
  Check,
  Loader2,
  Users,
  ShieldCheck,
} from 'lucide-react';


// ─── Helper: Toggle Pill ────────────────────────────────────────────────────
const TogglePill: React.FC<{ value: boolean; onChange: (v: boolean) => void; label?: string }> = ({
  value,
  onChange,
  label,
}) => (
  <button
    type="button"
    onClick={() => onChange(!value)}
    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
      value
        ? 'bg-primary/10 text-primary border-primary/30'
        : 'bg-muted/40 text-muted-foreground border-border'
    }`}
  >
    {value ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
    {label ?? (value ? 'Enabled' : 'Disabled')}
  </button>
);

// ─── Leave type display metadata ────────────────────────────────────────────
const LEAVE_TYPE_META: Record<string, { icon: React.ReactNode; color: string }> = {
  'Casual Leave':     { icon: <Palmtree className="w-4 h-4" />,  color: 'text-emerald-500' },
  'Sick Leave':       { icon: <Shield className="w-4 h-4" />,    color: 'text-blue-500' },
  'WFH':              { icon: <Settings className="w-4 h-4" />,  color: 'text-purple-500' },
  'Permission':       { icon: <Clock className="w-4 h-4" />,     color: 'text-amber-500' },
  'Compensatory Off': { icon: <CheckCircle className="w-4 h-4" />, color: 'text-teal-500' },
  'Unpaid Leave':     { icon: <XCircle className="w-4 h-4" />,   color: 'text-rose-500' },
};

const ALL_LEAVE_TYPES = Object.keys(LEAVE_TYPE_META);

// ─── Policy Edit Form ────────────────────────────────────────────────────────
interface PolicyFormProps {
  policy: Partial<LeavePolicy>;
  onChange: (updated: Partial<LeavePolicy>) => void;
}

const PolicyForm: React.FC<PolicyFormProps> = ({ policy, onChange }) => {
  const set = (key: keyof LeavePolicy, value: any) => onChange({ ...policy, [key]: value });
  const setNested = (parent: keyof LeavePolicy, key: string, value: any) =>
    onChange({ ...policy, [parent]: { ...(policy[parent] as any), [key]: value } });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Monthly Allowance (days / hrs)"
          type="number"
          min={0}
          step={0.5}
          value={policy.monthlyAllowance ?? 0}
          onChange={(e) => set('monthlyAllowance', parseFloat(e.target.value))}
        />
        <Input
          label="Advance Notice (days)"
          type="number"
          min={0}
          value={policy.advanceNoticeDays ?? 0}
          onChange={(e) => set('advanceNoticeDays', parseInt(e.target.value))}
        />
        <Input
          label="Max Consecutive Days (0 = unlimited)"
          type="number"
          min={0}
          value={policy.maxConsecutiveDays ?? 0}
          onChange={(e) => set('maxConsecutiveDays', parseInt(e.target.value))}
        />
        <Input
          label="Late Penalty Count (marks → 0.5 day)"
          type="number"
          min={1}
          value={policy.latePenaltyCount ?? 3}
          onChange={(e) => set('latePenaltyCount', parseInt(e.target.value))}
        />
        <Input
          label="Permission Limit (hrs/month)"
          type="number"
          min={0}
          step={0.5}
          value={policy.permissionConversionHours ?? 3}
          onChange={(e) => set('permissionConversionHours', parseFloat(e.target.value))}
        />
        <Select
          label="Applicable Gender"
          value={policy.applicableGender ?? 'All'}
          onChange={(e) => set('applicableGender', e.target.value)}
          options={[
            { value: 'All', label: 'All Genders' },
            { value: 'Male', label: 'Male Only' },
            { value: 'Female', label: 'Female Only' },
          ]}
        />
      </div>

      {/* Carry Forward */}
      <div className="p-4 bg-muted/20 rounded-xl border border-border space-y-3">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Carry Forward</p>
        <div className="flex items-center gap-4">
          <TogglePill value={policy.carryForward ?? false} onChange={(v) => set('carryForward', v)} label="Carry Forward" />
          {policy.carryForward && (
            <Input
              label="Carry Forward Limit (days)"
              type="number"
              min={0}
              value={policy.carryForwardLimit ?? 0}
              onChange={(e) => set('carryForwardLimit', parseInt(e.target.value))}
              className="w-48"
            />
          )}
        </div>
      </div>

      {/* Rule Toggles */}
      <div className="p-4 bg-muted/20 rounded-xl border border-border space-y-3">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Rules</p>
        <div className="flex flex-wrap gap-3">
          <TogglePill value={policy.sandwichLeaveRule ?? false} onChange={(v) => set('sandwichLeaveRule', v)} label="Sandwich Leave Rule" />
          <TogglePill value={policy.holidayOverlapRule ?? true} onChange={(v) => set('holidayOverlapRule', v)} label="Holiday Overlap Excluded" />
          <TogglePill value={policy.halfDayEnabled ?? true} onChange={(v) => set('halfDayEnabled', v)} label="Half-Day Enabled" />
          <TogglePill value={policy.probationExempt ?? false} onChange={(v) => set('probationExempt', v)} label="Probation Exempt" />
          <TogglePill value={policy.permissionAutoConvert ?? false} onChange={(v) => set('permissionAutoConvert', v)} label="Permission → Half-Day Auto-Convert" />
        </div>
      </div>

      {/* Compensatory Off */}
      <div className="p-4 bg-muted/20 rounded-xl border border-border space-y-3">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Compensatory Off</p>
        <div className="flex items-center gap-4">
          <TogglePill
            value={policy.compensatoryOffEligibility?.canEarn ?? false}
            onChange={(v) => setNested('compensatoryOffEligibility', 'canEarn', v)}
            label="Can Earn Comp Off"
          />
          {policy.compensatoryOffEligibility?.canEarn && (
            <Input
              label="Validity (days)"
              type="number"
              min={1}
              value={policy.compensatoryOffEligibility?.validityDays ?? 60}
              onChange={(e) => setNested('compensatoryOffEligibility', 'validityDays', parseInt(e.target.value))}
              className="w-36"
            />
          )}
        </div>
      </div>

      {/* Encashment */}
      <div className="p-4 bg-muted/20 rounded-xl border border-border space-y-3">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Encashment</p>
        <div className="flex flex-wrap items-center gap-4">
          <TogglePill
            value={policy.encashmentRule?.canEncash ?? false}
            onChange={(v) => setNested('encashmentRule', 'canEncash', v)}
            label="Can Encash"
          />
          {policy.encashmentRule?.canEncash && (
            <>
              <Input
                label="Max Encashable Days"
                type="number"
                min={1}
                value={policy.encashmentRule?.maxEncashableDays ?? 10}
                onChange={(e) => setNested('encashmentRule', 'maxEncashableDays', parseInt(e.target.value))}
                className="w-40"
              />
              <Input
                label="Rate (%)"
                type="number"
                min={1}
                max={100}
                value={policy.encashmentRule?.encashmentRatePercentage ?? 100}
                onChange={(e) => setNested('encashmentRule', 'encashmentRatePercentage', parseInt(e.target.value))}
                className="w-32"
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Page ───────────────────────────────────────────────────────────────
export const LeavePolicyPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { addToast } = useNotificationStore();
  const { hasPermission, isLoading: permsLoading } = usePermission();
  const [activeTab, setActiveTab] = useState<'POLICIES' | 'HOLIDAYS'>('POLICIES');


  // ── Policy state ──────────────────────────────────────────────────────────
  const [policyModal, setPolicyModal] = useState<{ open: boolean; policy: Partial<LeavePolicy> | null; isNew: boolean }>({
    open: false,
    policy: null,
    isNew: false,
  });

  const { data: policies = [], isLoading: policiesLoading } = useQuery({
    queryKey: ['leave-policies'],
    queryFn: leavePolicyApi.getAll,
  });

  const createPolicyMutation = useMutation({
    mutationFn: (data: Partial<LeavePolicy>) => leavePolicyApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-policies'] });
      addToast('Policy Created', 'Leave policy created successfully.', 'success');
      setPolicyModal({ open: false, policy: null, isNew: false });
    },
    onError: (err: any) => addToast('Error', err.response?.data?.message || 'Failed to create policy.', 'error'),
  });

  const updatePolicyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<LeavePolicy> }) => leavePolicyApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leave-policies'] });
      addToast('Policy Updated', 'Leave policy updated successfully.', 'success');
      setPolicyModal({ open: false, policy: null, isNew: false });
    },
    onError: (err: any) => addToast('Error', err.response?.data?.message || 'Failed to update policy.', 'error'),
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => leavePolicyApi.toggleStatus(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['leave-policies'] }),
    onError: (err: any) => addToast('Error', err.response?.data?.message || 'Failed to toggle policy.', 'error'),
  });

  const handleSavePolicy = () => {
    if (!policyModal.policy) return;
    if (policyModal.isNew) {
      createPolicyMutation.mutate(policyModal.policy);
    } else {
      updatePolicyMutation.mutate({ id: (policyModal.policy as LeavePolicy)._id, data: policyModal.policy });
    }
  };

  // ── Holiday state ─────────────────────────────────────────────────────────
  const [holidayModal, setHolidayModal] = useState<{ open: boolean; holiday: Partial<Holiday> | null; isNew: boolean }>({
    open: false,
    holiday: null,
    isNew: false,
  });
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth());

  const { data: holidays = [], isLoading: holidaysLoading } = useQuery({
    queryKey: ['holidays', calendarYear],
    queryFn: () => holidayCalendarApi.getAll(calendarYear),
  });

  const createHolidayMutation = useMutation({
    mutationFn: (data: { name: string; date: string; isRestricted?: boolean }) =>
      holidayCalendarApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      addToast('Holiday Added', 'Holiday created successfully.', 'success');
      setHolidayModal({ open: false, holiday: null, isNew: false });
    },
    onError: (err: any) => addToast('Error', err.response?.data?.message || 'Failed to create holiday.', 'error'),
  });

  const updateHolidayMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Holiday> }) =>
      holidayCalendarApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      addToast('Holiday Updated', 'Holiday updated successfully.', 'success');
      setHolidayModal({ open: false, holiday: null, isNew: false });
    },
    onError: (err: any) => addToast('Error', err.response?.data?.message || 'Failed to update holiday.', 'error'),
  });

  const deleteHolidayMutation = useMutation({
    mutationFn: (id: string) => holidayCalendarApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      addToast('Holiday Deleted', 'Holiday removed.', 'success');
    },
    onError: (err: any) => addToast('Error', err.response?.data?.message || 'Failed to delete holiday.', 'error'),
  });

  // Google Calendar import states, query, and toggle mutation
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const { data: googleHolidays = [], isLoading: googleLoading } = useQuery({
    queryKey: ['google-holidays', calendarYear],
    queryFn: () => holidayCalendarApi.getGoogleHolidays(calendarYear),
    enabled: isImportModalOpen,
  });

  const toggleImportMutation = useMutation({
    mutationFn: async ({ holiday, shouldImport }: { holiday: any; shouldImport: boolean }) => {
      if (shouldImport) {
        return holidayCalendarApi.create({
          name: holiday.name,
          date: holiday.date,
          isRestricted: holiday.isRestricted,
        });
      } else {
        if (!holiday.databaseId) throw new Error('No database ID found to remove.');
        return holidayCalendarApi.delete(holiday.databaseId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['holidays'] });
      queryClient.invalidateQueries({ queryKey: ['google-holidays'] });
      addToast('Success', 'Organization holiday list updated.', 'success');
    },
    onError: (err: any) => addToast('Error', err.response?.data?.message || 'Action failed.', 'error'),
  });


  const handleSaveHoliday = () => {
    if (!holidayModal.holiday?.name || !holidayModal.holiday?.date) {
      addToast('Validation Error', 'Name and date are required.', 'error');
      return;
    }
    if (holidayModal.isNew) {
      createHolidayMutation.mutate({
        name: holidayModal.holiday.name!,
        date: holidayModal.holiday.date!,
        isRestricted: holidayModal.holiday.isRestricted ?? false,
      });
    } else {
      updateHolidayMutation.mutate({
        id: (holidayModal.holiday as Holiday)._id,
        data: { name: holidayModal.holiday.name, date: holidayModal.holiday.date, isRestricted: holidayModal.holiday.isRestricted },
      });
    }
  };

  // Calendar grid
  const calendarCells = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth, 1).getDay();
    const totalDays = new Date(calendarYear, calendarMonth + 1, 0).getDate();
    const cells: { dateStr: string; dayNum: number; isCurrentMonth: boolean }[] = [];

    const prevTotal = new Date(calendarYear, calendarMonth, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevTotal - i;
      const m = calendarMonth === 0 ? 11 : calendarMonth - 1;
      const y = calendarMonth === 0 ? calendarYear - 1 : calendarYear;
      cells.push({ dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dayNum: d, isCurrentMonth: false });
    }
    for (let d = 1; d <= totalDays; d++) {
      cells.push({ dateStr: `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, dayNum: d, isCurrentMonth: true });
    }
    const rem = 42 - cells.length;
    for (let i = 1; i <= rem; i++) {
      const m = calendarMonth === 11 ? 0 : calendarMonth + 1;
      const y = calendarMonth === 11 ? calendarYear + 1 : calendarYear;
      cells.push({ dateStr: `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`, dayNum: i, isCurrentMonth: false });
    }
    return cells;
  }, [calendarYear, calendarMonth]);

  const holidayMap = useMemo(() => {
    const map: Record<string, Holiday> = {};
    holidays.forEach((h) => { map[h.date] = h; });
    return map;
  }, [holidays]);

  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const handlePrevMonth = () => { if (calendarMonth === 0) { setCalendarYear(y => y - 1); setCalendarMonth(11); } else setCalendarMonth(m => m - 1); };
  const handleNextMonth = () => { if (calendarMonth === 11) { setCalendarYear(y => y + 1); setCalendarMonth(0); } else setCalendarMonth(m => m + 1); };

  if (permsLoading || policiesLoading || holidaysLoading) {
    return <SettingsSkeleton />;
  }

  if (!hasPermission('LEAVE_POLICY', 'view')) {
    return (
      <Card className="p-8 text-center border-dashed max-w-md mx-auto my-12 space-y-4">
        <Shield className="w-12 h-12 text-destructive mx-auto opacity-75 animate-bounce" />
        <h3 className="text-lg font-bold text-foreground">Access Denied</h3>
        <p className="text-xs text-muted-foreground">
          You do not have the required permissions to view or configure leave policies. Please contact your organization administrator.
        </p>
      </Card>
    );
  }

  // Missing leave types (not yet configured)

  const configuredTypes = new Set(policies.map((p) => p.leaveType));
  const missingTypes = ALL_LEAVE_TYPES.filter((t) => !configuredTypes.has(t));

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
                ? 'border-primary text-primary font-extrabold'
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

      {/* Tab Switch */}
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          {[
            { key: 'POLICIES', label: 'Policy Engine', icon: <Settings className="w-4 h-4" /> },
            { key: 'HOLIDAYS', label: 'Holiday Calendar', icon: <Calendar className="w-4 h-4" /> },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeTab === tab.key
                  ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>
        
        {activeTab === 'POLICIES' && missingTypes.length > 0 && hasPermission('LEAVE_POLICY', 'create') && (
          <Button
            onClick={() => setPolicyModal({ open: true, policy: { leaveType: missingTypes[0] as any, monthlyAllowance: 1, halfDayEnabled: true }, isNew: true })}
            className="bg-primary text-white font-bold shadow-md shadow-primary/20"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add Policy
          </Button>
        )}
        {activeTab === 'HOLIDAYS' && hasPermission('LEAVE_POLICY', 'create') && (
          <Button
            onClick={() => setHolidayModal({ open: true, holiday: { isRestricted: false }, isNew: true })}
            className="bg-primary text-white font-bold shadow-md shadow-primary/20"
          >
            <Plus className="w-4 h-4 mr-1.5" /> Add Holiday
          </Button>
        )}
      </div>

      {/* ── POLICIES TAB ── */}
      {activeTab === 'POLICIES' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {policiesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-64 rounded-2xl bg-muted/30 animate-pulse border border-border" />
              ))}
            </div>
          ) : policies.length === 0 ? (
            <Card className="p-12 text-center border-dashed">
              <Shield className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold text-muted-foreground">No leave policies configured yet.</p>
              <p className="text-xs text-muted-foreground mt-1">Click "Add Policy" to create your first leave type policy.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {policies.map((policy) => {
                const meta = LEAVE_TYPE_META[policy.leaveType] || { icon: <Shield className="w-4 h-4" />, color: 'text-primary' };
                return (
                  <Card
                    key={policy._id}
                    className={`p-5 space-y-4 border hover:shadow-lg transition-all duration-200 relative overflow-hidden ${!policy.isActive ? 'opacity-60' : ''}`}
                  >
                    {/* Top accent line */}
                    <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${policy.isActive ? 'bg-primary' : 'bg-muted-foreground'}`} />

                    {/* Header */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <span className={meta.color}>{meta.icon}</span>
                        <div>
                          <p className="font-black text-sm text-foreground">{policy.leaveType}</p>
                          <p className="text-[10px] text-muted-foreground font-mono">{policy.monthlyAllowance} {policy.leaveType === 'Permission' ? 'hrs' : 'days'}/month</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {hasPermission('LEAVE_POLICY', 'edit') && (
                          <button
                            onClick={() => setPolicyModal({ open: true, policy: { ...policy }, isNew: false })}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit policy"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {hasPermission('LEAVE_POLICY', 'edit') && (
                          <button
                            onClick={() => toggleMutation.mutate(policy._id)}
                            className={`p-1.5 rounded-lg transition-colors ${policy.isActive ? 'text-primary hover:bg-primary/10' : 'text-muted-foreground hover:bg-muted'}`}
                            title={policy.isActive ? 'Deactivate' : 'Activate'}
                          >
                            {policy.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                          </button>
                        )}
                      </div>

                    </div>

                    {/* Policy rules grid */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      {[
                        { label: 'Carry Forward', value: policy.carryForward ? `✓ (max ${policy.carryForwardLimit ?? '∞'} days)` : '✗ No' },
                        { label: 'Sandwich Rule', value: policy.sandwichLeaveRule ? '✓ Yes' : '✗ No' },
                        { label: 'Half-Day', value: policy.halfDayEnabled ? '✓ Enabled' : '✗ Disabled' },
                        { label: 'Perm Convert', value: policy.permissionAutoConvert ? '✓ Auto' : '✗ Manual' },
                        { label: 'Late Penalty', value: `After ${policy.latePenaltyCount} marks → 0.5d` },
                        { label: 'Advance Notice', value: policy.advanceNoticeDays > 0 ? `${policy.advanceNoticeDays} days` : 'None' },
                        { label: 'Max Consecutive', value: policy.maxConsecutiveDays > 0 ? `${policy.maxConsecutiveDays} days` : 'Unlimited' },
                        { label: 'Encashment', value: policy.encashmentRule?.canEncash ? `✓ ${policy.encashmentRule.maxEncashableDays}d` : '✗ No' },
                      ].map((item) => (
                        <div key={item.label} className="flex flex-col p-2 bg-muted/30 rounded-lg">
                          <span className="text-muted-foreground font-semibold">{item.label}</span>
                          <span className="text-foreground font-mono font-bold">{item.value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Status badge */}
                    <div className="flex justify-end">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                        policy.isActive
                          ? 'bg-primary/10 text-primary border-primary/20'
                          : 'bg-muted text-muted-foreground border-border'
                      }`}>
                        {policy.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── HOLIDAYS TAB ── */}
      {activeTab === 'HOLIDAYS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-in fade-in duration-200">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <Card className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h4 className="font-extrabold text-base text-foreground">
                  {monthNames[calendarMonth]} {calendarYear}
                </h4>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setCalendarYear((y) => y - 1)}
                    className="text-xs font-bold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
                  >
                    {calendarYear - 1}
                  </button>
                  <Button variant="outline" size="sm" onClick={handlePrevMonth} className="h-8 w-8 p-0">
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleNextMonth} className="h-8 w-8 p-0">
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                  <button
                    onClick={() => setCalendarYear((y) => y + 1)}
                    className="text-xs font-bold text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg hover:bg-muted transition-colors"
                  >
                    {calendarYear + 1}
                  </button>
                </div>
              </div>

              {/* Day headers */}
              <div className="grid grid-cols-7 text-center text-xs font-bold text-muted-foreground border-b border-border pb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>

              {/* Grid */}
              <div className="grid grid-cols-7 gap-1">
                {calendarCells.map((cell, idx) => {
                  const holiday = holidayMap[cell.dateStr];
                  return (
                    <div
                      key={idx}
                      className={`h-12 flex flex-col items-center justify-between p-1 rounded-xl text-xs transition-all ${
                        cell.isCurrentMonth
                          ? holiday
                            ? 'bg-primary/10 border border-primary/30 text-primary font-bold cursor-pointer hover:bg-primary/20'
                            : 'border border-border text-foreground font-semibold bg-background hover:bg-muted/40 cursor-pointer'
                          : 'text-muted-foreground/30 border-transparent pointer-events-none'
                      }`}
                      onClick={() => {
                        if (!cell.isCurrentMonth) return;
                        if (holiday) {
                          if (!hasPermission('LEAVE_POLICY', 'edit')) return;
                          setHolidayModal({ open: true, holiday: { ...holiday }, isNew: false });
                        } else {
                          if (!hasPermission('LEAVE_POLICY', 'create')) return;
                          setHolidayModal({ open: true, holiday: { date: cell.dateStr, isRestricted: false }, isNew: true });
                        }
                      }}

                      title={holiday?.name}
                    >
                      <span className="self-start pl-0.5">{cell.dayNum}</span>
                      {holiday && (
                        <span className="text-[9px] font-bold text-primary truncate w-full text-center px-0.5">
                          {holiday.name.length > 6 ? holiday.name.substring(0, 5) + '…' : holiday.name}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>

          {/* Holiday List */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-primary" />
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground">
                  Holidays in {calendarYear}
                </h3>
              </div>
              {hasPermission('LEAVE_POLICY', 'create') && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsImportModalOpen(true)}
                  className="h-8 text-xs font-bold flex items-center gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                >
                  <Globe className="w-3.5 h-3.5 animate-pulse" />
                  Import Holidays
                </Button>
              )}
            </div>

            {holidaysLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 rounded-xl bg-muted/30 animate-pulse border border-border" />)}
              </div>
            ) : holidays.length === 0 ? (
              <Card className="p-6 text-center border-dashed">
                <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
                <p className="text-xs text-muted-foreground">No holidays defined for {calendarYear}.</p>
                <p className="text-[10px] text-muted-foreground mt-1">Click any date on the calendar to add.</p>
              </Card>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                {holidays
                  .slice()
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((h) => (
                    <div
                      key={h._id}
                      className="flex items-center justify-between p-3 bg-card border border-border rounded-xl hover:shadow-sm transition-all"
                    >
                      <div>
                        <p className="font-bold text-xs text-foreground">{h.name}</p>
                        <p className="text-[10px] font-mono text-muted-foreground">{h.date}</p>
                        {h.isRestricted && (
                          <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-1.5 py-0.5 rounded-md">
                            RESTRICTED
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {hasPermission('LEAVE_POLICY', 'edit') && (
                          <button
                            onClick={() => setHolidayModal({ open: true, holiday: { ...h }, isNew: false })}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        )}
                        {hasPermission('LEAVE_POLICY', 'delete') && (
                          <button
                            onClick={() => deleteHolidayMutation.mutate(h._id)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-900/20 text-muted-foreground hover:text-rose-600 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* ── Policy Modal ────────────────────────────────────────────────────── */}
      <Modal
        isOpen={policyModal.open}
        onClose={() => setPolicyModal({ open: false, policy: null, isNew: false })}
        title={policyModal.isNew ? 'Add Leave Policy' : `Edit ${policyModal.policy?.leaveType} Policy`}
        maxWidth="max-w-2xl"
      >
        {policyModal.open && policyModal.policy && (
          <div className="space-y-4">
            {policyModal.isNew && (
              <Select
                label="Leave Type *"
                value={policyModal.policy.leaveType ?? ''}
                onChange={(e) => setPolicyModal((prev) => ({ ...prev, policy: { ...prev.policy, leaveType: e.target.value as any } }))}
                options={missingTypes.map((t) => ({ value: t, label: t }))}
              />
            )}
            <PolicyForm
              policy={policyModal.policy}
              onChange={(updated) => setPolicyModal((prev) => ({ ...prev, policy: updated }))}
            />
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setPolicyModal({ open: false, policy: null, isNew: false })}>
                Cancel
              </Button>
              <Button
                onClick={handleSavePolicy}
                isLoading={createPolicyMutation.isPending || updatePolicyMutation.isPending}
              >
                {policyModal.isNew ? 'Create Policy' : 'Save Changes'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Holiday Modal ────────────────────────────────────────────────────── */}
      <Modal
        isOpen={holidayModal.open}
        onClose={() => setHolidayModal({ open: false, holiday: null, isNew: false })}
        title={holidayModal.isNew ? 'Add Holiday' : 'Edit Holiday'}
        maxWidth="max-w-md"
      >
        {holidayModal.open && (
          <div className="space-y-4">
            <Input
              label="Holiday Name *"
              value={holidayModal.holiday?.name ?? ''}
              onChange={(e) => setHolidayModal((prev) => ({ ...prev, holiday: { ...prev.holiday, name: e.target.value } }))}
              placeholder="e.g. Republic Day, Diwali"
            />
            <Input
              label="Date *"
              type="date"
              value={holidayModal.holiday?.date ?? ''}
              onChange={(e) => setHolidayModal((prev) => ({ ...prev, holiday: { ...prev.holiday, date: e.target.value } }))}
            />
            <div className="flex items-center gap-3">
              <TogglePill
                value={holidayModal.holiday?.isRestricted ?? false}
                onChange={(v) => setHolidayModal((prev) => ({ ...prev, holiday: { ...prev.holiday, isRestricted: v } }))}
                label="Restricted Holiday"
              />
              <p className="text-xs text-muted-foreground">Restricted holidays count as leave if availed.</p>
            </div>
            <div className="flex justify-end gap-3 pt-4 border-t border-border">
              <Button variant="outline" onClick={() => setHolidayModal({ open: false, holiday: null, isNew: false })}>
                Cancel
              </Button>
              <Button
                onClick={handleSaveHoliday}
                isLoading={createHolidayMutation.isPending || updateHolidayMutation.isPending}
              >
                {holidayModal.isNew ? 'Add Holiday' : 'Save Changes'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Google Calendar Holidays Import Modal ────────────────────────────── */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title={`Import Indian Holidays (${calendarYear})`}
        maxWidth="max-w-xl"
      >
        <div className="space-y-4 text-left">
          <p className="text-xs text-muted-foreground">
            Select the holidays from Google Calendar that are mandatory/official for your organization. Selected holidays will appear on all employee dashboards.
          </p>

          {googleLoading ? (
            <div className="h-64 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-xs font-semibold text-muted-foreground">Fetching public holidays from Google Calendar...</p>
            </div>
          ) : googleHolidays.length === 0 ? (
            <div className="p-12 text-center border border-dashed rounded-2xl bg-muted/20">
              <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-30" />
              <p className="text-xs text-muted-foreground font-bold">No public holidays found for {calendarYear}.</p>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[400px] overflow-y-auto pr-1">
              {googleHolidays.map((gH, idx) => {
                const isMutating = toggleImportMutation.isPending && 
                  toggleImportMutation.variables?.holiday.date === gH.date;
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between p-3.5 border rounded-xl transition-all duration-200 ${
                      gH.isImported
                        ? 'bg-primary/5 border-primary/30 shadow-sm'
                        : 'bg-card border-border hover:border-muted-foreground/30 hover:bg-muted/10'
                    }`}
                  >
                    <div className="space-y-1">
                      <p className="font-bold text-xs text-foreground flex items-center gap-1.5">
                        {gH.name}
                        {gH.isRestricted && (
                          <span className="text-[8px] font-extrabold text-amber-600 bg-amber-500/10 border border-amber-500/20 px-1 py-0.5 rounded">
                            RESTRICTED
                          </span>
                        )}
                      </p>
                      <p className="text-[10px] font-mono text-muted-foreground font-bold">{gH.date}</p>
                    </div>

                    <button
                      disabled={isMutating}
                      onClick={() =>
                        toggleImportMutation.mutate({
                          holiday: gH,
                          shouldImport: !gH.isImported,
                        })
                      }
                      className={`h-8 px-3.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 ${
                        gH.isImported
                          ? 'bg-primary text-primary-foreground shadow-sm hover:bg-primary/95'
                          : 'bg-muted hover:bg-muted-foreground/10 text-foreground border border-border'
                      }`}
                    >
                      {isMutating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : gH.isImported ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          Mandatory
                        </>
                      ) : (
                        'Make Mandatory'
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-border">
            <Button onClick={() => setIsImportModalOpen(false)}>
              Close
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

