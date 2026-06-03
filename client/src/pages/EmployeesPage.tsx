import React, { useState, useMemo, useEffect } from 'react';
import { TableSkeleton } from '../Components/WrapperComponents/Skeleton';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { employeeApi } from '../api_service/employeeApi';
import { departmentApi } from '../api_service/departmentApi';
import { designationApi } from '../api_service/designationApi';
import { authApi } from '../api_service/authApi';
import { useNotificationStore } from '../store/useNotificationStore';
import { usePermission } from '../hooks/usePermission';
import { useAuthStore } from '../store/useAuthStore';
import { useTenantStore } from '../store/useTenantStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input, Textarea } from '../Components/WrapperComponents/Input';
import { TableWrapper } from '../Components/WrapperComponents/TableWrapper';
import { Modal } from '../Components/WrapperComponents/Modal';
import type { Employee } from '../types';
import { Edit, Trash2, Eye, Camera, Loader2, Sparkles, ChevronLeft, ChevronRight, Search, Plus } from 'lucide-react';

const baseEmployeeSchema = z.object({
  id: z.string().optional(),
  employeeCode: z.string().optional().or(z.literal('')),
  fullName: z.string()
    .min(3, 'Full name must be at least 3 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Full name must contain only letters and spaces'),
  email: z.string().min(1, 'Work Email is required').email('Invalid email address'),
  password: z.string().optional(),
  phone: z.string().regex(/^\+?[0-9\s-]{10,20}$/, 'Phone number must be a valid number (10 to 20 digits, spaces/hyphens allowed)'),
  departmentId: z.string().min(1, 'Department is required'),
  designationId: z.string().min(1, 'Designation is required'),
  joiningDate: z.string().min(1, 'Employee hire date is required'),
  salary: z.coerce.number().min(0, 'Salary cannot be negative'),
  address: z.string().min(5, 'Residential Address must be at least 5 characters'),
  emergencyContactName: z.string()
    .min(3, 'Emergency Contact Name must be at least 3 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Contact name must contain only letters and spaces'),
  emergencyContactRel: z.string()
    .min(2, 'Relationship is required')
    .regex(/^[a-zA-Z\s]+$/, 'Relationship must contain only letters and spaces'),
  emergencyContactPhone: z.string().regex(/^\+?[0-9\s-]{10,20}$/, 'Emergency contact phone must be a valid number (10 to 20 digits, spaces/hyphens allowed)'),
  // Bank details
  bankName: z.string().optional(),
  accountName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  branchName: z.string().optional(),
  // Tax details
  panNumber: z.string().optional(),
  taxRegime: z.enum(['OLD', 'NEW', '']).optional(),
});

const employeeSchema = baseEmployeeSchema.superRefine((data, ctx) => {
  // Validate password strength depending on onboarding/editing context
  if (!data.id) {
    if (!data.password || data.password.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Password is required for onboarding',
        path: ['password'],
      });
    } else {
      if (data.password.length < 6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Password must be at least 6 characters',
          path: ['password'],
        });
      }
      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/.test(data.password)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
          path: ['password'],
        });
      }
    }
  } else {
    if (data.password && data.password.trim() !== '') {
      if (data.password.length < 6) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Password must be at least 6 characters',
          path: ['password'],
        });
      }
      if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/.test(data.password)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
          path: ['password'],
        });
      }
    }
  }
});

type EmployeeFormValues = z.infer<typeof baseEmployeeSchema>;

export const EmployeesPage: React.FC = () => {
  const { hasPermission } = usePermission();
  const { user } = useAuthStore();
  const tenantConfig = useTenantStore((state) => state.tenantConfig);
  const isMicrosoftSsoEnabled = tenantConfig?.authProviders?.includes('MICROSOFT');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string>('');
  const [isUploadingImg, setIsUploadingImg] = useState(false);
  const [formTab, setFormTab] = useState<'general' | 'professional' | 'emergency' | 'bank_tax'>('general');
  const [isSyncingMS, setIsSyncingMS] = useState(false);

  // Filters & Pagination State
  const [searchInput, setSearchInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDeptId, setSelectedDeptId] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Derived: are any filters active?
  const hasActiveFilters = searchQuery !== '' || selectedDeptId !== 'All' || selectedStatus !== 'All';

  const clearFilters = () => {
    setSearchInput('');
    setSearchQuery('');
    setSelectedDeptId('All');
    setSelectedStatus('All');
    setCurrentPage(1);
  };

  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  // Load dynamic Departments & Designations
  const { data: departments = [] } = useQuery({
    queryKey: ['departments'],
    queryFn: departmentApi.getAll,
  });

  const { data: designations = [] } = useQuery({
    queryKey: ['designations'],
    queryFn: () => designationApi.getAll(),
  });

  // Fetch employees with pagination, search, and filters
  const { data: employeesData, isLoading } = useQuery({
    queryKey: ['employees', searchQuery, selectedDeptId, selectedStatus, currentPage],
    queryFn: () =>
      employeeApi.getAll({
        search: searchQuery || undefined,
        departmentId: selectedDeptId !== 'All' ? selectedDeptId : undefined,
        isLoginApproved:
          selectedStatus === 'Approved' ? 'true'
          : selectedStatus === 'Revoked' ? 'false'
          : undefined,
        page: currentPage,
        limit: itemsPerPage,
      }),
    staleTime: 10000,
  });

  const employees = employeesData?.employees || [];
  const totalEmployees = employeesData?.total || 0;
  const totalPages = Math.ceil(totalEmployees / itemsPerPage);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeSchema),
  });

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'add' && hasPermission('EMPLOYEES', 'create')) {
      reset();
      setEditingId(null);
      setProfileImage('');
      setFormTab('general');
      setShowModal(true);
      navigate('/employees', { replace: true });
    }
  }, [location.search, hasPermission, reset, navigate]);

  const selectedDeptIdWatch = watch('departmentId');

  // Filter designations for the selected department
  const filteredDesignations = useMemo(() => {
    if (!selectedDeptIdWatch) return [];
    return designations.filter((d: any) => {
      const deptId = typeof d.departmentId === 'object' && d.departmentId !== null
        ? d.departmentId._id
        : d.departmentId;
      return deptId === selectedDeptIdWatch && d.isActive;
    });
  }, [selectedDeptIdWatch, designations]);

  // Autocomplete designation choice if department changes
  useEffect(() => {
    if (selectedDeptIdWatch) {
      const currentDesigId = watch('designationId');
      const isValid = filteredDesignations.some((d) => d._id === currentDesigId);
      if (!isValid && filteredDesignations.length > 0) {
        setValue('designationId', filteredDesignations[0]._id);
      }
    }
  }, [selectedDeptIdWatch, filteredDesignations, setValue, watch]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImg(true);
    try {
      const url = await authApi.uploadImage(file);
      setProfileImage(url);
      addToast('Image Uploaded', 'Profile photo uploaded successfully.', 'success');
    } catch (error: any) {
      addToast('Upload Failed', error.message || 'Could not upload image.', 'error');
    } finally {
      setIsUploadingImg(false);
    }
  };

  const handleGenerateCode = async () => {
    try {
      const deptId = watch('departmentId');
      const desigId = watch('designationId');
      const desig = designations.find((d: any) => d._id === desigId);
      const isIntern = desig?.name?.toLowerCase().includes('intern');

      const nextCode = await employeeApi.getNextEmployeeCode(isIntern, deptId, desigId);
      setValue('employeeCode', nextCode);
      addToast('Code Generated', `Suggested employee code: ${nextCode}`, 'success');
    } catch (error: any) {
      addToast('Error', 'Failed to generate next employee code.', 'error');
    }
  };

  const createMutation = useMutation({
    mutationFn: (values: EmployeeFormValues) => {
      // Find corresponding department name & designation name for backwards-compatibility strings
      const targetDept = departments.find((d) => d._id === values.departmentId);
      const targetDesig = designations.find((d) => d._id === values.designationId);

      const data = {
        employeeCode: values.employeeCode || `TEMP-EMP-${values.email}`,
        fullName: values.fullName,
        email: values.email,
        password: values.password || '5@2026',
        phone: values.phone,
        department: targetDept?.name || 'Developers',
        designation: targetDesig?.name || 'Staff',
        departmentId: values.departmentId,
        designationId: values.designationId,
        joiningDate: values.joiningDate,
        profileImage,
        salary: values.salary,
        address: values.address,
        emergencyContact: {
          name: values.emergencyContactName,
          relationship: values.emergencyContactRel,
          phone: values.emergencyContactPhone,
        },
        bankDetails: {
          bankName: values.bankName || '',
          accountName: values.accountName || '',
          accountNumber: values.accountNumber || '',
          ifscCode: values.ifscCode || '',
          branchName: values.branchName || '',
        },
        taxDetails: {
          panNumber: values.panNumber || '',
          taxRegime: (values.taxRegime || '') as "" | "OLD" | "NEW",
        },
      };

      if (editingId) {
        // Find the original employee to preserve general/professional fields
        const originalEmp = employees.find((e: any) => e._id === editingId);
        if (originalEmp) {
          const origDeptId = typeof originalEmp.departmentId === 'object' && originalEmp.departmentId !== null
            ? originalEmp.departmentId?._id
            : originalEmp.departmentId;
          const origDesigId = typeof originalEmp.designationId === 'object' && originalEmp.designationId !== null
            ? originalEmp.designationId?._id
            : originalEmp.designationId;
          const targetDept = departments.find((d) => d._id === origDeptId);
          const targetDesig = designations.find((d) => d._id === origDesigId);

          const preservedData = {
            employeeCode: originalEmp.employeeCode,
            fullName: originalEmp.fullName,
            email: originalEmp.email,
            password: 'EthicSec@2026', // backend ignores passwords on update if empty/not-onboarding
            phone: originalEmp.phone,
            department: targetDept?.name || originalEmp.department,
            designation: targetDesig?.name || originalEmp.designation,
            departmentId: origDeptId,
            designationId: origDesigId,
            joiningDate: originalEmp.joiningDate ? originalEmp.joiningDate.split('T')[0] : '',
            profileImage: originalEmp.profileImage || '',
            salary: originalEmp.salary,
            address: originalEmp.address,
            emergencyContact: data.emergencyContact,
            bankDetails: data.bankDetails,
            taxDetails: data.taxDetails,
          };
          return employeeApi.update(editingId, preservedData);
        }
        return employeeApi.update(editingId, data);
      }
      return employeeApi.create(data);
    },
    onSuccess: (resData: any) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      if (!editingId && resData?.generatedPassword) {
        addToast(
          'Employee Onboarded',
          `Credentials provisioned. Email: ${resData.employee?.email || ''} | Password: ${resData.generatedPassword}`,
          'success'
        );
      } else {
        addToast(
          editingId ? 'Employee Updated' : 'Employee Onboarded',
          'Employee directory updated successfully.',
          'success'
        );
      }
      reset();
      setShowModal(false);
      setEditingId(null);
      setProfileImage('');
      setFormTab('general');
    },
    onError: (error: any) => {
      let errMsg = error.response?.data?.message || 'Failed to save employee data.';
      if (error.response?.data?.errors && Array.isArray(error.response.data.errors)) {
        const details = error.response.data.errors.map((e: any) => `${e.field}: ${e.message}`).join(', ');
        errMsg = `${errMsg} (${details})`;
      }
      addToast('Error', errMsg, 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: employeeApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      addToast('Employee Removed', 'Record deactivated and system access revoked.', 'info');
    },
    onError: (error: any) => {
      addToast('Delete Failed', error.response?.data?.message || error.message || 'Failed to delete employee.', 'error');
    },
  });

  const handleEdit = (emp: Employee) => {
    setEditingId(emp._id);
    setProfileImage(emp.profileImage || '');
    setValue('id', emp._id);
    setValue('employeeCode', emp.employeeCode?.startsWith('TEMP-EMP-') ? '' : emp.employeeCode);
    setValue('fullName', emp.fullName);
    setValue('email', emp.email);
    setValue('password', '');
    setValue('phone', emp.phone);
    setValue(
      'departmentId',
      typeof emp.departmentId === 'object' ? emp.departmentId?._id : (emp.departmentId || '')
    );
    setValue(
      'designationId',
      typeof emp.designationId === 'object' ? emp.designationId?._id : (emp.designationId || '')
    );
    setValue(emp.joiningDate ? 'joiningDate' : 'joiningDate', emp.joiningDate ? emp.joiningDate.split('T')[0] : '');
    setValue('salary', emp.salary);
    setValue('address', emp.address);
    setValue('emergencyContactName', emp.emergencyContact.name);
    setValue('emergencyContactRel', emp.emergencyContact.relationship);
    setValue('emergencyContactPhone', emp.emergencyContact.phone);
    // Bank details
    setValue('bankName', emp.bankDetails?.bankName || '');
    setValue('accountName', emp.bankDetails?.accountName || '');
    setValue('accountNumber', emp.bankDetails?.accountNumber || '');
    setValue('ifscCode', emp.bankDetails?.ifscCode || '');
    setValue('branchName', emp.bankDetails?.branchName || '');
    // Tax details
    setValue('panNumber', emp.taxDetails?.panNumber || '');
    setValue('taxRegime', emp.taxDetails?.taxRegime || '');

    setFormTab('general');
    setShowModal(true);
  };


  const handleSyncMicrosoft = async () => {
    if (!window.confirm('Are you sure you want to sync employees from your Microsoft Directory? This will auto-provision or update accounts for users with @ethicsecur.co.in or @ethicsecur.com corporate email.')) {
      return;
    }

    setIsSyncingMS(true);
    try {
      const result = await employeeApi.syncMicrosoft();
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      addToast(
        'Directory Synced',
        `Microsoft sync complete! Onboarded: ${result.createdCount} | Updated: ${result.updatedCount}. (Filtered to @ethicsecur.co.in or @ethicsecur.com domains)`,
        'success'
      );
    } catch (error: any) {
      console.error('Failed to sync employees:', error);
      addToast('Sync Failed', error.response?.data?.message || error.message || 'Failed to sync with Microsoft SSO.', 'error');
    } finally {
      setIsSyncingMS(false);
    }
  };

  const columns = [
    {
      header: 'Employee',
      accessor: (row: Employee) => (
        <div
          onClick={() => {
            if (user?.role !== 'EMPLOYEE') {
              navigate(`/employees/${row._id}`);
            }
          }}
          className={`flex items-center gap-3 ${user?.role !== 'EMPLOYEE' ? 'cursor-pointer group' : ''}`}
          title={user?.role !== 'EMPLOYEE' ? 'Click to view Employee Details' : undefined}
        >
          {row.profileImage ? (
            <img
              src={row.profileImage}
              alt=""
              className={`w-10 h-10 rounded-xl object-cover border border-border flex-shrink-0 ${
                user?.role !== 'EMPLOYEE' ? 'group-hover:border-primary' : ''
              } transition-colors`}
            />
          ) : (
            <div className={`w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0 uppercase ${
              user?.role !== 'EMPLOYEE' ? 'group-hover:border-primary' : ''
            } transition-colors`}>
              {row.fullName.charAt(0)}
            </div>
          )}
          <div>
            <p className={`font-bold text-xs text-foreground ${user?.role !== 'EMPLOYEE' ? 'group-hover:text-primary' : ''} transition-colors`}>
              {row.fullName}
            </p>
            <p className={`text-[10px] text-muted-foreground font-mono ${user?.role !== 'EMPLOYEE' ? 'group-hover:text-foreground' : ''} transition-colors`}>
              {row.employeeCode && !row.employeeCode.startsWith('TEMP-EMP-') ? `${row.employeeCode} | ` : ''}{row.email}
            </p>
          </div>
        </div>
      ),
    },
    {
      header: 'Department',
      accessor: (row: Employee) => (
        <span className="px-2.5 py-1 rounded-md bg-muted text-xs font-bold text-foreground border border-border">
          {(typeof row.departmentId === 'object' ? row.departmentId?.name : null) || row.department}
        </span>
      ),
    },
    {
      header: 'Designation',
      accessor: (row: Employee) => (
        <span className="text-xs font-semibold">{(typeof row.designationId === 'object' ? row.designationId?.name : null) || row.designation}</span>
      ),
    },
    {
      header: 'Contact Number',
      accessor: (row: Employee) => (
        <span className="text-xs font-mono">{row.phone || 'N/A'}</span>
      ),
    },
    {
      header: 'Login Status',
      accessor: (row: Employee) => (
        <span className={`inline-flex px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
          (row as any).isLoginApproved !== false
            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
            : 'bg-rose-500/10 text-rose-600 border-rose-500/20'
        }`}>
          {(row as any).isLoginApproved !== false ? 'Approved' : 'Revoked'}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (row: Employee) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate(`/employees/${row._id}`)} title="View Details">
            <Eye className="w-4 h-4" />
          </Button>
         
          {hasPermission('EMPLOYEES', 'delete') && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (window.confirm(`Are you sure you want to delete the account for ${row.fullName}?`)) {
                  deleteMutation.mutate(row._id);
                }
              }}
              title="Deactivate/Delete Employee"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      ),
    },
  ].filter((col) => {
    if (col.header === 'Actions' && (user?.role === 'EMPLOYEE' || user?.role === 'INTERN')) {
      return false;
    }
    return true;
  });

  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold text-foreground tracking-tight">Employee Directory</h2>
            <span className="px-2.5 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-bold font-mono">
              {hasActiveFilters ? `${totalEmployees} result${totalEmployees !== 1 ? 's' : ''}` : `${totalEmployees} employee${totalEmployees !== 1 ? 's' : ''}`}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {hasActiveFilters
              ? 'Showing filtered results — click ✕ Clear Filters to reset.'
              : 'Manage company workforce, organization structures, bank details, and profiles.'}
          </p>
        </div>
        {hasPermission('EMPLOYEES', 'create') && isMicrosoftSsoEnabled && (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={handleSyncMicrosoft}
              disabled={isSyncingMS}
              className="bg-muted hover:bg-muted/80 text-foreground font-bold tracking-wider shadow-lg flex items-center border border-border"
            >
              {isSyncingMS ? (
                <Loader2 className="w-5 h-5 mr-2 animate-spin text-primary" />
              ) : (
                <Sparkles className="w-5 h-5 mr-2 text-primary" />
              )}
              {isSyncingMS ? 'SYNCING...' : 'SYNC MICROSOFT'}
            </Button>
          </div>
        )}
      </div>

      <Card className="border-l-4 border-l-primary shadow-md p-6 space-y-6">
        {/* Advanced Filter Bar */}
        <div className="flex flex-col xl:flex-row items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border">
          <div className="flex-1 w-full flex items-center gap-2">
            <Input
              placeholder="Search employees by name, code, or email..."
              value={searchInput}
              icon={<Search className="w-4 h-4 text-muted-foreground" />}
              onChange={(e) => {
                setSearchInput(e.target.value);
                // Automatically clear filter if user clears search text completely
                if (e.target.value === '') {
                  setSearchQuery('');
                  setCurrentPage(1);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  setSearchQuery(searchInput);
                  setCurrentPage(1);
                }
              }}
            />
            <Button
              type="button"
              onClick={() => {
                setSearchQuery(searchInput);
                setCurrentPage(1);
              }}
              className="bg-primary hover:bg-primary/90 text-white font-bold h-10 px-4 flex items-center gap-1.5 shadow-md shadow-primary/10"
            >
              <Search className="w-4 h-4" />
              SEARCH
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full xl:w-auto flex-shrink-0">
            <select
              value={selectedDeptId}
              onChange={(e) => {
                setSelectedDeptId(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
            >
              <option value="All">All Departments</option>
              {departments.map((dept: any) => (
                <option key={dept._id} value={dept._id}>
                  {dept.name}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm font-medium focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors"
            >
              <option value="All">All Login Statuses</option>
              <option value="Approved">Login Approved</option>
              <option value="Revoked">Login Revoked</option>
            </select>
          </div>

          {/* Clear Filters Button */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex-shrink-0 h-10 px-4 py-2 rounded-lg border border-primary/40 bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider hover:bg-primary/20 transition-colors whitespace-nowrap"
            >
              ✕ Clear Filters
            </button>
          )}
        </div>

        <TableWrapper columns={columns} data={employees} rowsPerPage={itemsPerPage} />

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border pt-4 mt-4">
            <span className="text-xs text-muted-foreground">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{' '}
              {Math.min(currentPage * itemsPerPage, totalEmployees)} of {totalEmployees} employees
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="w-4 h-4 mr-1" /> Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Next <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
