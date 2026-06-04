import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { employeeApi } from '../api_service/employeeApi';
import { analyticsApi } from '../api_service/analyticsApi';
import { leaveApi } from '../api_service/leaveApi';
import { wfhApi } from '../api_service/wfhApi';
import { permissionApi } from '../api_service/permissionApi';
import { taskApi } from '../api_service/taskApi';
import { attendanceApi } from '../api_service/attendanceApi';
import { documentApi } from '../api_service/documentApi';
import { departmentApi } from '../api_service/departmentApi';
import { designationApi } from '../api_service/designationApi';
import { axiosInstance } from '../api_service/axiosInstance';
import { useNotificationStore } from '../store/useNotificationStore';
import { useAuthStore } from '../store/useAuthStore';
import { ProfileSkeleton } from '../Components/WrapperComponents/Skeleton';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input, Select } from '../Components/WrapperComponents/Input';
import { Modal } from '../Components/WrapperComponents/Modal';
import { TableWrapper } from '../Components/WrapperComponents/TableWrapper';
import type { Attendance } from '../types';
import { formatDate, formatCurrency } from '../utils/formatters';
import { 
  User, Palmtree, FileText, CalendarCheck, ArrowLeft, PhoneCall, 
  Mail, Briefcase, MapPin, Building, DollarSign, Calendar, Wifi, Clock, Laptop,
  ChevronLeft, ChevronRight, CreditCard, FileDigit, FolderOpen, Download,
  History, Lock, Star, Award
} from 'lucide-react';

type TabType = 'PERSONAL' | 'PROFESSIONAL' | 'EMERGENCY' | 'BANK' | 'TAX' | 'DOCUMENTS' | 'LEAVE_WFH' | 'TASKS' | 'ATTENDANCE';

export const EmployeeDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addToast } = useNotificationStore();
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();

  const { data: orgSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: analyticsApi.getSettings,
    enabled: !!currentUser,
  });

  const toggleLoginApprovalMutation = useMutation({
    mutationFn: async (approved: boolean) => {
      return employeeApi.update(id || '', { isLoginApproved: approved });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      addToast('Status Updated', 'Login approval status updated successfully.', 'success');
    },
    onError: (err: any) => {
      addToast('Update Failed', err.response?.data?.message || err.message || 'Could not update login approval status.', 'error');
    },
  });

  const approveInternMutation = useMutation({
    mutationFn: async ({ rating, notes }: { rating: number; notes: string }) => {
      return employeeApi.approveIntern(id || '', rating, notes);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      addToast('Paid Conversion Approved', data.message || 'Intern has been successfully converted to paid phase.', 'success');
    },
    onError: (err: any) => {
      addToast('Approval Failed', err.response?.data?.message || err.message || 'Could not approve paid phase.', 'error');
    },
  });

  const allowedRoles = orgSettings?.loginApprovalRoles || ['ADMIN'];
  const canApproveLogin = currentUser?.role === 'ADMIN' || allowedRoles.includes(currentUser?.role || '');

  const [activeTab, setActiveTab] = useState<TabType>('PERSONAL');
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const [internRating, setInternRating] = useState(5);
  const [internNotes, setInternNotes] = useState('');

  const [showHistory, setShowHistory] = useState<{ [key: string]: boolean }>({});

  const [isEditingEmergency, setIsEditingEmergency] = useState(false);
  const [emergencyForm, setEmergencyForm] = useState({
    name: '',
    relationship: '',
    phone: '',
  });

  const [isEditingBank, setIsEditingBank] = useState(false);
  const [bankForm, setBankForm] = useState({
    bankName: '',
    accountName: '',
    accountNumber: '',
    ifscCode: '',
    branchName: '',
  });

  const [isEditingTax, setIsEditingTax] = useState(false);
  const [taxForm, setTaxForm] = useState({
    panNumber: '',
    taxRegime: '' as 'OLD' | 'NEW' | '',
  });

  const isAllowedToEdit = currentUser?.role === 'ADMIN' || currentUser?.role === 'HR' || currentUser?.role === 'MANAGER';

  const startEditingEmergency = () => {
    setEmergencyForm({
      name: employee?.emergencyContact?.name || '',
      relationship: employee?.emergencyContact?.relationship || '',
      phone: employee?.emergencyContact?.phone || '',
    });
    setIsEditingEmergency(true);
  };

  const startEditingBank = () => {
    setBankForm({
      bankName: employee?.bankDetails?.bankName || '',
      accountName: employee?.bankDetails?.accountName || '',
      accountNumber: employee?.bankDetails?.accountNumber || '',
      ifscCode: employee?.bankDetails?.ifscCode || '',
      branchName: employee?.bankDetails?.branchName || '',
    });
    setIsEditingBank(true);
  };

  const startEditingTax = () => {
    setTaxForm({
      panNumber: employee?.taxDetails?.panNumber || '',
      taxRegime: (employee?.taxDetails?.taxRegime || '') as 'OLD' | 'NEW' | '',
    });
    setIsEditingTax(true);
  };

  const updateDetailsMutation = useMutation({
    mutationFn: async (updatedFields: any) => {
      return employeeApi.update(id || '', updatedFields);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      addToast('Success', 'Details updated successfully.', 'success');
      setIsEditingEmergency(false);
      setIsEditingBank(false);
      setIsEditingTax(false);
    },
    onError: (err: any) => {
      addToast('Update Failed', err.response?.data?.message || err.message || 'Could not update details.', 'error');
    },
  });


  const { data: employee, isLoading: empLoading } = useQuery({
    queryKey: ['employee', id],
    queryFn: () => employeeApi.getById(id || ''),
    enabled: !!id,
  });

  // Convert Intern to Full-Time states & logic
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertForm, setConvertForm] = useState({
    userPrincipalName: '',
    displayName: '',
    givenName: '',
    surname: '',
    jobTitle: '',
    department: '',
    tempPassword: 'EthicSec@2026!',
    selectedLicenses: [] as string[],
    salary: 0,
    departmentId: '',
    designationId: '',
    employeeId: '',
    employeeHireDate: '',
    mobilePhone: '',
  });

  const { data: azureLicensesData } = useQuery({
    queryKey: ['azureLicenses'],
    queryFn: employeeApi.getAzureLicenses,
    enabled: !!employee && !!employee.isIntern && showConvertModal,
  });
  const azureLicenses = azureLicensesData?.licenses || [];
  const isAzureConfigured = azureLicensesData?.isAzureConfigured ?? false;

  const { data: departments = [] } = useQuery({
    queryKey: ['departments_convert'],
    queryFn: departmentApi.getAll,
    enabled: !!employee && !!employee.isIntern && showConvertModal,
  });

  const { data: designations = [] } = useQuery({
    queryKey: ['designations_convert'],
    queryFn: () => designationApi.getAll(),
    enabled: !!employee && !!employee.isIntern && showConvertModal,
  });

  const convertToFullTimeMutation = useMutation({
    mutationFn: async (data: any) => {
      return employeeApi.convertToFullTime(id || '', data);
    },
    onSuccess: (resData) => {
      queryClient.invalidateQueries({ queryKey: ['employee', id] });
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      addToast('Conversion Successful', resData.message || 'Intern has been converted to a full-time employee and registered in Azure AD.', 'success');
      setShowConvertModal(false);
    },
    onError: (err: any) => {
      addToast('Conversion Failed', err.response?.data?.message || err.message || 'Could not convert intern to full-time.', 'error');
    },
  });

  const startConversion = () => {
    if (!employee) return;
    const nameParts = employee.fullName.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    const suggestedUPN = `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}.${lastName.toLowerCase().replace(/[^a-z0-9]/g, '')}@ethicsecur.co.in`;

    setConvertForm({
      userPrincipalName: suggestedUPN,
      displayName: employee.fullName,
      givenName: firstName,
      surname: lastName,
      jobTitle: employee.designation,
      department: employee.department,
      tempPassword: 'EthicSec@2026!',
      selectedLicenses: [],
      salary: employee.salary || 0,
      departmentId: typeof employee.departmentId === 'object' && employee.departmentId !== null ? (employee.departmentId as any)._id : employee.departmentId || '',
      designationId: typeof employee.designationId === 'object' && employee.designationId !== null ? (employee.designationId as any)._id : employee.designationId || '',
      employeeId: employee.employeeCode && !employee.employeeCode.startsWith('TEMP-EMP-') ? employee.employeeCode : '',
      employeeHireDate: employee.joiningDate ? new Date(employee.joiningDate).toISOString().split('T')[0] : '',
      mobilePhone: employee.phone || '',
    });
    setShowConvertModal(true);
  };

  const { data: leaves, isLoading: leavesLoading } = useQuery({ queryKey: ['leaves'], queryFn: leaveApi.getAll });
  const { data: wfh, isLoading: wfhLoading } = useQuery({ queryKey: ['wfh'], queryFn: wfhApi.getAll });
  const { data: perms, isLoading: permsLoading } = useQuery({ queryKey: ['permissions'], queryFn: permissionApi.getAll });
  const { data: tasks, isLoading: tasksLoading } = useQuery({ queryKey: ['allTasks'], queryFn: taskApi.getAllReports });
  const { data: attendances, isLoading: attLoading } = useQuery({ queryKey: ['attendances'], queryFn: attendanceApi.getAll });
  
  const { data: documents, isLoading: docsLoading, refetch: refetchDocs } = useQuery({
    queryKey: ['employeeDocuments', id],
    queryFn: () => documentApi.getDocuments({ employeeId: id }),
    enabled: !!id,
  });

  if (empLoading || leavesLoading || wfhLoading || permsLoading || tasksLoading || attLoading || docsLoading) {
    return <ProfileSkeleton />;
  }

  if (!employee) {
    return (
      <Card className="p-12 text-center space-y-4">
        <h3 className="text-xl font-bold text-foreground">Employee Not Found</h3>
        <p className="text-xs text-muted-foreground">The requested employee record does not exist or has been removed.</p>
        <Button onClick={() => navigate('/employees')}>Back to Directory</Button>
      </Card>
    );
  }

  const employeeLeaves = leaves?.filter(l => {
    const empId = l.employeeId ? (typeof l.employeeId === 'object' ? l.employeeId._id : l.employeeId) : '';
    return empId === id;
  }) || [];

  const employeeWFH = wfh?.filter(w => {
    const empId = w.employeeId ? (typeof w.employeeId === 'object' ? w.employeeId._id : w.employeeId) : '';
    return empId === id;
  }) || [];

  const employeePerms = perms?.filter(p => {
    const empId = p.employeeId ? (typeof p.employeeId === 'object' ? p.employeeId._id : p.employeeId) : '';
    return empId === id;
  }) || [];

  const employeeTasks = tasks?.filter(t => {
    const empId = t.employeeId ? (typeof t.employeeId === 'object' ? t.employeeId._id : t.employeeId) : '';
    return empId === id;
  }) || [];

  const employeeAttendances = attendances?.filter(a => {
    const empId = a.employeeId ? (typeof a.employeeId === 'object' ? a.employeeId._id : a.employeeId) : '';
    return empId === id;
  }) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider border border-primary/20">Approved</span>;
      case 'REJECTED':
        return <span className="px-2.5 py-1 rounded-md bg-muted text-muted-foreground text-xs font-bold uppercase tracking-wider border border-border">Rejected</span>;
      default:
        return <span className="px-2.5 py-1 rounded-md bg-foreground/10 text-foreground text-xs font-bold uppercase tracking-wider border border-border">Pending</span>;
    }
  };

  // Calendar Helper Functions
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const calYear = currentMonth.getFullYear();
  const calMonth = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);

  const blanks = Array.from({ length: firstDay }, (_, i) => i);
  const calDays = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  const getEventsForDate = (dateStr: string) => {
    const events: Array<{ id: string; type: string; label: string; reason: string; status: string; subText?: string; colorClass: string }> = [];

    employeeLeaves.forEach(l => {
      if (dateStr >= l.startDate && dateStr <= l.endDate) {
        events.push({
          id: l._id,
          type: 'LEAVE',
          label: l.leaveType,
          reason: l.reason,
          status: l.status,
          colorClass: l.leaveType === 'Casual Leave' 
            ? 'bg-blue-500/20 border-blue-500/40 text-blue-700 dark:text-blue-300' 
            : 'bg-rose-500/20 border-rose-500/40 text-rose-700 dark:text-rose-300',
        });
      }
    });

    employeeWFH.forEach(w => {
      if (dateStr >= w.startDate && (w.endDate ? dateStr <= w.endDate : true)) {
        events.push({
          id: w._id,
          type: 'WFH',
          label: 'WFH Request',
          reason: w.reason,
          status: w.status,
          subText: `Tasks: ${w.expectedTasks}`,
          colorClass: 'bg-purple-500/20 border-purple-500/40 text-purple-700 dark:text-purple-300',
        });
      }
    });

    employeePerms.forEach(p => {
      if (p.date === dateStr) {
        events.push({
          id: p._id,
          type: 'PERMISSION',
          label: 'Permission Hours',
          reason: p.reason,
          status: p.approvalStatus,
          subText: `${p.startTime} - ${p.endTime} (${p.totalHours} hrs)`,
          colorClass: 'bg-amber-500/20 border-amber-500/40 text-amber-700 dark:text-amber-300',
        });
      }
    });

    employeeAttendances.forEach(att => {
      if (att.date === dateStr && att.status === 'LEAVE') {
        events.push({
          id: att._id,
          type: 'LEAVE',
          label: 'Casual Leave (Late)',
          reason: att.overrideReason || 'Late checkin',
          status: 'APPROVED',
          colorClass: 'bg-blue-500/20 border-blue-500/40 text-blue-700 dark:text-blue-300',
        });
      }
    });

    return events;
  };



  const taskColumns = [
    { header: 'Date', accessor: 'date', className: 'font-mono text-xs' },
    { header: 'Completed Tasks', accessor: 'completedTasks', className: 'font-medium text-xs text-primary' },
    { header: 'In Progress', accessor: 'inProgressTasks', className: 'text-xs text-muted-foreground font-medium' },
    { header: 'Pending Tasks', accessor: 'pendingTasks', className: 'text-xs text-muted-foreground' },
    { header: 'Blockers', accessor: 'blockers', className: 'text-xs text-destructive font-semibold' },
    { header: 'Tomorrow Plan', accessor: 'tomorrowPlan', className: 'text-xs italic' },
  ];

  const attendanceColumns = [
    { header: 'Date', accessor: (row: Attendance) => <span className="font-mono text-xs">{formatDate(row.date)}</span> },
    {
      header: 'Login Time',
      accessor: (row: Attendance) => <span className="font-mono text-xs">{new Date(row.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>,
    },
    {
      header: 'Logout Time',
      accessor: (row: Attendance) => (
        <span className="font-mono text-xs">
          {row.status === 'LEAVE' ? '-' : row.logoutTime ? new Date(row.logoutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'In Progress'}
        </span>
      ),
    },
    {
      header: 'Status / Type',
      accessor: (row: Attendance) => (
        <span className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider border ${
          row.status === 'OFFICE' ? 'bg-primary/10 text-primary border-primary/20' : 'bg-foreground/10 text-foreground border-border'
        }`}>
          {row.status}
        </span>
      ),
    },
    {
      header: 'IP / Network Info',
      accessor: (row: Attendance) => (
        <div className="text-xs">
          <span className="font-mono text-foreground flex items-center gap-1">
            <Wifi className={`w-3.5 h-3.5 ${row.locationVerified ? 'text-primary' : 'text-muted-foreground'}`} /> {row.ipAddress}
          </span>
          <span className="text-[10px] text-muted-foreground block mt-0.5">{row.deviceInfo}</span>
          {row.overrideReason && <span className="text-[10px] text-primary block italic">Override: {row.overrideReason}</span>}
        </div>
      ),
    },
    {
      header: 'Working Hours',
      accessor: (row: Attendance) => (
        <span className="text-xs font-mono font-bold text-primary">
          {row.status === 'LEAVE' ? '-' : row.workingHours ? `${row.workingHours} hrs` : 'Calculating...'}
        </span>
      ),
    },
  ];

  return (
    <div className="space-y-8 text-left animate-in fade-in duration-300 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => navigate('/employees')} className="rounded-xl">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back
          </Button>
          <div className="flex items-center gap-3">
            {employee.profileImage ? (
              <img src={employee.profileImage} alt="" className="w-12 h-12 rounded-xl object-cover border border-border flex-shrink-0" />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xl flex-shrink-0 uppercase">
                {employee.fullName.charAt(0)}
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-foreground tracking-tight">{employee.fullName}</h2>
              <p className="text-xs text-muted-foreground font-mono">
                {employee.employeeCode && !employee.employeeCode.startsWith('TEMP-EMP-') ? `${employee.employeeCode} | ` : ''}
                {employee.designation}
              </p>
            </div>
          </div>
        </div>
        <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
          {employee.department} Department
        </span>
      </div>

      {/* Horizontal Tabs Bar */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-card border border-border rounded-2xl shadow-sm w-full">
        {(['PERSONAL', 'PROFESSIONAL', 'EMERGENCY', 'BANK', 'TAX', 'DOCUMENTS', 'LEAVE_WFH', 'TASKS', 'ATTENDANCE'] as TabType[]).map((tab) => {
          let label = tab.charAt(0) + tab.slice(1).toLowerCase().replace('_', '/');
          let icon = <User className="w-4 h-4" />;
          
          if (tab === 'PROFESSIONAL') icon = <Briefcase className="w-4 h-4" />;
          if (tab === 'EMERGENCY') icon = <PhoneCall className="w-4 h-4" />;
          if (tab === 'BANK') icon = <CreditCard className="w-4 h-4" />;
          if (tab === 'TAX') icon = <FileDigit className="w-4 h-4" />;
          if (tab === 'DOCUMENTS') { label = 'Documents'; icon = <FolderOpen className="w-4 h-4" />; }
          if (tab === 'LEAVE_WFH') { label = 'Leaves/WFH'; icon = <Palmtree className="w-4 h-4" />; }
          if (tab === 'TASKS') { label = 'Tasks'; icon = <FileText className="w-4 h-4" />; }
          if (tab === 'ATTENDANCE') icon = <CalendarCheck className="w-4 h-4" />;

          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex-1 min-w-[120px] justify-center ${
                activeTab === tab ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {icon} {label}
            </button>
          );
        })}
      </div>

      {/* Tab Content Area */}
      <div className="w-full space-y-6">
        
        {/* TAB 1: PERSONAL DETAILS */}
        {activeTab === 'PERSONAL' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <Card className="space-y-6 border-l-4 border-l-primary shadow-md">
              <h3 className="text-lg font-bold text-foreground border-b border-border pb-3 flex items-center gap-2">
                <User className="w-5 h-5 text-primary" /> Personal Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                  <User className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Full Name</p>
                    <p className="font-semibold text-foreground">{employee.fullName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                  <Mail className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Email Address</p>
                    <p className="font-semibold text-foreground">{employee.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                  <PhoneCall className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Phone Number</p>
                    <p className="font-semibold text-foreground">{employee.phone}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                  <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Residential Address</p>
                    <p className="font-semibold text-foreground">{employee.address}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="space-y-6 border-l-4 border-l-primary shadow-md">
              <h3 className="text-lg font-bold text-foreground border-b border-border pb-3 flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" /> Login Access & Security Controls
              </h3>
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border">
                <div className="space-y-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
                    Account Login Clearance Status
                  </span>
                  <p className="text-xs text-muted-foreground font-medium">
                    {employee.isLoginApproved
                      ? 'Approved: This employee has active clearance to log in to the portal.'
                      : 'Pending: Login access is currently locked for this account.'}
                  </p>
                </div>
                {canApproveLogin ? (
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                      employee.isLoginApproved
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                    }`}>
                      {employee.isLoginApproved ? 'Login Approved' : 'Login Pending'}
                    </span>
                    <button
                      onClick={() => toggleLoginApprovalMutation.mutate(!employee.isLoginApproved)}
                      disabled={toggleLoginApprovalMutation.isPending}
                      className={`h-9 px-4 rounded-lg font-bold text-xs uppercase tracking-wider transition-all shadow-md cursor-pointer ${
                        employee.isLoginApproved
                          ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/10'
                          : 'bg-primary hover:bg-primary/95 text-white shadow-primary/10'
                      }`}
                    >
                      {toggleLoginApprovalMutation.isPending 
                        ? 'Updating...' 
                        : employee.isLoginApproved 
                          ? 'Revoke Access' 
                          : 'Grant Access'}
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted border border-border text-xs text-muted-foreground font-bold">
                    <Lock className="w-3.5 h-3.5 text-muted-foreground animate-pulse" />
                    <span>Role Restricted: Only Admin, HR, or Manager can configure login clearance.</span>
                  </div>
                )}
              </div>
            </Card>

            {employee.ssoData?.provider === 'MICROSOFT' && (
              <Card className="space-y-6 border-l-4 border-l-indigo-500 shadow-md">
                <h3 className="text-lg font-bold text-foreground border-b border-border pb-3 flex items-center gap-2">
                  <Building className="w-5 h-5 text-indigo-500" /> Microsoft Entra / Azure AD Integration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
                    <Mail className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">Microsoft UPN (Work Email)</p>
                      <p className="font-semibold text-foreground font-mono">{employee.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
                    <User className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">SSO Identity Status</p>
                      <p className="font-semibold text-foreground">Linked to Azure Active Directory</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 col-span-2">
                    <Lock className="w-5 h-5 text-indigo-500 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-indigo-500 font-bold uppercase tracking-wider">Authentication Control</p>
                      <p className="font-semibold text-foreground">Microsoft Single Sign-On (SSO)</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">Local password database sign-in has been removed. This account requires secure identity assertion through the corporate Microsoft portal.</p>
                    </div>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {/* TAB 2: PROFESSIONAL DETAILS */}
        {activeTab === 'PROFESSIONAL' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <Card className="space-y-6 border-l-4 border-l-primary shadow-md">
              <h3 className="text-lg font-bold text-foreground border-b border-border pb-3 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" /> Professional Details
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                  <Briefcase className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Employee Code</p>
                    <p className="font-semibold text-foreground font-mono">
                      {employee.employeeCode && !employee.employeeCode.startsWith('TEMP-EMP-') ? employee.employeeCode : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                  <Building className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Department</p>
                    <p className="font-semibold text-foreground">{employee.department}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                  <Briefcase className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Designation</p>
                    <p className="font-semibold text-foreground">{employee.designation}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                  <Calendar className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Employee Hire Date</p>
                    <p className="font-semibold text-foreground">
                      {(() => {
                        if (!employee.joiningDate) return 'N/A';
                        try {
                          const d = new Date(employee.joiningDate);
                          const day = String(d.getDate()).padStart(2, '0');
                          const month = String(d.getMonth() + 1).padStart(2, '0');
                          const year = d.getFullYear();
                          return `${day}/${month}/${year}`;
                        } catch {
                          return employee.joiningDate;
                        }
                      })()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border col-span-2">
                  <DollarSign className="w-5 h-5 text-primary flex-shrink-0" />
                  <div>
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Monthly Base Salary</p>
                    <p className="font-mono font-bold text-primary text-lg">{formatCurrency(employee.salary)}</p>
                  </div>
                </div>
              </div>
            </Card>

            {employee.isIntern && (
              <Card className="space-y-6 border-l-4 border-l-amber-500 shadow-md">
                <h3 className="text-lg font-bold text-foreground border-b border-border pb-3 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" /> Internship & Performance Evaluation
                </h3>
                
                {/* Stats / Details */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Current Phase</p>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider mt-1.5 border ${
                      employee.internshipStatus === 'PAID'
                        ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                        : employee.internshipStatus === 'COMPLETED'
                        ? 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                        : employee.internshipStatus === 'TERMINATED'
                        ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                        : 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                    }`}>
                      {employee.internshipStatus || 'UNPAID'} Phase
                    </span>
                  </div>

                  <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Internship Duration</p>
                    <p className="font-semibold text-foreground mt-1.5 text-sm">
                      {employee.internshipDurationMonths || 6} Months Total
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      ({employee.internshipUnpaidMonths || 3}m unpaid, {employee.internshipPaidMonths || 3}m paid)
                    </p>
                  </div>

                  <div className="p-3.5 rounded-xl bg-muted/40 border border-border">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Post-Review Stipend</p>
                    <p className="font-semibold text-primary mt-1.5 text-sm font-mono">
                      {formatCurrency(employee.salary)} / mo
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      Applicable in Paid Phase
                    </p>
                  </div>
                </div>

                {/* Review Gate & Evaluation */}
                {employee.internshipPerformanceApproved ? (
                  <div className="space-y-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 text-left">
                    <div className="flex items-center justify-between border-b border-emerald-500/10 pb-2">
                      <span className="text-xs font-bold text-emerald-500 uppercase tracking-wider flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                        Performance Review Approved
                      </span>
                      <div className="flex items-center gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <Star 
                            key={i} 
                            className={`w-4 h-4 ${
                              i < (employee.internshipPerformanceRating || 0)
                                ? 'text-amber-500 fill-amber-500'
                                : 'text-muted border-none'
                            }`} 
                          />
                        ))}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Evaluation Comments</p>
                      <p className="text-xs text-foreground italic leading-relaxed bg-muted/30 p-3 rounded-lg border border-border">
                        "{employee.internshipPerformanceReviewNotes || 'No notes provided.'}"
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">
                      Status has been converted to the <strong>Paid Phase</strong> of the internship.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {currentUser?.role === 'ADMIN' || currentUser?.role === 'HR' ? (
                      <div className="space-y-4 p-5 rounded-xl bg-muted/30 border border-border text-left">
                        <div>
                          <h4 className="text-sm font-bold text-foreground tracking-tight">Evaluate Performance & Approve Paid Phase</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Conduct review to unlock the paid phase and stipend of {formatCurrency(employee.salary)}/mo.
                          </p>
                        </div>

                        {/* Star Rating */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
                            Performance Rating ({internRating} / 5 Stars)
                          </label>
                          <div className="flex items-center gap-2">
                            {Array.from({ length: 5 }).map((_, i) => {
                              const ratingVal = i + 1;
                              return (
                                <button
                                  type="button"
                                  key={i}
                                  onClick={() => setInternRating(ratingVal)}
                                  className="p-1 rounded-md hover:bg-muted transition-all cursor-pointer"
                                >
                                  <Star 
                                    className={`w-6 h-6 transition-all ${
                                      ratingVal <= internRating
                                        ? 'text-amber-500 fill-amber-500 scale-110'
                                        : 'text-muted-foreground/40 hover:text-amber-500/80'
                                    }`} 
                                  />
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Textarea Notes */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider block">
                            Performance Review & Feedback Notes
                          </label>
                          <textarea
                            value={internNotes}
                            onChange={(e) => setInternNotes(e.target.value)}
                            placeholder="Enter detailed feedback regarding the intern's contributions, performance, and behavior..."
                            className="w-full min-h-[100px] p-3 rounded-xl border border-border bg-background text-foreground text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors disabled:opacity-50"
                          />
                        </div>

                        {/* Submit Button */}
                        <div className="flex justify-end pt-2">
                          <Button
                            onClick={() => approveInternMutation.mutate({ rating: internRating, notes: internNotes })}
                            isLoading={approveInternMutation.isPending}
                            className="rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/10"
                          >
                            Approve Paid Phase Conversion
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-center gap-3">
                        <Star className="w-5 h-5 text-amber-500 animate-pulse flex-shrink-0" />
                        <div>
                          <p className="text-xs font-bold text-foreground">Awaiting Performance Evaluation</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            This intern is currently in the unpaid phase of their internship. Converting to the paid phase requires a performance evaluation and approval by an Admin or HR.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Convert to Full-Time Button */}
                {(currentUser?.role === 'ADMIN' || currentUser?.role === 'HR') && (
                  <div className="pt-4 border-t border-border flex justify-end">
                    <Button
                      onClick={startConversion}
                      className="rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-md bg-primary hover:bg-primary/95 text-white"
                    >
                      💼 Convert to Full-Time Employee (Azure)
                    </Button>
                  </div>
                )}
              </Card>
            )}
          </div>
        )}

        {/* TAB 3: EMERGENCY CONTACTS */}
        {activeTab === 'EMERGENCY' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <Card className="space-y-4 border-l-4 border-l-destructive shadow-md">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <PhoneCall className="w-5 h-5 text-destructive" /> Emergency Contacts
                </h3>
                {isAllowedToEdit && !isEditingEmergency && (
                  <Button size="sm" variant="outline" onClick={startEditingEmergency}>
                    Edit Details
                  </Button>
                )}
              </div>
              
              {isEditingEmergency ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Input
                      label="Contact Name *"
                      value={emergencyForm.name}
                      onChange={(e) => setEmergencyForm({ ...emergencyForm, name: e.target.value })}
                    />
                    <Input
                      label="Relationship *"
                      value={emergencyForm.relationship}
                      onChange={(e) => setEmergencyForm({ ...emergencyForm, relationship: e.target.value })}
                    />
                    <Input
                      label="Phone Number *"
                      value={emergencyForm.phone}
                      onChange={(e) => setEmergencyForm({ ...emergencyForm, phone: e.target.value })}
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setIsEditingEmergency(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      isLoading={updateDetailsMutation.isPending}
                      onClick={() =>
                        updateDetailsMutation.mutate({
                          emergencyContact: {
                            name: emergencyForm.name,
                            relationship: emergencyForm.relationship,
                            phone: emergencyForm.phone,
                          },
                        })
                      }
                    >
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                    <p className="text-[10px] text-destructive font-bold uppercase tracking-wider">Contact Name</p>
                    <p className="font-bold text-foreground mt-0.5">{employee.emergencyContact?.name || 'Not Set'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                    <p className="text-[10px] text-destructive font-bold uppercase tracking-wider">Relationship</p>
                    <p className="font-bold text-foreground mt-0.5">{employee.emergencyContact?.relationship || 'Not Set'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-destructive/5 border border-destructive/20">
                    <p className="text-[10px] text-destructive font-bold uppercase tracking-wider">Phone Number</p>
                    <p className="font-mono font-bold text-foreground mt-0.5">{employee.emergencyContact?.phone || 'Not Set'}</p>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 4: BANK DETAILS */}
        {activeTab === 'BANK' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <Card className="space-y-6 border-l-4 border-l-primary shadow-md">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-primary" /> Bank Details
                </h3>
                {isAllowedToEdit && !isEditingBank && (
                  <Button size="sm" variant="outline" onClick={startEditingBank}>
                    Edit Details
                  </Button>
                )}
              </div>
              
              {isEditingBank ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="Bank Name"
                      value={bankForm.bankName}
                      onChange={(e) => setBankForm({ ...bankForm, bankName: e.target.value })}
                    />
                    <Input
                      label="Account Holder Name"
                      value={bankForm.accountName}
                      onChange={(e) => setBankForm({ ...bankForm, accountName: e.target.value })}
                    />
                    <Input
                      label="Account Number"
                      value={bankForm.accountNumber}
                      onChange={(e) => setBankForm({ ...bankForm, accountNumber: e.target.value })}
                    />
                    <Input
                      label="IFSC Code"
                      value={bankForm.ifscCode}
                      onChange={(e) => setBankForm({ ...bankForm, ifscCode: e.target.value })}
                    />
                    <div className="md:col-span-2">
                      <Input
                        label="Branch Name"
                        value={bankForm.branchName}
                        onChange={(e) => setBankForm({ ...bankForm, branchName: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setIsEditingBank(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      isLoading={updateDetailsMutation.isPending}
                      onClick={() =>
                        updateDetailsMutation.mutate({
                          bankDetails: {
                            bankName: bankForm.bankName,
                            accountName: bankForm.accountName,
                            accountNumber: bankForm.accountNumber,
                            ifscCode: bankForm.ifscCode,
                            branchName: bankForm.branchName,
                          },
                        })
                      }
                    >
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                    <Building className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Bank Name</p>
                      <p className="font-semibold text-foreground">{employee.bankDetails?.bankName || 'Not Provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                    <User className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Account Holder Name</p>
                      <p className="font-semibold text-foreground">{employee.bankDetails?.accountName || 'Not Provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                    <CreditCard className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Account Number</p>
                      <p className="font-semibold text-foreground font-mono">{employee.bankDetails?.accountNumber || 'Not Provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                    <FileText className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">IFSC Code</p>
                      <p className="font-semibold text-foreground font-mono uppercase">{employee.bankDetails?.ifscCode || 'Not Provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border md:col-span-2">
                    <MapPin className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Branch Name</p>
                      <p className="font-semibold text-foreground">{employee.bankDetails?.branchName || 'Not Provided'}</p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 5: TAX DETAILS */}
        {activeTab === 'TAX' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <Card className="space-y-6 border-l-4 border-l-primary shadow-md">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                  <FileDigit className="w-5 h-5 text-primary" /> Tax Details
                </h3>
                {isAllowedToEdit && !isEditingTax && (
                  <Button size="sm" variant="outline" onClick={startEditingTax}>
                    Edit Details
                  </Button>
                )}
              </div>
              
              {isEditingTax ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Input
                      label="PAN Card Number"
                      value={taxForm.panNumber}
                      onChange={(e) => setTaxForm({ ...taxForm, panNumber: e.target.value })}
                    />
                    <div className="space-y-1 text-left">
                      <label className="text-sm font-medium text-foreground mb-1.5 block">Income Tax Regime</label>
                      <select
                        value={taxForm.taxRegime}
                        onChange={(e) => setTaxForm({ ...taxForm, taxRegime: e.target.value as any })}
                        className="w-full h-10 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors disabled:opacity-50"
                      >
                        <option value="">Select Regime </option>
                        <option value="NEW">New Tax Regime</option>
                        <option value="OLD">Old Tax Regime</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={() => setIsEditingTax(false)}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      isLoading={updateDetailsMutation.isPending}
                      onClick={() =>
                        updateDetailsMutation.mutate({
                          taxDetails: {
                            panNumber: taxForm.panNumber,
                            taxRegime: taxForm.taxRegime,
                          },
                        })
                      }
                    >
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                    <FileDigit className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">PAN Card Number</p>
                      <p className="font-semibold text-foreground font-mono uppercase">{employee.taxDetails?.panNumber || 'Not Provided'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                    <Calendar className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Income Tax Regime</p>
                      <p className="font-semibold text-foreground uppercase">{employee.taxDetails?.taxRegime || 'Not Decided'}</p>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* TAB 6: DOCUMENTS (S3 Repository View) */}
        {activeTab === 'DOCUMENTS' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Document Listing */}
            <Card className="p-6 border border-border shadow-md space-y-6 bg-card">
              <div>
                <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                  <FolderOpen className="w-5 h-5 text-primary" /> Document Repository
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">Secure, tenant-isolated document repository hosted on AWS S3.</p>
              </div>

              <div className="space-y-4">
                {documents && documents.length > 0 ? (
                  documents.map((doc) => (
                    <div key={doc._id} className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div>
                          <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                            {doc.name}
                            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold border border-primary/20">
                              {doc.category}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-foreground/10 text-foreground text-[10px] font-bold border border-border">
                              Version {doc.version}
                            </span>
                          </h4>
                          <p className="text-[10px] text-muted-foreground font-medium mt-1">
                            Uploaded at {new Date(doc.createdAt).toLocaleString()}
                          </p>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto justify-end">
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-bold transition-all text-muted-foreground hover:text-foreground"
                          >
                            <Download className="w-3.5 h-3.5" /> Download
                          </a>

                          <button
                            onClick={() => setShowHistory(prev => ({ ...prev, [doc._id]: !prev[doc._id] }))}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border hover:bg-muted text-xs font-bold transition-all text-muted-foreground hover:text-foreground"
                          >
                            <History className="w-3.5 h-3.5" /> History ({doc.versions?.length || 1})
                          </button>
                        </div>
                      </div>

                      {/* Versions History Dropdown */}
                      {showHistory[doc._id] && (
                        <div className="mt-3 pt-3 border-t border-border/50 pl-4 space-y-2 animate-in slide-in-from-top-2 duration-200">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Version History</p>
                          <div className="space-y-1.5">
                            {doc.versions && doc.versions.map((ver, vIdx) => (
                              <div key={vIdx} className="flex justify-between items-center bg-background border border-border p-2 rounded-lg text-xs font-mono">
                                <span>
                                  Version {ver.version} <span className="text-muted-foreground text-[10px] font-normal ml-2">({new Date(ver.uploadedAt).toLocaleString()})</span>
                                </span>
                                <a
                                  href={ver.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary hover:underline flex items-center gap-1 text-[10px] font-bold"
                                >
                                  <Download className="w-3 h-3" /> Get
                                </a>
                              </div>
                            ))}
                            {(!doc.versions || doc.versions.length === 0) && (
                              <div className="flex justify-between items-center bg-background border border-border p-2 rounded-lg text-xs font-mono">
                                <span>
                                  Version 1 <span className="text-muted-foreground text-[10px] font-normal ml-2">({new Date(doc.createdAt).toLocaleString()})</span>
                                </span>
                                <a
                                  href={doc.fileUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-primary hover:underline flex items-center gap-1 text-[10px] font-bold"
                                >
                                  <Download className="w-3 h-3" /> Get
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-center py-12 border border-dashed border-border rounded-2xl bg-muted/10">
                    <FolderOpen className="w-12 h-12 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-muted-foreground">No documents uploaded</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">Tenant-isolated documents secure repository.</p>
                  </div>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 7: LEAVE / WFH / PERMISSIONS WITH CALENDAR */}
        {activeTab === 'LEAVE_WFH' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Balance Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="p-6 bg-gradient-to-br from-card to-primary/5 border border-primary/20 shadow-sm flex items-center gap-4">
                <div className="p-3.5 rounded-2xl bg-primary/10 text-primary border border-primary/20 flex-shrink-0">
                  <Palmtree className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Casual/Sick Leaves</p>
                  <h4 className="text-2xl font-black text-foreground mt-0.5">{employee.leaveBalance || 0} <span className="text-xs font-normal text-muted-foreground">remaining</span></h4>
                </div>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-card to-foreground/5 border border-border shadow-sm flex items-center gap-4">
                <div className="p-3.5 rounded-2xl bg-foreground/10 text-foreground border border-border flex-shrink-0">
                  <Laptop className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Monthly WFH Allowance</p>
                  <h4 className="text-2xl font-black text-foreground mt-0.5">{employee.wfhBalance !== undefined ? employee.wfhBalance : 1} <span className="text-xs font-normal text-muted-foreground">remaining</span></h4>
                </div>
              </Card>

              <Card className="p-6 bg-gradient-to-br from-card to-muted-foreground/5 border border-border shadow-sm flex items-center gap-4">
                <div className="p-3.5 rounded-2xl bg-muted text-muted-foreground border border-border flex-shrink-0">
                  <Clock className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">Permission Hours</p>
                  <h4 className="text-2xl font-black text-foreground mt-0.5">{employee.permissionHoursBalance !== undefined ? employee.permissionHoursBalance : 3} <span className="text-xs font-normal text-muted-foreground">hrs remaining</span></h4>
                </div>
              </Card>
            </div>

            {/* Interactive Calendar View */}
            <Card className="space-y-6 border-l-4 border-l-primary shadow-md">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                  <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-primary" /> Interactive Leave & WFH Calendar
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Hover over marked dates to view request details, reasons, and approval status</p>
                </div>
                <div className="flex items-center gap-3 self-end sm:self-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMonth(new Date(calYear, calMonth - 1, 1))}
                    className="rounded-xl px-3"
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                  </Button>
                  <span className="font-bold text-sm min-w-[120px] text-center font-mono">
                    {currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentMonth(new Date(calYear, calMonth + 1, 1))}
                    className="rounded-xl px-3"
                  >
                    Next <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              </div>

              {/* Color Legend */}
              <div className="flex flex-wrap items-center gap-4 text-xs font-semibold px-2">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500/20 border border-blue-500"></span> Casual Leave</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-500/20 border border-rose-500"></span> Sick Leave</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-purple-500/20 border border-purple-500"></span> WFH Request</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500"></span> Permission Hours</span>
              </div>

              {/* Calendar Grid */}
              <div className="grid grid-cols-7 gap-2 pt-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
                  <div key={d} className="text-center font-bold text-xs py-2 bg-muted/50 rounded-xl border border-border text-muted-foreground">
                    {d}
                  </div>
                ))}
                {blanks.map((b) => (
                  <div key={`blank-${b}`} className="min-h-[100px] p-2 bg-muted/10 rounded-xl border border-dashed border-border/50" />
                ))}
                {calDays.map((day) => {
                  const mStr = String(calMonth + 1).padStart(2, '0');
                  const dStr = String(day).padStart(2, '0');
                  const dateStr = `${calYear}-${mStr}-${dStr}`;
                  const events = getEventsForDate(dateStr);

                  return (
                    <div
                      key={day}
                      className="min-h-[100px] p-2 border border-border bg-card rounded-xl shadow-sm flex flex-col justify-between group relative transition-all hover:border-primary hover:shadow-md"
                    >
                      <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground">{day}</span>
                      <div className="flex flex-col gap-1 mt-1 overflow-y-auto max-h-[70px]">
                        {events.map((ev, idx) => (
                          <div
                            key={idx}
                            className={`relative group/event px-2 py-1 rounded-lg border text-[10px] font-bold tracking-tight truncate cursor-pointer transition-transform hover:scale-105 ${ev.colorClass}`}
                          >
                            {ev.label}

                            {/* Hover Tooltip Popup */}
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/event:flex flex-col gap-1.5 p-3 rounded-xl bg-popover text-popover-foreground border border-border shadow-2xl z-50 w-60 text-left animate-in fade-in zoom-in-95 duration-200 pointer-events-none">
                              <div className="flex items-center justify-between border-b border-border pb-1 mb-0.5">
                                <span className="font-bold text-xs">{ev.label}</span>
                                <span className={`text-[9px] px-1.5 py-0.5 rounded font-black uppercase tracking-wider ${
                                  ev.status === 'APPROVED' ? 'bg-primary/20 text-primary' : ev.status === 'REJECTED' ? 'bg-destructive/20 text-destructive' : 'bg-muted text-muted-foreground'
                                }`}>{ev.status}</span>
                              </div>
                              <p className="text-xs italic font-medium whitespace-normal leading-tight">"{ev.reason}"</p>
                              {ev.subText && <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{ev.subText}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>

            {/* List View Backup */}
            <Card className="space-y-4 border border-border shadow-sm p-4">
              <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Clock className="w-4 h-4 text-muted-foreground" /> All Requests List View
              </h4>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {employeeLeaves.map((item) => (
                  <div key={item._id} className="p-3 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase tracking-wider">{item.leaveType}</span>
                        <span className="text-xs font-mono text-muted-foreground">{formatDate(item.startDate)} to {formatDate(item.endDate)} ({item.totalDays} days)</span>
                      </div>
                      <p className="text-xs text-foreground mt-1 italic font-medium">"{item.reason}"</p>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>
                ))}

                {employeeWFH.map((item) => (
                  <div key={item._id} className="p-3 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-purple-500/10 text-purple-500 text-[10px] font-bold uppercase tracking-wider">WFH Request</span>
                        <span className="text-xs font-mono text-muted-foreground">{formatDate(item.startDate)}</span>
                      </div>
                      <p className="text-xs text-foreground mt-1 italic font-medium">Reason: "{item.reason}"</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Tasks: {item.expectedTasks}</p>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>
                ))}

                {employeePerms.map((item) => (
                  <div key={item._id} className="p-3 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-border text-[10px] font-bold uppercase tracking-wider">Permission Hours</span>
                        <span className="text-xs font-mono text-muted-foreground">{formatDate(item.date)} ({item.startTime} to {item.endTime} - {item.totalHours} hrs)</span>
                      </div>
                      <p className="text-xs text-foreground mt-1 italic font-medium">"{item.reason}"</p>
                    </div>
                    {getStatusBadge(item.approvalStatus)}
                  </div>
                ))}

                {employeeAttendances.filter(att => att.status === 'LEAVE').map((item) => (
                  <div key={item._id} className="p-3 rounded-xl border border-border bg-muted/20 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-blue-500/10 text-blue-500 text-[10px] font-bold uppercase tracking-wider">Casual Leave (Late)</span>
                        <span className="text-xs font-mono text-muted-foreground">{formatDate(item.date)}</span>
                      </div>
                      <p className="text-xs text-foreground mt-1 italic font-medium">"{item.overrideReason || 'Late checkin'}"</p>
                    </div>
                    {getStatusBadge('APPROVED')}
                  </div>
                ))}

                {employeeLeaves.length === 0 && employeeWFH.length === 0 && employeePerms.length === 0 && employeeAttendances.filter(att => att.status === 'LEAVE').length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6 italic">No leave, WFH, or permission requests recorded for this employee.</p>
                )}
              </div>
            </Card>
          </div>
        )}

        {/* TAB 8: TASKS & REPORTS */}
        {activeTab === 'TASKS' && (
          <Card className="space-y-4 border-l-4 border-l-primary shadow-md animate-in fade-in duration-300">
            <div>
              <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" /> Daily Productivity & Task Reports
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Mandatory task reports submitted prior to check-out</p>
            </div>
            <TableWrapper
              columns={taskColumns}
              data={employeeTasks}
              searchKey="completedTasks"
              searchPlaceholder="Search task history..."
            />
          </Card>
        )}

        {/* TAB 9: ATTENDANCE HISTORY */}
        {activeTab === 'ATTENDANCE' && (
          <Card className="space-y-4 border-l-4 border-l-primary shadow-md animate-in fade-in duration-300">
            <div>
              <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                <CalendarCheck className="w-5 h-5 text-primary" /> Attendance & Check-In History
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">Daily login/logout timestamps, IP verification, and total working hours</p>
            </div>
            <TableWrapper
              columns={attendanceColumns}
              data={employeeAttendances}
              searchKey="ipAddress"
              searchPlaceholder="Filter by IP address..."
            />
          </Card>
        )}

      </div>

      <Modal
        isOpen={showConvertModal}
        onClose={() => setShowConvertModal(false)}
        title="Convert Intern to Full-Time Employee (Azure AD)"
        maxWidth="max-w-2xl"
      >
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (!convertForm.departmentId || !convertForm.designationId) {
              addToast('Selection Missing', 'Please select a valid Department and Designation.', 'error');
              return;
            }
            convertToFullTimeMutation.mutate(convertForm);
          }}
          className="space-y-4 px-2 text-left"
        >
          <p className="text-xs text-muted-foreground">
            This will upgrade the intern to a Full-Time employee. It will provision a secure account in Microsoft Azure AD/Entra ID for corporate SSO and remove their local password login.
          </p>

          {!isAzureConfigured && (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[10.5px] p-3 rounded-xl font-semibold">
              ⚠️ Microsoft SSO integration is not configured or is disabled. Accounts will be simulated, but configuration must be enabled in Settings for actual sync.
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Azure Principal Email (UPN) *"
              value={convertForm.userPrincipalName}
              onChange={(e) => setConvertForm(p => ({ ...p, userPrincipalName: e.target.value }))}
              placeholder="username@yourdomain.com"
              required
            />
            <Input
              label="Display Name *"
              value={convertForm.displayName}
              onChange={(e) => setConvertForm(p => ({ ...p, displayName: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Given/First Name *"
              value={convertForm.givenName}
              onChange={(e) => setConvertForm(p => ({ ...p, givenName: e.target.value }))}
              required
            />
            <Input
              label="Surname/Last Name *"
              value={convertForm.surname}
              onChange={(e) => setConvertForm(p => ({ ...p, surname: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Temporary Password *"
              value={convertForm.tempPassword}
              onChange={(e) => setConvertForm(p => ({ ...p, tempPassword: e.target.value }))}
              required
            />
            <Input
              label="Monthly Base Salary (INR) *"
              type="number"
              value={convertForm.salary}
              onChange={(e) => setConvertForm(p => ({ ...p, salary: Number(e.target.value) }))}
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input
              label="Employee ID *"
              value={convertForm.employeeId}
              onChange={(e) => setConvertForm(p => ({ ...p, employeeId: e.target.value }))}
              required
            />
            <Input
              label="Employee Hired Date *"
              type="date"
              value={convertForm.employeeHireDate}
              onChange={(e) => setConvertForm(p => ({ ...p, employeeHireDate: e.target.value }))}
              required
            />
            <Input
              label="Mobile Number *"
              value={convertForm.mobilePhone}
              onChange={(e) => setConvertForm(p => ({ ...p, mobilePhone: e.target.value }))}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Department *</label>
              <select
                value={convertForm.departmentId}
                onChange={(e) => {
                  const deptId = e.target.value;
                  const filteredDesigs = designations.filter((d: any) => {
                    const dId = typeof d.departmentId === 'object' && d.departmentId !== null ? d.departmentId._id : d.departmentId;
                    return dId === deptId && d.isActive;
                  });
                  const firstDesigId = filteredDesigs.length > 0 ? filteredDesigs[0]._id : '';
                  setConvertForm(p => ({ ...p, departmentId: deptId, designationId: firstDesigId }));
                }}
                className="w-full h-10 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2 transition-colors"
                required
              >
                <option value="" disabled>Select Department</option>
                {departments.map((dept: any) => (
                  <option key={dept._id} value={dept._id}>
                    {dept.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Designation *</label>
              <select
                value={convertForm.designationId}
                onChange={(e) => setConvertForm(p => ({ ...p, designationId: e.target.value }))}
                className="w-full h-10 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary focus:ring-offset-2 transition-colors disabled:opacity-50"
                disabled={!convertForm.departmentId}
                required
              >
                <option value="" disabled>Select Designation</option>
                {designations.filter((d: any) => {
                  const dId = typeof d.departmentId === 'object' && d.departmentId !== null ? d.departmentId._id : d.departmentId;
                  return dId === convertForm.departmentId && d.isActive;
                }).map((desig: any) => (
                  <option key={desig._id} value={desig._id}>
                    {desig.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block">
              Select Azure / Microsoft 365 Licenses
            </label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-[150px] overflow-y-auto pr-1">
              {azureLicenses.map((lic: any) => {
                const isChecked = (convertForm.selectedLicenses || []).includes(lic.skuId);
                return (
                  <label
                    key={lic.skuId}
                    className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs font-semibold cursor-pointer select-none transition-colors ${
                      isChecked
                        ? 'bg-primary/5 border-primary text-primary'
                        : 'bg-card border-border hover:border-primary/20 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setConvertForm(p => {
                          const current = p.selectedLicenses || [];
                          const next = checked
                            ? [...current, lic.skuId]
                            : current.filter((id: string) => id !== lic.skuId);
                          return { ...p, selectedLicenses: next };
                        });
                      }}
                      className="w-3.5 h-3.5 rounded text-primary focus:ring-primary border-border bg-background cursor-pointer accent-primary"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="block truncate font-bold text-[11px]">{lic.displayName}</span>
                      {lic.availableUnits !== undefined && (
                        <span className="block text-[9px] text-muted-foreground">
                          {lic.availableUnits} units free (of {lic.consumedUnits + lic.availableUnits})
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" type="button" onClick={() => setShowConvertModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={convertToFullTimeMutation.isPending} className="bg-primary text-white font-bold flex items-center gap-1.5 shadow-md">
              Upgrade & Provision in Azure
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default EmployeeDetailsPage;
