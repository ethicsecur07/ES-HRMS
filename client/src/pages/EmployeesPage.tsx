import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { employeeApi } from '../api_service/employeeApi';
import { authApi } from '../api_service/authApi';
import { useNotificationStore } from '../store/useNotificationStore';
import { useAuthStore } from '../store/useAuthStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input, Select, Textarea } from '../Components/WrapperComponents/Input';
import { TableWrapper } from '../Components/WrapperComponents/TableWrapper';
import { Modal } from '../Components/WrapperComponents/Modal';
import type { Employee } from '../types';
import { formatCurrency } from '../utils/formatters';
import { PlusCircle, Edit, Trash2, PhoneCall, Eye, Camera, Loader2 } from 'lucide-react';

const DESIGNATIONS_BY_DEPARTMENT: Record<string, { value: string; label: string }[]> = {
  Developers: [
    { value: 'Full Stack Developer', label: 'Full Stack Developer' },
    { value: 'Backend Developer', label: 'Backend Developer' },
    { value: 'Frontend Developer', label: 'Frontend Developer' },
    { value: 'UI UX Developer', label: 'UI UX Developer' },
  ],
  Designers: [
    { value: 'UI/UX Designer', label: 'UI/UX Designer' },
    { value: 'Graphic Designer', label: 'Graphic Designer' },
    { value: 'Web Designer', label: 'Web Designer' },
    { value: 'Motion Designer', label: 'Motion Designer' },
  ],
  BDE: [
    { value: 'Business Development Executive', label: 'Business Development Executive' },
    { value: 'Business Development Manager', label: 'Business Development Manager' },
    { value: 'Sales Executive', label: 'Sales Executive' },
    { value: 'Senior BDE', label: 'Senior BDE' },
  ],
  DME: [
    { value: 'Digital Marketing Executive', label: 'Digital Marketing Executive' },
    { value: 'SEO Specialist', label: 'SEO Specialist' },
    { value: 'Social Media Manager', label: 'Social Media Manager' },
    { value: 'Content Creator', label: 'Content Creator' },
  ],
  Internship: [
    { value: 'Web Development Intern', label: 'Web Development Intern' },
    { value: 'UI/UX Design Intern', label: 'UI/UX Design Intern' },
    { value: 'Software Engineering Intern', label: 'Software Engineering Intern' },
    { value: 'Marketing Intern', label: 'Marketing Intern' },
  ],
};

const baseEmployeeSchema = z.object({
  id: z.string().optional(),
  employeeCode: z.string()
    .min(1, 'Employee Code is required')
    .regex(/^[A-Z]{2,5}-\d+$/, 'Employee Code must start with 2-5 uppercase letters followed by a hyphen and numbers (e.g., EMP-573)'),
  fullName: z.string()
    .min(3, 'Full name must be at least 3 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Full name must contain only letters and spaces'),
  email: z.string().min(1, 'Work Email is required').email('Invalid email address'),
  password: z.string().optional(),
  phone: z.string().regex(/^\+?[0-9\s-]{10,20}$/, 'Phone number must be a valid number (10 to 20 digits, spaces/hyphens allowed)'),
  department: z.enum(['Developers', 'Designers', 'BDE', 'DME', 'Internship']),
  designation: z.string().min(1, 'Designation is required'),
  joiningDate: z.string().min(1, 'Joining date is required'),
  salary: z.coerce.number().min(0, 'Salary cannot be negative'),
  address: z.string().min(5, 'Residential Address must be at least 5 characters'),
  emergencyContactName: z.string()
    .min(3, 'Emergency Contact Name must be at least 3 characters')
    .regex(/^[a-zA-Z\s]+$/, 'Contact name must contain only letters and spaces'),
  emergencyContactRel: z.string()
    .min(2, 'Relationship is required')
    .regex(/^[a-zA-Z\s]+$/, 'Relationship must contain only letters and spaces'),
  emergencyContactPhone: z.string().regex(/^\+?[0-9\s-]{10,20}$/, 'Emergency contact phone must be a valid number (10 to 20 digits, spaces/hyphens allowed)'),
});

const employeeSchema = baseEmployeeSchema.superRefine((data, ctx) => {
  // Validate password strength depending on onboarding/editing context
  if (!data.id) {
    // Create mode: password is required and must be strong
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
    // Edit mode: password is optional, but if entered, it must be strong
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

  // Minimum salary validation for regular employees (non-interns)
  if (data.department !== 'Internship' && data.salary < 10000) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Minimum salary is 10,000 for regular employees',
      path: ['salary'],
    });
  }
});

type EmployeeFormValues = z.infer<typeof baseEmployeeSchema>;

export const EmployeesPage: React.FC = () => {
  const { role } = useAuthStore();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [profileImage, setProfileImage] = useState<string>('');
  const [isUploadingImg, setIsUploadingImg] = useState(false);

  // Advanced Filter States
  const [nameFilter, setNameFilter] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');

  const navigate = useNavigate();
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  const { data: employees, isLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: employeeApi.getAll,
  });

  const filteredEmployees = useMemo(() => {
    if (!employees) return [];
    return employees.filter(emp => {
      const matchName = emp.fullName.toLowerCase().includes(nameFilter.toLowerCase());
      const matchDept = deptFilter === 'All' || emp.department === deptFilter;
      return matchName && matchDept;
    });
  }, [employees, nameFilter, deptFilter]);

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

  const editingEmployee = useMemo(() => {
    if (!editingId || !employees) return null;
    return employees.find(emp => emp._id === editingId) || null;
  }, [editingId, employees]);

  const getDesignationOptions = (dept: string) => {
    const options = DESIGNATIONS_BY_DEPARTMENT[dept] || [];
    if (editingEmployee && editingEmployee.department === dept && editingEmployee.designation) {
      if (!options.some(opt => opt.value === editingEmployee.designation)) {
        return [{ value: editingEmployee.designation, label: editingEmployee.designation }, ...options];
      }
    }
    return options;
  };

  const selectedDept = watch('department');

  // Reset designation if department changes to a department that doesn't support the current designation
  useEffect(() => {
    if (selectedDept) {
      const options = getDesignationOptions(selectedDept);
      const currentDesig = watch('designation');
      
      // If we are currently editing and the selected department is the employee's original department,
      // and the current designation is not set or matches the original designation, do not reset it.
      if (
        editingEmployee &&
        selectedDept === editingEmployee.department &&
        (!currentDesig || currentDesig === editingEmployee.designation)
      ) {
        return;
      }

      const isValid = options.some(o => o.value === currentDesig);
      if (!isValid && options.length > 0) {
        setValue('designation', options[0].value);
      }
    }
  }, [selectedDept, setValue, watch, editingEmployee]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImg(true);
    try {
      const url = await authApi.uploadImage(file);
      setProfileImage(url);
      addToast('Image Uploaded', 'Profile photo uploaded successfully to Cloudinary.', 'success');
    } catch (error: any) {
      addToast('Upload Failed', error.message || 'Could not upload image.', 'error');
    } finally {
      setIsUploadingImg(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: (values: EmployeeFormValues) => {
      const data = {
        employeeCode: values.employeeCode,
        fullName: values.fullName,
        email: values.email,
        password: values.password || 'EthicSec@2026',
        phone: values.phone,
        department: values.department,
        designation: values.designation,
        joiningDate: values.joiningDate,
        profileImage,
        salary: values.salary,
        address: values.address,
        emergencyContact: {
          name: values.emergencyContactName,
          relationship: values.emergencyContactRel,
          phone: values.emergencyContactPhone,
        },
      };
      if (editingId) {
        return employeeApi.update(editingId, data);
      }
      return employeeApi.create(data);
    },
    onSuccess: (resData: any) => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      if (!editingId && resData?.generatedPassword) {
        addToast('Employee Onboarded & Account Created', `Credentials: Email: ${resData.employee?.email || ''} | Password: ${resData.generatedPassword}`, 'success');
      } else {
        addToast(editingId ? 'Employee Updated' : 'Employee Onboarded', 'Directory updated successfully.', 'success');
      }
      reset();
      setShowModal(false);
      setEditingId(null);
      setProfileImage('');
    },
    onError: () => {
      addToast('Error', 'Failed to save employee data.', 'error');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: employeeApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employees'] });
      addToast('Employee Removed', 'Record and user account permanently deleted.', 'info');
    },
    onError: (error: any) => {
      addToast('Delete Failed', error.response?.data?.message || error.message || 'Failed to delete employee.', 'error');
    },
  });

  const handleEdit = (emp: Employee) => {
    setEditingId(emp._id);
    setProfileImage(emp.profileImage || '');
    setValue('id', emp._id);
    setValue('employeeCode', emp.employeeCode);
    setValue('fullName', emp.fullName);
    setValue('email', emp.email);
    setValue('password', '');
    setValue('phone', emp.phone);
    setValue('department', emp.department as any);
    setValue('designation', emp.designation);
    setValue('joiningDate', emp.joiningDate ? emp.joiningDate.split('T')[0] : '');
    setValue('salary', emp.salary);
    setValue('address', emp.address);
    setValue('emergencyContactName', emp.emergencyContact.name);
    setValue('emergencyContactRel', emp.emergencyContact.relationship);
    setValue('emergencyContactPhone', emp.emergencyContact.phone);
    setShowModal(true);
  };

  const handleAddNew = () => {
    setEditingId(null);
    setProfileImage('');
    reset({
      id: '',
      employeeCode: `EMP-${Date.now().toString().slice(-3)}`,
      joiningDate: new Date().toISOString().split('T')[0],
      department: 'Developers',
      password: 'EthicSec@2026',
      salary: 0,
    });
    setShowModal(true);
  };

  const columns = [
    {
      header: 'Employee',
      accessor: (row: Employee) => (
        <div 
          onClick={() => navigate(`/employees/${row._id}`)}
          className="flex items-center gap-3 cursor-pointer group"
          title="Click to view Employee Details"
        >
          {row.profileImage ? (
            <img src={row.profileImage} alt="" className="w-10 h-10 rounded-xl object-cover border border-border flex-shrink-0 group-hover:border-primary transition-colors" />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm flex-shrink-0 uppercase group-hover:border-primary transition-colors">
              {row.fullName.charAt(0)}
            </div>
          )}
          <div>
            <p className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">{row.fullName}</p>
            <p className="text-[10px] text-muted-foreground font-mono group-hover:text-foreground transition-colors">{row.employeeCode} | {row.email}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Department',
      accessor: (row: Employee) => (
        <span className="px-2.5 py-1 rounded-md bg-muted text-xs font-bold text-foreground border border-border">
          {row.department}
        </span>
      ),
    },
    { header: 'Designation', accessor: 'designation', className: 'text-xs font-semibold' },
    {
      header: 'Salary',
      accessor: (row: Employee) => <span className="text-xs font-mono font-bold text-primary">{formatCurrency(row.salary)}</span>,
    },
    {
      header: 'Emergency Contact',
      accessor: (row: Employee) => (
        <div className="text-xs">
          <p className="font-semibold text-foreground flex items-center gap-1">
            <PhoneCall className="w-3 h-3 text-primary" /> {row.emergencyContact.name} ({row.emergencyContact.relationship})
          </p>
          <p className="text-[10px] text-muted-foreground font-mono">{row.emergencyContact.phone}</p>
        </div>
      ),
    },
    {
      header: 'Actions',
      accessor: (row: Employee) => (
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => navigate(`/employees/${row._id}`)}>
            <Eye className="w-4 h-4" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => handleEdit(row)}>
            <Edit className="w-4 h-4" />
          </Button>
          {(role === 'ADMIN' || role === 'HR') && (
            <Button
              size="sm"
              variant="destructive"
              onClick={() => {
                if (window.confirm(`Are you sure you want to permanently delete the account for ${row.fullName}?`)) {
                  deleteMutation.mutate(row._id);
                }
              }}
              title="Delete Employee & User Account"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (isLoading) {
    return (
      <Card className="animate-pulse h-96 bg-muted/20">
        <div />
      </Card>
    );
  }

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">Employee Directory</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage company workforce, emergency contacts, and compensation packages
          </p>
        </div>
        <Button onClick={handleAddNew} className="bg-primary text-white font-bold tracking-wider shadow-lg shadow-primary/20">
          <PlusCircle className="w-5 h-5 mr-2" />
          ONBOARD EMPLOYEE
        </Button>
      </div>

      <Card className="border-l-4 border-l-primary shadow-md p-6 space-y-6">
        {/* Advanced Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border">
          <div className="flex-1 w-full">
            <Input
              placeholder="Search employees by name..."
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-64">
            <Select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              options={[
                { value: 'All', label: 'All Departments' },
                { value: 'Developers', label: 'Developers' },
                { value: 'Designers', label: 'Designers' },
                { value: 'BDE', label: 'BDE (Business Development)' },
                { value: 'DME', label: 'DME (Digital Marketing)' },
                { value: 'Internship', label: 'Internship' },
              ]}
            />
          </div>
        </div>

        <TableWrapper
          columns={columns}
          data={filteredEmployees}
        />
      </Card>

      {/* Onboard / Edit Modal */}
      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title={editingId ? 'Edit Employee Record' : 'Onboard New Employee'} maxWidth="max-w-2xl">
        <form onSubmit={handleSubmit((v) => createMutation.mutate(v))} className="space-y-4 text-left px-4">
          {/* Profile Image Upload Box */}
          <div className="flex items-center gap-4 p-4 rounded-xl bg-muted/30 border border-border">
            <div className="relative group w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden flex-shrink-0">
              {profileImage ? (
                <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <Camera className="w-6 h-6 text-primary opacity-60" />
              )}
              <label className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" title="Upload Cloudinary Profile Image">
                <Camera className="w-5 h-5 text-white" />
                <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
              </label>
              {isUploadingImg && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
                  <Loader2 className="w-5 h-5 text-white animate-spin" />
                </div>
              )}
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Profile Photograph</p>
              <p className="text-xs text-muted-foreground mt-0.5">Click the image box to upload a high-fidelity profile picture via Cloudinary</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="Employee Code *" {...register('employeeCode')} error={errors.employeeCode?.message} />
            <Input 
              label="Full Name *" 
              {...register('fullName')} 
              error={errors.fullName?.message} 
              onKeyPress={(e) => {
                if (!/^[a-zA-Z\s]$/.test(e.key)) {
                  e.preventDefault();
                }
              }}
            />
            <Input label="Work Email *" type="email" {...register('email')} error={errors.email?.message} />
            <Input label="Login Password *" type="text" {...register('password')} error={errors.password?.message} placeholder="Default: EthicSec@2026" />
            <Input 
              label="Phone Number *" 
              {...register('phone')} 
              error={errors.phone?.message} 
              onKeyPress={(e) => {
                if (!/^[0-9\s+-]$/.test(e.key)) {
                  e.preventDefault();
                }
              }}
            />
            <Select
              label="Department *"
              {...register('department')}
              error={errors.department?.message}
              options={[
                { value: 'Developers', label: 'Developers' },
                { value: 'Designers', label: 'Designers' },
                { value: 'BDE', label: 'BDE (Business Development)' },
                { value: 'DME', label: 'DME (Digital Marketing)' },
                { value: 'Internship', label: 'Internship' },
              ]}
            />
            <Select
              label="Designation *"
              {...register('designation')}
              error={errors.designation?.message}
              options={getDesignationOptions(selectedDept)}
              disabled={!selectedDept}
            />
            <Input label="Joining Date *" type="date" {...register('joiningDate')} error={errors.joiningDate?.message} />
            <Input label={selectedDept === 'Internship' ? 'Monthly Base Salary (INR) (Optional)' : 'Monthly Base Salary (INR) *'} type="number" {...register('salary')} error={errors.salary?.message} />
          </div>

          <Textarea label="Residential Address *" {...register('address')} error={errors.address?.message} />

          <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-4">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">Emergency Contact Information</span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input 
                label="Contact Name *" 
                {...register('emergencyContactName')} 
                error={errors.emergencyContactName?.message} 
                onKeyPress={(e) => {
                  if (!/^[a-zA-Z\s]$/.test(e.key)) {
                    e.preventDefault();
                  }
                }}
              />
              <Input 
                label="Relationship *" 
                {...register('emergencyContactRel')} 
                error={errors.emergencyContactRel?.message} 
                onKeyPress={(e) => {
                  if (!/^[a-zA-Z\s]$/.test(e.key)) {
                    e.preventDefault();
                  }
                }}
              />
              <Input 
                label="Contact Phone *" 
                {...register('emergencyContactPhone')} 
                error={errors.emergencyContactPhone?.message} 
                onKeyPress={(e) => {
                  if (!/^[0-9\s+-]$/.test(e.key)) {
                    e.preventDefault();
                  }
                }}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" type="button" onClick={() => setShowModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={isSubmitting || createMutation.isPending}>
              {editingId ? 'Save Changes' : 'Onboard Staff'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
