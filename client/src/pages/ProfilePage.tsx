import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { authApi } from '../api_service/authApi';
import { authV2Api } from '../api_service/authV2Api';
import { employeeApi } from '../api_service/employeeApi';
import { documentApi } from '../api_service/documentApi';
import { axiosInstance } from '../api_service/axiosInstance';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input, Textarea, Select } from '../Components/WrapperComponents/Input';
import { TableWrapper } from '../Components/WrapperComponents/TableWrapper';
import { formatCurrency } from '../utils/formatters';
import type { Employee } from '../types';
import {
  Camera,
  Loader2,
  Save,
  User as UserIcon,
  Mail,
  Shield,
  Briefcase,
  Calendar,
  DollarSign,
  Award,
  KeyRound,
  Smartphone,
  History,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Lock,
  CreditCard,
  FileDigit,
  FolderOpen,
  Upload,
  Download,
  Building,
  PhoneCall
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, role, updateUser } = useAuthStore();
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  // Tab State
  type TabType = 'personal' | 'professional' | 'emergency' | 'bank' | 'tax' | 'documents' | 'security';
  const [activeTab, setActiveTab] = useState<TabType>('personal');

  // Form Fields
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [ecName, setEcName] = useState('');
  const [ecRel, setEcRel] = useState('');
  const [ecPhone, setEcPhone] = useState('');

  // Financial (Bank & Tax) States
  const [bankName, setBankName] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [ifscCode, setIfscCode] = useState('');
  const [branchName, setBranchName] = useState('');

  const [panNumber, setPanNumber] = useState('');
  const [taxRegime, setTaxRegime] = useState<'OLD' | 'NEW' | ''>('');

  // Document Upload Form State
  const [docName, setDocName] = useState('');
  const [docCategory, setDocCategory] = useState<'CONTRACT' | 'PASSPORT' | 'VISA' | 'ID_PROOF' | 'CERTIFICATE' | 'OTHER'>('ID_PROOF');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  // Version Upload State (mapped by document ID)
  const [selectedVersionFile, setSelectedVersionFile] = useState<{ [key: string]: File }>({});
  const [isUploadingVersion, setIsUploadingVersion] = useState<{ [key: string]: boolean }>({});
  const [showHistory, setShowHistory] = useState<{ [key: string]: boolean }>({});

  const [isUploadingImg, setIsUploadingImg] = useState(false);

  // MFA Setup State
  const [mfaSetupData, setMfaSetupData] = useState<{ qrCode: string; secret: string } | null>(null);
  const [mfaCodeInput, setMfaCodeInput] = useState('');

  // Fetch latest user details on mount to refresh store
  useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      const res = await authApi.getMe();
      if (res?.user) {
        updateUser(res.user);
      }
      return res;
    },
  });

  // Fetch employee details if user has employeeId
  const { data: employeeData, isLoading: empLoading } = useQuery({
    queryKey: ['employeeProfile', user?.employeeId],
    queryFn: () => employeeApi.getById(user?.employeeId as string),
    enabled: !!user?.employeeId,
  });

  // Fetch MFA Status
  const { data: mfaStatus, refetch: refetchMfaStatus } = useQuery({
    queryKey: ['mfaStatus'],
    queryFn: authV2Api.getMFAStatus,
    enabled: activeTab === 'security',
  });

  // Fetch Active Trusted Devices
  const { data: devices, isLoading: isDevicesLoading, refetch: refetchDevices } = useQuery({
    queryKey: ['devices'],
    queryFn: authV2Api.getDevices,
    enabled: activeTab === 'security',
  });

  // Fetch Login History
  const { data: loginHistory, isLoading: isHistoryLoading } = useQuery({
    queryKey: ['loginHistory'],
    queryFn: authV2Api.getLoginHistory,
    enabled: activeTab === 'security',
  });

  // Fetch documents for the employee
  const { data: documents, isLoading: docsLoading, refetch: refetchDocs } = useQuery({
    queryKey: ['employeeDocuments', user?.employeeId],
    queryFn: () => documentApi.getDocuments({ employeeId: user?.employeeId }),
    enabled: !!user?.employeeId && activeTab === 'documents',
  });

  useEffect(() => {
    if (user?.name) setName(user.name);
    if (employeeData) {
      setPhone(employeeData.phone || '');
      setAddress(employeeData.address || '');
      if (employeeData.emergencyContact) {
        setEcName(employeeData.emergencyContact.name || '');
        setEcRel(employeeData.emergencyContact.relationship || '');
        setEcPhone(employeeData.emergencyContact.phone || '');
      } else {
        setEcName('');
        setEcRel('');
        setEcPhone('');
      }

      // Populate Bank Details
      if (employeeData.bankDetails) {
        setBankName(employeeData.bankDetails.bankName || '');
        setAccountName(employeeData.bankDetails.accountName || '');
        setAccountNumber(employeeData.bankDetails.accountNumber || '');
        setIfscCode(employeeData.bankDetails.ifscCode || '');
        setBranchName(employeeData.bankDetails.branchName || '');
      } else {
        setBankName('');
        setAccountName('');
        setAccountNumber('');
        setIfscCode('');
        setBranchName('');
      }

      // Populate Tax Details
      if (employeeData.taxDetails) {
        setPanNumber(employeeData.taxDetails.panNumber || '');
        setTaxRegime(employeeData.taxDetails.taxRegime || '');
      } else {
        setPanNumber('');
        setTaxRegime('');
      }

      if (employeeData.profileImage && employeeData.profileImage !== user?.profileImage) {
        updateUser({ profileImage: employeeData.profileImage });
      }
    }
  }, [user, employeeData, updateUser]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingImg(true);
    try {
      const url = await authApi.uploadImage(file);
      await authApi.updateMe({ profileImage: url });
      updateUser({ profileImage: url });
      queryClient.invalidateQueries({ queryKey: ['employeeProfile', user?.employeeId] });
      addToast('Profile Image Updated', 'Your profile picture has been successfully updated via Cloudinary.', 'success');
    } catch (error: any) {
      addToast('Upload Failed', error.message || 'Could not upload image.', 'error');
    } finally {
      setIsUploadingImg(false);
    }
  };

  const updateProfileMutation = useMutation({
    mutationFn: async () => {
      const updatePayload: any = { name };
      if (user?.employeeId) {
        updatePayload.phone = phone;
        updatePayload.address = address;
        updatePayload.emergencyContact = {
          name: ecName,
          relationship: ecRel,
          phone: ecPhone,
        };
      }
      return authApi.updateMe(updatePayload);
    },
    onSuccess: (resData) => {
      updateUser({ name: resData.user.name });
      queryClient.invalidateQueries({ queryKey: ['employeeProfile', user?.employeeId] });
      addToast('Profile Updated', 'Your profile details have been saved successfully.', 'success');
    },
    onError: (error: any) => {
      addToast('Update Failed', error.message || 'Could not update profile details.', 'error');
    },
  });

  const updateFinancialsMutation = useMutation({
    mutationFn: async (payload: Partial<Employee>) => {
      if (!user?.employeeId) throw new Error('No employee profile associated with user.');
      return employeeApi.update(user.employeeId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['employeeProfile', user?.employeeId] });
      addToast('Financial Details Updated', 'Bank/Tax information saved successfully.', 'success');
    },
    onError: (error: any) => {
      addToast('Update Failed', error.message || 'Could not update financial details.', 'error');
    },
  });

  const setupMfaMutation = useMutation({
    mutationFn: authV2Api.setupMFA,
    onSuccess: (data) => {
      setMfaSetupData(data);
      addToast('MFA Setup Initiated', 'Scan the QR code with an authenticator app to get verification codes.', 'success');
    },
    onError: (error: any) => {
      addToast('MFA Setup Failed', error.message || 'Could not initiate MFA setup.', 'error');
    },
  });

  const verifyMfaMutation = useMutation({
    mutationFn: authV2Api.verifyMFA,
    onSuccess: (data) => {
      if (data.verified) {
        setMfaSetupData(null);
        setMfaCodeInput('');
        refetchMfaStatus();
        addToast('MFA Enabled Successfully', 'Your account is now secured with Multi-Factor Authentication.', 'success');
      } else {
        addToast('Verification Failed', 'Invalid authenticator verification code. Please try again.', 'error');
      }
    },
    onError: (error: any) => {
      addToast('Verification Error', error.message || 'Could not verify code.', 'error');
    },
  });

  const disableMfaMutation = useMutation({
    mutationFn: authV2Api.disableMFA,
    onSuccess: () => {
      refetchMfaStatus();
      addToast('MFA Disabled', 'Multi-Factor Authentication has been removed from your account.', 'warning');
    },
    onError: (error: any) => {
      addToast('Error', error.message || 'Could not disable MFA.', 'error');
    },
  });

  const deviceMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: 'trust' | 'block' | 'remove' }) => {
      if (action === 'trust') return authV2Api.trustDevice(id);
      if (action === 'block') return authV2Api.blockDevice(id);
      return authV2Api.removeDevice(id);
    },
    onSuccess: (_, variables) => {
      refetchDevices();
      addToast('Device Policy Updated', `Action: ${variables.action.toUpperCase()} completed successfully.`, 'success');
    },
    onError: (error: any) => {
      addToast('Action Failed', error.message || 'Could not process device action.', 'error');
    },
  });

  const handleDocUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user?.employeeId) {
      addToast('Error', 'No employee profile associated with your user account.', 'error');
      return;
    }
    if (!selectedFile || !docName.trim()) {
      addToast('Validation Error', 'Please enter a document name and select a file.', 'error');
      return;
    }

    setIsUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append('document', selectedFile);
      const uploadRes = await axiosInstance.post<{ url: string }>('/upload/document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const fileUrl = uploadRes.data.url;

      await documentApi.uploadDocument({
        employeeId: user.employeeId,
        name: docName,
        category: docCategory,
        fileUrl,
      });

      setDocName('');
      setSelectedFile(null);
      addToast('Upload Successful', 'The document has been securely uploaded to S3.', 'success');
      refetchDocs();
    } catch (err: any) {
      console.error(err);
      addToast('Upload Failed', err.response?.data?.message || err.message || 'Error uploading file.', 'error');
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleAddVersionSubmit = async (docId: string) => {
    const file = selectedVersionFile[docId];
    if (!file) {
      addToast('Error', 'Please select a file to upload as a new version.', 'error');
      return;
    }

    setIsUploadingVersion(prev => ({ ...prev, [docId]: true }));
    try {
      const formData = new FormData();
      formData.append('document', file);
      const uploadRes = await axiosInstance.post<{ url: string }>('/upload/document', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const fileUrl = uploadRes.data.url;

      await documentApi.addVersion(docId, fileUrl);

      setSelectedVersionFile(prev => {
        const copy = { ...prev };
        delete copy[docId];
        return copy;
      });
      addToast('Version Added', 'A new version has been successfully uploaded.', 'success');
      refetchDocs();
    } catch (err: any) {
      console.error(err);
      addToast('Upload Failed', err.response?.data?.message || err.message || 'Error uploading version.', 'error');
    } finally {
      setIsUploadingVersion(prev => ({ ...prev, [docId]: false }));
    }
  };

  const handlePersonalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate();
  };

  const handleEmergencySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfileMutation.mutate();
  };

  const handleBankSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFinancialsMutation.mutate({
      bankDetails: {
        bankName,
        accountName,
        accountNumber,
        ifscCode,
        branchName
      }
    });
  };

  const handleTaxSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateFinancialsMutation.mutate({
      taxDetails: {
        panNumber,
        taxRegime: taxRegime as any
      }
    });
  };

  const handleVerifyMfaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaCodeInput.trim()) return;
    verifyMfaMutation.mutate(mfaCodeInput.trim());
  };

  const canEditFinancials = role === 'ADMIN' || role === 'HR' || role === 'MANAGER';

  // Columns for Device Table
  const deviceColumns = [
    {
      header: 'Device Name',
      accessor: (row: any) => (
        <div className="flex items-center gap-3 text-left">
          <div className="p-2 rounded-lg bg-muted border border-border flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-5 h-5 text-foreground" />
          </div>
          <div>
            <p className="font-bold text-xs text-foreground uppercase">{row.deviceName || 'Browser Session'}</p>
            <p className="text-[10px] text-muted-foreground font-mono">ID: {row.deviceId}</p>
          </div>
        </div>
      ),
    },
    {
      header: 'Network / IP Address',
      accessor: (row: any) => <span className="font-mono text-xs font-semibold">{row.ipAddress}</span>,
    },
    {
      header: 'Status',
      accessor: (row: any) => {
        if (row.isBlocked) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-destructive/10 text-destructive border border-destructive/20">
              <XCircle className="w-3.5 h-3.5" /> Blocked
            </span>
          );
        }
        if (row.isTrusted) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
              <CheckCircle2 className="w-3.5 h-3.5" /> Trusted
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-muted-foreground/10 text-muted-foreground border border-border">
            <AlertTriangle className="w-3.5 h-3.5" /> Untrusted
          </span>
        );
      },
    },
    {
      header: 'Last Active',
      accessor: (row: any) => (
        <span className="text-xs font-mono font-medium text-muted-foreground">
          {new Date(row.lastActiveAt).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Actions',
      accessor: (row: any) => (
        <div className="flex gap-2 justify-end">
          {!row.isTrusted && !row.isBlocked && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => deviceMutation.mutate({ id: row.deviceId, action: 'trust' })}
              isLoading={deviceMutation.isPending && deviceMutation.variables?.id === row.deviceId}
            >
              Trust
            </Button>
          )}
          {!row.isBlocked && (
            <Button
              size="sm"
              variant="outline"
              className="border-destructive/30 hover:bg-destructive/10 text-destructive font-semibold"
              onClick={() => deviceMutation.mutate({ id: row.deviceId, action: 'block' })}
              isLoading={deviceMutation.isPending && deviceMutation.variables?.id === row.deviceId}
            >
              Block
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="border-border hover:bg-muted font-semibold text-muted-foreground"
            onClick={() => deviceMutation.mutate({ id: row.deviceId, action: 'remove' })}
            isLoading={deviceMutation.isPending && deviceMutation.variables?.id === row.deviceId}
          >
            Revoke
          </Button>
        </div>
      ),
    },
  ];

  // Columns for Login History Table
  const historyColumns = [
    {
      header: 'Date & Time',
      accessor: (row: any) => (
        <span className="text-xs font-mono text-muted-foreground">
          {new Date(row.createdAt).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'IP Address',
      accessor: 'ipAddress',
      className: 'font-mono text-xs font-semibold',
    },
    {
      header: 'Browser Agent',
      accessor: (row: any) => (
        <span className="text-[10px] text-muted-foreground block truncate max-w-xs" title={row.userAgent}>
          {row.userAgent}
        </span>
      ),
    },
    {
      header: 'Status',
      accessor: (row: any) => {
        if (row.status === 'SUCCESS') {
          return (
            <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase bg-primary/10 text-primary border border-primary/20">
              Success
            </span>
          );
        }
        if (row.status === 'MFA_REQUIRED') {
          return (
            <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border border-yellow-500/20">
              MFA Challenge
            </span>
          );
        }
        return (
          <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-wider uppercase bg-destructive/10 text-destructive border border-destructive/20" title={row.failureReason}>
            Failed
          </span>
        );
      },
    },
  ];

  return (
    <div className="space-y-8 text-left animate-in fade-in duration-300 pb-12">
      {/* Top Banner / Header */}
      <div className="relative rounded-3xl bg-gradient-to-r from-primary/90 via-primary to-accent p-8 text-white shadow-xl overflow-hidden">
        <div className="absolute -right-10 -top-10 w-60 h-60 bg-white/10 rounded-full blur-2xl pointer-events-none" />
        <div className="absolute -left-10 -bottom-10 w-60 h-60 bg-black/10 rounded-full blur-2xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
          {/* Profile Avatar Box */}
          <div className="relative group w-32 h-32 md:w-40 md:h-40 rounded-3xl bg-card border-4 border-white/20 shadow-2xl overflow-hidden flex-shrink-0 cursor-pointer">
            {user?.profileImage || employeeData?.profileImage ? (
              <img src={user?.profileImage || employeeData?.profileImage} alt={user?.name || 'Profile'} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-tr from-accent to-primary flex items-center justify-center text-white font-black text-5xl">
                {user?.name?.charAt(0) || 'U'}
              </div>
            )}
            <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-sm" title="Click to change profile image">
              <Camera className="w-8 h-8 text-white mb-1" />
              <span className="text-[10px] font-bold text-white uppercase tracking-wider bg-primary/80 px-2 py-0.5 rounded-full">Change Photo</span>
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
            </label>
            {isUploadingImg && (
              <div className="absolute inset-0 bg-black/75 flex flex-col items-center justify-center backdrop-blur-sm">
                <Loader2 className="w-8 h-8 text-white animate-spin mb-2" />
                <span className="text-xs font-bold text-white tracking-wider animate-pulse">Uploading...</span>
              </div>
            )}
          </div>

          <div className="space-y-2 text-center md:text-left flex-1">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
              <h1 className="text-3xl md:text-4xl font-black tracking-tight drop-shadow-md">{user?.name}</h1>
              <span className="px-3.5 py-1 rounded-full bg-white/20 backdrop-blur-md text-xs font-black uppercase tracking-widest border border-white/30 shadow-inner">
                {role || 'EMPLOYEE'}
              </span>
            </div>
            <p className="text-white/90 text-sm md:text-base font-medium flex items-center justify-center md:justify-start gap-2">
              <Mail className="w-4 h-4 opacity-80" /> {user?.email}
            </p>
            {employeeData && (
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 pt-2 text-xs font-semibold text-white/90 border-t border-white/20 mt-3">
                <span className="flex items-center gap-1 bg-black/20 px-3 py-1 rounded-lg backdrop-blur-sm">
                  <Shield className="w-3.5 h-3.5 text-accent-foreground" /> Code: {employeeData.employeeCode}
                </span>
                <span className="flex items-center gap-1 bg-black/20 px-3 py-1 rounded-lg backdrop-blur-sm">
                  <Briefcase className="w-3.5 h-3.5 text-accent-foreground" /> {employeeData.designation} ({employeeData.department})
                </span>
                <span className="flex items-center gap-1 bg-black/20 px-3 py-1 rounded-lg backdrop-blur-sm">
                  <Calendar className="w-3.5 h-3.5 text-accent-foreground" /> Joined: {new Date(employeeData.joiningDate).toLocaleDateString()}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Horizontal Tabs Bar */}
      <div className="flex flex-wrap items-center gap-2 p-2 bg-card border border-border rounded-2xl shadow-sm w-full">
        {(['personal', 'professional', 'emergency', 'bank', 'tax', 'documents', 'security'] as TabType[]).map((tab) => {
          let label = tab.charAt(0).toUpperCase() + tab.slice(1);
          let icon = <UserIcon className="w-4 h-4" />;
          
          if (tab === 'professional') icon = <Briefcase className="w-4 h-4" />;
          if (tab === 'emergency') icon = <PhoneCall className="w-4 h-4" />;
          if (tab === 'bank') icon = <CreditCard className="w-4 h-4" />;
          if (tab === 'tax') icon = <FileDigit className="w-4 h-4" />;
          if (tab === 'documents') { label = 'Documents'; icon = <FolderOpen className="w-4 h-4" />; }
          if (tab === 'security') { label = 'Security'; icon = <Lock className="w-4 h-4" />; }

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

      {/* Loading State for Employee Profile */}
      {user?.employeeId && empLoading && (
        <div className="flex items-center justify-center h-60">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-xs text-muted-foreground font-bold tracking-wider animate-pulse uppercase">Loading details...</p>
          </div>
        </div>
      )}

      {/* Tab Contents */}
      {(!user?.employeeId || !empLoading) && (
        <div className="w-full space-y-6">
          {/* TAB 1: PERSONAL DETAILS */}
          {activeTab === 'personal' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
              <div className="space-y-8">
                {employeeData ? (
                  <Card className="p-6 border-2 border-primary/20 shadow-lg bg-gradient-to-b from-card to-primary/5 space-y-6 bg-card">
                    <h3 className="text-lg font-black text-foreground flex items-center gap-2 border-b border-border pb-3 tracking-tight">
                      <Award className="w-5 h-5 text-primary" /> Compensation & Balances
                    </h3>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-3.5 rounded-xl bg-background border border-border shadow-sm">
                        <span className="text-xs font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                          <DollarSign className="w-4 h-4 text-primary" /> Base Salary
                        </span>
                        <span className="text-base font-black text-foreground font-mono">
                          {formatCurrency(employeeData.salary)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3.5 rounded-xl bg-background border border-border shadow-sm">
                        <span className="text-xs font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                          <Calendar className="w-4 h-4 text-primary" /> Leave Balance
                        </span>
                        <span className="text-base font-black text-primary font-mono">
                          {employeeData.leaveBalance} Days
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3.5 rounded-xl bg-background border border-border shadow-sm">
                        <span className="text-xs font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                          <Briefcase className="w-4 h-4 text-primary" /> WFH Balance
                        </span>
                        <span className="text-base font-black text-primary font-mono">
                          {employeeData.wfhBalance} Days
                        </span>
                      </div>
                      <div className="flex items-center justify-between p-3.5 rounded-xl bg-background border border-border shadow-sm">
                        <span className="text-xs font-bold text-muted-foreground flex items-center gap-2 uppercase tracking-wider">
                          <Shield className="w-4 h-4 text-primary" /> Permission Hours
                        </span>
                        <span className="text-base font-black text-primary font-mono">
                          {employeeData.permissionHoursBalance} Hours
                        </span>
                      </div>
                    </div>
                  </Card>
                ) : (
                  <Card className="p-6 border border-border shadow-md space-y-6 bg-card">
                    <h3 className="text-lg font-black text-foreground flex items-center gap-2 border-b border-border pb-3 tracking-tight">
                      <Shield className="w-5 h-5 text-primary" /> System Access Role
                    </h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      You are currently logged in with <strong className="text-foreground">{role}</strong> privileges. Your account manages enterprise operations, configurations, and staff oversight.
                    </p>
                  </Card>
                )}

                {/* Azure AD SSO Card */}
                {user?.ssoData && (
                  <Card className="p-6 border border-border bg-gradient-to-br from-card via-card to-indigo-500/5 shadow-md space-y-6 bg-card text-left">
                    <h3 className="text-sm font-extrabold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5 border-b border-border pb-3">
                      <span className="h-2 w-2 rounded-full bg-indigo-500 flex-shrink-0 animate-pulse" />
                      SSO Identity Sync
                    </h3>
                    <div className="space-y-3.5 text-xs">
                      <div className="flex justify-between items-center py-1 border-b border-border/50">
                        <span className="text-muted-foreground font-semibold">Provider Source</span>
                        <span className="font-bold text-foreground bg-indigo-500/10 text-indigo-600 px-2.5 py-0.5 rounded-full uppercase tracking-wider text-[10px]">
                          {user.ssoData.provider}
                        </span>
                      </div>
                      <div className="flex justify-between items-start py-1 border-b border-border/50">
                        <span className="text-muted-foreground font-semibold">Azure AD App Roles</span>
                        <div className="flex flex-wrap gap-1 justify-end max-w-[180px]">
                          {user.ssoData.azureRoles && user.ssoData.azureRoles.length > 0 ? (
                            user.ssoData.azureRoles.map((r, i) => (
                              <span key={i} className="font-mono bg-muted text-foreground border border-border px-1.5 py-0.5 rounded text-[9px] font-bold">
                                {r}
                              </span>
                            ))
                          ) : (
                            <span className="italic text-muted-foreground">None Assigned</span>
                          )}
                        </div>
                      </div>
                      <div className="flex justify-between items-center py-1 border-b border-border/50">
                        <span className="text-muted-foreground font-semibold">Mapped HRMS Role</span>
                        <span className="font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full uppercase tracking-wider text-[10px]">
                          {user.ssoData.mappedRole || user.role}
                        </span>
                      </div>
                      <div className="flex justify-between items-center py-1">
                        <span className="text-muted-foreground font-semibold">Last Sync Time</span>
                        <span className="font-mono text-muted-foreground font-bold">
                          {new Date(user.ssoData.lastSyncedAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </Card>
                )}
              </div>

              <div className="lg:col-span-2">
                <Card className="p-8 border border-border shadow-xl bg-card space-y-6">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <h3 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
                        <UserIcon className="w-6 h-6 text-primary" /> Personal Details & Settings
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5 font-medium">Update your profile name, email, residential address, and phone number</p>
                    </div>
                  </div>

                  <form onSubmit={handlePersonalSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Input
                        label="Full Name *"
                        value={name || ''}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Enter your full name"
                        required
                      />
                      <Input
                        label="Email Address (Static)"
                        value={user?.email || ''}
                        disabled
                        className="bg-muted/50 cursor-not-allowed font-mono text-xs"
                      />
                      {employeeData && (
                        <>
                          <Input
                            label="Phone Number *"
                            value={phone || ''}
                            onChange={(e) => setPhone(e.target.value)}
                            placeholder="Enter your mobile number"
                            required
                          />
                          <Input
                            label="Employee Code (Static)"
                            value={employeeData.employeeCode || ''}
                            disabled
                            className="bg-muted/50 cursor-not-allowed font-mono text-xs"
                          />
                        </>
                      )}
                    </div>

                    {employeeData && (
                      <Textarea
                        label="Residential Address *"
                        value={address || ''}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Enter your full permanent address"
                        rows={3}
                        required
                      />
                    )}

                    <div className="flex justify-end pt-4 border-t border-border">
                      <Button
                        type="submit"
                        isLoading={updateProfileMutation.isPending}
                        className="bg-primary text-primary-foreground font-black tracking-wider py-3 px-8 rounded-xl shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all scale-[1.02]"
                      >
                        <Save className="w-5 h-5 mr-2" />
                        SAVE PROFILE CHANGES
                      </Button>
                    </div>
                  </form>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 2: PROFESSIONAL DETAILS */}
          {activeTab === 'professional' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {employeeData ? (
                <Card className="space-y-6 border-l-4 border-l-primary shadow-md bg-card">
                  <h3 className="text-lg font-bold text-foreground border-b border-border pb-3 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-primary" /> Professional Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-left">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                      <Briefcase className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Employee Code</p>
                        <p className="font-semibold text-foreground font-mono">{employeeData.employeeCode}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                      <Building className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Department</p>
                        <p className="font-semibold text-foreground">{employeeData.department}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                      <Briefcase className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Designation</p>
                        <p className="font-semibold text-foreground">{employeeData.designation}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border">
                      <Calendar className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Joining Date</p>
                        <p className="font-semibold text-foreground">{new Date(employeeData.joiningDate).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border col-span-2">
                      <DollarSign className="w-5 h-5 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Monthly Base Salary</p>
                        <p className="font-mono font-bold text-primary text-lg">{formatCurrency(employeeData.salary)}</p>
                      </div>
                    </div>
                  </div>
                </Card>
              ) : (
                <Card className="p-12 text-center border border-dashed border-border rounded-2xl bg-muted/10">
                  <Briefcase className="w-12 h-12 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-muted-foreground">No Employee Profile Linked</p>
                </Card>
              )}
            </div>
          )}

          {/* TAB 3: EMERGENCY CONTACT */}
          {activeTab === 'emergency' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {employeeData ? (
                <Card className="p-8 border border-border shadow-xl bg-card space-y-6">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <h3 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
                        <PhoneCall className="w-6 h-6 text-destructive" /> Emergency Contact Details
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5 font-medium">Update emergency contact details for safety and emergency notifications</p>
                    </div>
                  </div>

                  <form onSubmit={handleEmergencySubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <Input
                        label="Contact Name *"
                        value={ecName || ''}
                        onChange={(e) => setEcName(e.target.value)}
                        placeholder="Contact person name"
                        required
                      />
                      <Input
                        label="Relationship *"
                        value={ecRel || ''}
                        onChange={(e) => setEcRel(e.target.value)}
                        placeholder="e.g. Father, Spouse"
                        required
                      />
                      <Input
                        label="Contact Phone *"
                        value={ecPhone || ''}
                        onChange={(e) => setEcPhone(e.target.value)}
                        placeholder="Emergency mobile number"
                        required
                      />
                    </div>

                    <div className="flex justify-end pt-4 border-t border-border">
                      <Button
                        type="submit"
                        isLoading={updateProfileMutation.isPending}
                        className="bg-primary text-primary-foreground font-black tracking-wider py-3 px-8 rounded-xl shadow-lg"
                      >
                        <Save className="w-5 h-5 mr-2" />
                        SAVE EMERGENCY CONTACT
                      </Button>
                    </div>
                  </form>
                </Card>
              ) : (
                <Card className="p-12 text-center border border-dashed border-border rounded-2xl bg-muted/10">
                  <PhoneCall className="w-12 h-12 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-muted-foreground">No Employee Profile Linked</p>
                </Card>
              )}
            </div>
          )}

          {/* TAB 4: BANK DETAILS */}
          {activeTab === 'bank' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {employeeData ? (
                <Card className="p-8 border border-border shadow-xl bg-card space-y-6">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <h3 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
                        <CreditCard className="w-6 h-6 text-primary" /> Bank & Settlement Details
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                        {canEditFinancials 
                          ? 'Update bank transfer information for salary disbursements.' 
                          : 'Your direct deposit details. Standard employee profiles have read-only access.'}
                      </p>
                    </div>
                  </div>

                  {!canEditFinancials && (
                    <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-xs font-semibold text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Note: Bank details are read-only. Contact HR/Admin for corrections.
                    </div>
                  )}

                  <form onSubmit={handleBankSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Input
                        label="Bank Name *"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="e.g. JPMorgan Chase"
                        disabled={!canEditFinancials}
                        required
                      />
                      <Input
                        label="Account Holder Name *"
                        value={accountName}
                        onChange={(e) => setAccountName(e.target.value)}
                        placeholder="e.g. Jane Doe"
                        disabled={!canEditFinancials}
                        required
                      />
                      <Input
                        label="Account Number *"
                        value={accountNumber}
                        onChange={(e) => setAccountNumber(e.target.value)}
                        placeholder="Bank account number"
                        disabled={!canEditFinancials}
                        required
                      />
                      <Input
                        label="IFSC / Routing Code *"
                        value={ifscCode}
                        onChange={(e) => setIfscCode(e.target.value)}
                        placeholder="Bank swift/ifsc/routing code"
                        disabled={!canEditFinancials}
                        required
                      />
                      <Input
                        label="Branch Name *"
                        value={branchName}
                        onChange={(e) => setBranchName(e.target.value)}
                        placeholder="e.g. New York Branch"
                        disabled={!canEditFinancials}
                        required
                        className="md:col-span-2"
                      />
                    </div>

                    {canEditFinancials && (
                      <div className="flex justify-end pt-4 border-t border-border">
                        <Button
                          type="submit"
                          isLoading={updateFinancialsMutation.isPending}
                          className="bg-primary text-primary-foreground font-black tracking-wider py-3 px-8 rounded-xl shadow-lg"
                        >
                          <Save className="w-5 h-5 mr-2" />
                          SAVE BANK DETAILS
                        </Button>
                      </div>
                    )}
                  </form>
                </Card>
              ) : (
                <Card className="p-12 text-center border border-dashed border-border rounded-2xl bg-muted/10">
                  <CreditCard className="w-12 h-12 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-muted-foreground">No Employee Profile Linked</p>
                </Card>
              )}
            </div>
          )}

          {/* TAB 5: TAX DETAILS */}
          {activeTab === 'tax' && (
            <div className="space-y-6 animate-in fade-in duration-300">
              {employeeData ? (
                <Card className="p-8 border border-border shadow-xl bg-card space-y-6">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                    <div>
                      <h3 className="text-xl font-black text-foreground tracking-tight flex items-center gap-2">
                        <FileDigit className="w-6 h-6 text-primary" /> Tax Setup & Declaration
                      </h3>
                      <p className="text-xs text-muted-foreground mt-0.5 font-medium">
                        {canEditFinancials 
                          ? 'Configure permanent account tax configurations.' 
                          : 'Your declared tax details. Standard employee profiles have read-only access.'}
                      </p>
                    </div>
                  </div>

                  {!canEditFinancials && (
                    <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-xs font-semibold text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Note: Tax details are read-only. Contact HR/Admin for corrections.
                    </div>
                  )}

                  <form onSubmit={handleTaxSubmit} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Input
                        label="PAN Card Number *"
                        value={panNumber}
                        onChange={(e) => setPanNumber(e.target.value)}
                        placeholder="Tax Identification / PAN card code"
                        disabled={!canEditFinancials}
                        required
                        className="uppercase"
                      />
                      <div className="flex flex-col gap-1.5 text-left">
                        <label className="text-sm font-medium text-foreground mb-1.5">Income Tax Regime *</label>
                        <Select
                          value={taxRegime}
                          onChange={(e) => setTaxRegime(e.target.value as any)}
                          disabled={!canEditFinancials}
                          options={[
                            { value: '', label: 'Select Regime' },
                            { value: 'OLD', label: 'OLD Regime' },
                            { value: 'NEW', label: 'NEW Regime' }
                          ]}
                          required
                        />
                      </div>
                    </div>

                    {canEditFinancials && (
                      <div className="flex justify-end pt-4 border-t border-border">
                        <Button
                          type="submit"
                          isLoading={updateFinancialsMutation.isPending}
                          className="bg-primary text-primary-foreground font-black tracking-wider py-3 px-8 rounded-xl shadow-lg"
                        >
                          <Save className="w-5 h-5 mr-2" />
                          SAVE TAX DETAILS
                        </Button>
                      </div>
                    )}
                  </form>
                </Card>
              ) : (
                <Card className="p-12 text-center border border-dashed border-border rounded-2xl bg-muted/10">
                  <FileDigit className="w-12 h-12 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-muted-foreground">No Employee Profile Linked</p>
                </Card>
              )}
            </div>
          )}

          {/* TAB 6: DOCUMENTS */}
          {activeTab === 'documents' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
              {/* Upload form */}
              <div className="space-y-6">
                <Card className="p-6 border border-border shadow-md space-y-6 bg-card">
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2 border-b border-border pb-3">
                    <Upload className="w-5 h-5 text-primary" /> Upload New Document
                  </h3>
                  <form onSubmit={handleDocUploadSubmit} className="space-y-4">
                    <Input
                      label="Document Display Name *"
                      placeholder="e.g. PAN Card, Passport"
                      value={docName}
                      onChange={(e) => setDocName(e.target.value)}
                      required
                    />
                    
                    <div className="flex flex-col gap-1.5 text-left">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Category *</label>
                      <Select
                        value={docCategory}
                        onChange={(e) => setDocCategory(e.target.value as any)}
                        options={[
                          { value: 'ID_PROOF', label: 'ID Proof (PAN, Aadhaar, etc.)' },
                          { value: 'CONTRACT', label: 'Employment Contract' },
                          { value: 'PASSPORT', label: 'Passport Details' },
                          { value: 'VISA', label: 'Visa & Work Permits' },
                          { value: 'CERTIFICATE', label: 'Certificates (Degree, Experience)' },
                          { value: 'OTHER', label: 'Other Documents' }
                        ]}
                      />
                    </div>

                    <div className="space-y-1.5 text-left">
                      <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block">Select File *</label>
                      <div className="relative border border-dashed border-border hover:border-primary/50 transition-all rounded-xl p-6 text-center cursor-pointer bg-muted/20">
                        <input
                          type="file"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <FolderOpen className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                        <p className="text-xs font-bold text-foreground">
                          {selectedFile ? selectedFile.name : 'Choose file or drag & drop'}
                        </p>
                        <p className="text-[10px] text-muted-foreground mt-1">PDF, JPG, PNG up to 10MB</p>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      className="w-full bg-primary text-primary-foreground font-bold tracking-wider py-2.5 rounded-xl shadow-md"
                      isLoading={isUploadingDoc}
                    >
                      Securely Upload to S3
                    </Button>
                  </form>
                </Card>
              </div>

              {/* Document Listing */}
              <div className="lg:col-span-2 space-y-6">
                <Card className="p-6 border border-border shadow-md space-y-6 bg-card">
                  <div>
                    <h3 className="text-lg font-bold text-foreground tracking-tight flex items-center gap-2">
                      <FolderOpen className="w-5 h-5 text-primary" /> Document Repository
                    </h3>
                    <p className="text-xs text-muted-foreground mt-0.5">Secure, tenant-isolated document repository hosted on AWS S3.</p>
                  </div>

                  <div className="space-y-4">
                    {docsLoading ? (
                      <div className="h-40 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                      </div>
                    ) : documents && documents.length > 0 ? (
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

                              {/* Inline new version file selector trigger */}
                              <div className="relative overflow-hidden inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-xs font-bold border border-primary/20 cursor-pointer">
                                <input
                                  type="file"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      setSelectedVersionFile(prev => ({ ...prev, [doc._id]: file }));
                                    }
                                  }}
                                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                                />
                                <Upload className="w-3.5 h-3.5" /> 
                                {selectedVersionFile[doc._id] ? selectedVersionFile[doc._id].name : 'New Version'}
                              </div>

                              {selectedVersionFile[doc._id] && (
                                <Button
                                  size="sm"
                                  onClick={() => handleAddVersionSubmit(doc._id)}
                                  isLoading={isUploadingVersion[doc._id]}
                                  className="bg-primary text-white"
                                >
                                  Upload
                                </Button>
                              )}
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
                        <p className="text-xs text-muted-foreground/60 mt-1">Upload employment records, ID proofs, or certifications above.</p>
                      </div>
                    )}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {/* TAB 7: SECURITY & MFA */}
          {activeTab === 'security' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-300">
              {/* MFA Management Control Card */}
              <div className="space-y-8">
                <Card className="p-6 border-l-4 border-l-primary shadow-lg bg-card space-y-6 text-left">
                  <h3 className="text-lg font-black text-foreground flex items-center gap-2 border-b border-border pb-3 tracking-tight">
                    <KeyRound className="w-5 h-5 text-primary" /> Multi-Factor Auth (MFA)
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Adding an extra layer of security helps shield your account. Once verified, logging in requires entering a dynamic one-time passcode generated by your authenticator app.
                  </p>

                  {mfaStatus?.isMFAEnabled ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-primary/10 border border-primary/20 text-xs font-bold text-primary flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-primary" /> MFA is currently ENABLED.
                      </div>
                      <Button
                        variant="outline"
                        className="w-full border-destructive/30 hover:bg-destructive/10 text-destructive font-black tracking-wider text-xs"
                        onClick={() => {
                          if (window.confirm('Are you absolutely sure you want to disable Multi-Factor Authentication? This leaves your account less secure.')) {
                            disableMfaMutation.mutate();
                          }
                        }}
                        isLoading={disableMfaMutation.isPending}
                      >
                        DISABLE MFA
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="p-4 rounded-xl bg-yellow-500/5 border border-yellow-500/20 text-xs font-bold text-yellow-600 dark:text-yellow-400 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-yellow-500 flex-shrink-0" /> MFA is currently DISABLED.
                      </div>

                      {!mfaSetupData ? (
                        <Button
                          className="w-full bg-primary text-white font-black tracking-wider text-xs shadow-md"
                          onClick={() => setupMfaMutation.mutate()}
                          isLoading={setupMfaMutation.isPending}
                        >
                          ENABLE 2FA
                        </Button>
                      ) : (
                        <form onSubmit={handleVerifyMfaSubmit} className="space-y-4 pt-2 border-t border-border animate-in slide-in-from-bottom-2 duration-300">
                          <div className="flex flex-col items-center justify-center p-3.5 bg-white rounded-xl border border-border">
                            {mfaSetupData.qrCode ? (
                              <img src={mfaSetupData.qrCode} alt="Scan QR Code" className="w-36 h-36" />
                            ) : (
                              <div className="w-36 h-36 flex items-center justify-center bg-muted text-muted-foreground text-xs font-bold font-mono">
                                No QR Code URL
                              </div>
                            )}
                            <span className="text-[10px] text-muted-foreground font-mono mt-2 select-all select-text font-bold">Key: {mfaSetupData.secret}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground text-center font-medium leading-normal">
                            Scan this QR code with Google Authenticator or Microsoft Authenticator, then enter the 6-digit verification code below.
                          </p>
                          <Input
                            label="Verification Code *"
                            value={mfaCodeInput}
                            onChange={(e) => setMfaCodeInput(e.target.value)}
                            placeholder="e.g. 123456"
                            maxLength={6}
                            required
                            className="font-mono text-center tracking-widest text-lg font-black"
                          />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              className="flex-1 text-xs"
                              onClick={() => setMfaSetupData(null)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="submit"
                              className="flex-1 bg-primary text-white text-xs font-bold"
                              isLoading={verifyMfaMutation.isPending}
                            >
                              Verify Code
                            </Button>
                          </div>
                        </form>
                      )}
                    </div>
                  )}
                </Card>
              </div>

              {/* Device & Login History Container */}
              <div className="lg:col-span-2 space-y-8">
                {/* Active Devices */}
                <Card className="p-6 border border-border shadow-md space-y-4 text-left">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <h3 className="text-lg font-black text-foreground flex items-center gap-2 tracking-tight">
                      <Smartphone className="w-5 h-5 text-primary" /> Active Trusted Devices
                    </h3>
                    <button
                      onClick={() => refetchDevices()}
                      className="text-muted-foreground hover:text-foreground transition-colors p-1"
                      title="Refresh device sessions"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    These are devices and browser clients currently logged in or whitelisted for secure access to your profile.
                  </p>

                  {isDevicesLoading ? (
                    <div className="h-40 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                  ) : (
                    <TableWrapper
                      columns={deviceColumns}
                      data={devices || []}
                      rowsPerPage={4}
                    />
                  )}
                </Card>

                {/* Login Logs Audit */}
                <Card className="p-6 border border-border shadow-md space-y-4 text-left">
                  <div className="flex items-center gap-2 border-b border-border pb-3">
                    <History className="w-5 h-5 text-primary" />
                    <h3 className="text-lg font-black text-foreground tracking-tight">Recent Security Logins</h3>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    A historical log of connection pings, MFA status, and credential checks triggered by your user account.
                  </p>

                  {isHistoryLoading ? (
                    <div className="h-40 flex items-center justify-center">
                      <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                  ) : (
                    <TableWrapper
                      columns={historyColumns}
                      data={loginHistory || []}
                      rowsPerPage={5}
                    />
                  )}
                </Card>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
