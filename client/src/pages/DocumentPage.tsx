import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { documentApi } from '../api_service/documentApi';
import { employeeApi } from '../api_service/employeeApi';
import { payrollApi } from '../api_service/payrollApi';
import { assetApi } from '../api_service/assetApi';
import { authApi } from '../api_service/authApi';
import { TableSkeleton, CardGridSkeleton, Skeleton } from '../Components/WrapperComponents/Skeleton';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input } from '../Components/WrapperComponents/Input';
import { usePermission } from '../hooks/usePermission';
import {
  FolderOpen,
  FileText,
  Search,
  Upload,
  Download,
  User,
  Trash2,
  Loader2,
  Paperclip,
  Cpu
} from 'lucide-react';

type DocCategory = 'RESUME' | 'OFFER_LETTER' | 'CERTIFICATE' | 'TAX_DOCUMENT' | 'PAYSLIP' | 'ASSET' | 'OTHER';

export const DocumentPage: React.FC = () => {
  const { role, user } = useAuthStore();
  const { addToast } = useNotificationStore();
  const { hasPermission } = usePermission();
  const queryClient = useQueryClient();

  const isHRAdmin = role === 'ADMIN' || role === 'HR' || role === 'MANAGER';
  const canUpload = hasPermission('DOCUMENTS', 'create') || isHRAdmin;
  const canDelete = hasPermission('DOCUMENTS', 'delete') || isHRAdmin;

  // Selected Employee State
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  
  // Active Category Tab
  const [activeTab, setActiveTab] = useState<DocCategory>('RESUME');

  // Sidebar employee search & department filter
  const [empSearch, setEmpSearch] = useState('');

  // Search filter for documents list
  const [docSearch, setDocSearch] = useState('');

  // File Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState('');
  const [newDocName, setNewDocName] = useState('');

  // 1. Fetch Employees (for Sidebar)
  const { data: employeesData, isLoading: isEmployeesLoading } = useQuery({
    queryKey: ['employees-sidebar'],
    queryFn: () => employeeApi.getAll({ limit: 1000 }),
    enabled: isHRAdmin,
  });
  const employees = employeesData?.employees || [];

  // Automatically select logged-in employee if standard staff
  useEffect(() => {
    if (!isHRAdmin && user?.employeeId) {
      setSelectedEmpId(user.employeeId);
    } else if (isHRAdmin && employees.length > 0 && !selectedEmpId) {
      // Pre-select first employee for Admin/HR convenience
      setSelectedEmpId(employees[0]._id);
    }
  }, [isHRAdmin, user, employees, selectedEmpId]);

  // Selected Employee Profile
  const activeEmployee = useMemo(() => {
    return employees.find(emp => emp._id === selectedEmpId) || null;
  }, [employees, selectedEmpId]);

  // Fetch active employee details if viewing as self (since employees list is only for HRAdmin)
  const { data: myEmployeeDetails, isLoading: isMyEmpLoading } = useQuery({
    queryKey: ['employee-self-details', user?.employeeId],
    queryFn: () => employeeApi.getById(user?.employeeId as string),
    enabled: !isHRAdmin && !!user?.employeeId,
  });

  const displayedEmployee = isHRAdmin ? activeEmployee : (myEmployeeDetails || null);

  // 2. Fetch Employee Documents
  const { data: documents = [], isLoading: isDocsLoading } = useQuery({
    queryKey: ['documents', selectedEmpId, activeTab],
    queryFn: () => documentApi.getDocuments({
      employeeId: selectedEmpId || undefined,
      category: activeTab
    }),
    enabled: !!selectedEmpId && activeTab !== 'PAYSLIP' && activeTab !== 'ASSET',
  });

  // 3. Fetch Payslips (for PAYSLIP tab)
  const { data: allPayrolls = [], isLoading: isPayrollLoading } = useQuery({
    queryKey: ['payrolls-all-docs'],
    queryFn: payrollApi.getAll,
    enabled: !!selectedEmpId && activeTab === 'PAYSLIP',
  });

  const employeePayslips = useMemo(() => {
    return allPayrolls.filter(p => {
      const pEmpId = typeof p.employeeId === 'object' ? p.employeeId?._id : p.employeeId;
      return pEmpId === selectedEmpId;
    });
  }, [allPayrolls, selectedEmpId]);

  // 4. Fetch Assigned Assets (for ASSET tab)
  const { data: employeeAssets = [], isLoading: isAssetsLoading } = useQuery({
    queryKey: ['employee-assets-docs', selectedEmpId],
    queryFn: () => assetApi.getEmployeeAssets(selectedEmpId),
    enabled: !!selectedEmpId && activeTab === 'ASSET',
  });

  // Upload Mutation
  const uploadDocMutation = useMutation({
    mutationFn: documentApi.uploadDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', selectedEmpId, activeTab] });
      addToast('Document Uploaded', 'Document successfully indexed under selected folder.', 'success');
      setUploadedUrl('');
      setNewDocName('');
      setIsUploading(false);
    },
    onError: (err: any) => {
      addToast('Upload Failed', err.response?.data?.message || err.message || 'Failed to save document.', 'error');
      setIsUploading(false);
    }
  });

  // Delete Mutation
  const deleteDocMutation = useMutation({
    mutationFn: documentApi.deleteDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents', selectedEmpId, activeTab] });
      addToast('Document Deleted', 'Document reference deleted successfully.', 'info');
    },
    onError: (err: any) => {
      addToast('Delete Failed', err.response?.data?.message || err.message || 'Could not delete document.', 'error');
    }
  });

  // Handle Cloudinary File Upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const url = await authApi.uploadImage(file);
      setUploadedUrl(url);
      setNewDocName(file.name);
      addToast('Secure File Uploaded', 'Reference loaded. Click Save to complete.', 'success');
    } catch (err: any) {
      addToast('File Upload Failed', err.message || 'Failed to upload document file.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveDocument = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadedUrl || !newDocName.trim()) return;

    uploadDocMutation.mutate({
      employeeId: selectedEmpId,
      name: newDocName.trim(),
      category: activeTab,
      fileUrl: uploadedUrl,
    });
  };

  // Filter sidebar employees by search
  const filteredEmployees = useMemo(() => {
    return employees.filter(emp =>
      emp.fullName.toLowerCase().includes(empSearch.toLowerCase()) ||
      (emp.department || '').toLowerCase().includes(empSearch.toLowerCase()) ||
      (emp.employeeCode || '').toLowerCase().includes(empSearch.toLowerCase())
    );
  }, [employees, empSearch]);

  // Filter documents by search
  const filteredDocs = useMemo(() => {
    return documents.filter(doc =>
      doc.name.toLowerCase().includes(docSearch.toLowerCase())
    );
  }, [documents, docSearch]);

  const categoriesList: { value: DocCategory; label: string }[] = [
    { value: 'RESUME', label: 'Resume' },
    { value: 'OFFER_LETTER', label: 'Offer Letter' },
    { value: 'CERTIFICATE', label: 'Certificates' },
    { value: 'TAX_DOCUMENT', label: 'Tax Documents' },
    { value: 'PAYSLIP', label: 'Payslips' },
    { value: 'ASSET', label: 'Assigned Assets' },
    { value: 'OTHER', label: 'Other Uploads' },
  ];

  if ((isHRAdmin && isEmployeesLoading) || (!isHRAdmin && isMyEmpLoading)) {
    return <TableSkeleton />;
  }

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      {/* Title Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-primary" />
            Document Directory
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Access, upload, and manage files, contracts, dynamic payslips, and hardware resources.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Pane - Sidebar Employee Directory (HR/Admin Only) */}
        {isHRAdmin && (
          <div className="space-y-4 lg:col-span-1">
            <Card className="p-4 space-y-4 border border-border/80 bg-card/75 backdrop-blur-md">
              <h3 className="text-xs font-extrabold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" /> Staff Directory
              </h3>
              
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search staff..."
                  value={empSearch}
                  onChange={(e) => setEmpSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 bg-background border border-border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>

              <div className="space-y-1.5 max-h-[480px] overflow-y-auto pr-1">
                {filteredEmployees.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-8">No employees found</p>
                ) : (
                  filteredEmployees.map(emp => (
                    <button
                      key={emp._id}
                      onClick={() => { setSelectedEmpId(emp._id); setDocSearch(''); }}
                      className={`w-full text-left p-2.5 rounded-xl text-xs transition-all flex items-center gap-3 border ${
                        selectedEmpId === emp._id
                          ? 'bg-primary/10 border-primary text-primary font-bold shadow-sm'
                          : 'border-transparent text-muted-foreground hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary font-bold uppercase border border-primary/10">
                        {emp.fullName.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate leading-none mb-0.5">{emp.fullName}</p>
                        <p className="text-[10px] text-muted-foreground font-mono truncate">{emp.employeeCode} | {emp.department}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

        {/* Right Pane - Detail View */}
        <div className={isHRAdmin ? 'lg:col-span-3 space-y-6' : 'lg:col-span-4 space-y-6'}>
          {displayedEmployee ? (
            <>
              {/* Employee Summary Card */}
              <Card className="p-6 border-l-4 border-l-primary bg-card/60 backdrop-blur-md flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <h3 className="text-xl font-bold text-foreground leading-none">{displayedEmployee.fullName}</h3>
                  <p className="text-xs text-muted-foreground mt-1.5 font-medium flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded bg-muted border border-border font-bold uppercase text-[9px]">{displayedEmployee.employeeCode}</span>
                    <span>•</span>
                    <span>{displayedEmployee.department}</span>
                    <span>•</span>
                    <span>{displayedEmployee.designation}</span>
                  </p>
                  <p className="text-[10px] text-muted-foreground font-mono mt-1">{displayedEmployee.email}</p>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className={`px-2.5 py-1 rounded-full font-bold border ${
                    displayedEmployee.isActive 
                      ? 'bg-green-500/10 text-green-400 border-green-500/20' 
                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                  }`}>
                    {displayedEmployee.isActive ? 'Active Employee' : 'Inactive'}
                  </span>
                </div>
              </Card>

              {/* Tabs Navbar */}
              <div className="flex border-b border-border overflow-x-auto scrollbar-none gap-2">
                {categoriesList.map(tab => (
                  <button
                    key={tab.value}
                    onClick={() => { setActiveTab(tab.value); setDocSearch(''); }}
                    className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 whitespace-nowrap transition-all ${
                      activeTab === tab.value
                        ? 'border-primary text-primary font-extrabold'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Panels */}
              <div className="space-y-4">
                {/* Standard Documents Panel (RESUME, OFFER_LETTER, CERTIFICATE, TAX_DOCUMENT, OTHER) */}
                {activeTab !== 'PAYSLIP' && activeTab !== 'ASSET' && (
                  <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 items-start animate-in fade-in duration-200">
                    {/* Documents List - takes 2 columns */}
                    <div className="xl:col-span-2 space-y-4">
                      <div className="relative">
                        <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
                        <Input
                          placeholder={`Search ${activeTab.replace('_', ' ').toLowerCase()} files...`}
                          value={docSearch}
                          onChange={(e) => setDocSearch(e.target.value)}
                          className="pl-9 py-1.5 text-xs bg-card"
                        />
                      </div>

                      {isDocsLoading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {[1, 2, 3, 4].map(n => (
                            <div key={n} className="p-4 border border-border bg-card rounded-xl space-y-3">
                              <Skeleton className="h-4 w-3/4" />
                              <Skeleton className="h-3 w-1/2" />
                              <div className="flex gap-2 pt-2 border-t border-border/40">
                                <Skeleton className="h-8 flex-1" />
                                <Skeleton className="h-8 w-10" />
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : filteredDocs.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-2xl bg-muted/10">
                          <FileText className="w-10 h-10 text-muted-foreground/45 mb-2.5" />
                          <p className="font-bold text-xs">No Files Uploaded</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Use the upload box on the right to add folders.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {filteredDocs.map(doc => (
                            <Card key={doc._id} className="p-4 border border-border/80 bg-card hover:shadow-sm transition-all duration-200 flex flex-col justify-between space-y-3 relative group">
                              <div className="space-y-1 pr-6">
                                <h4 className="font-bold text-xs text-foreground truncate pr-6 group-hover:text-primary transition-colors" title={doc.name}>
                                  {doc.name}
                                </h4>
                                <p className="text-[9px] text-muted-foreground font-mono">
                                  Uploaded: {new Date(doc.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 pt-2 border-t border-border/40">
                                <Button
                                  size="sm"
                                  onClick={() => window.open(doc.fileUrl, '_blank')}
                                  className="flex-1 text-[10px] py-1 px-2.5 flex items-center justify-center gap-1"
                                >
                                  <Download className="w-3 h-3" /> Open
                                </Button>
                                {canDelete && (
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => {
                                      if (confirm(`Are you sure you want to delete ${doc.name}?`)) {
                                        deleteDocMutation.mutate(doc._id);
                                      }
                                    }}
                                    className="p-1 px-2 text-[10px]"
                                    title="Delete Document"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </Button>
                                )}
                              </div>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Upload File Box - takes 1 column */}
                    {canUpload && (
                      <div className="xl:col-span-1">
                        <Card className="p-5 border border-border/80 bg-card/65 space-y-4">
                          <h4 className="text-xs font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                            <Upload className="w-4 h-4 text-primary" /> Upload Reference
                          </h4>
                          <form onSubmit={handleSaveDocument} className="space-y-4">
                            <div className="space-y-2">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase block">Choose Local File</label>
                              <label className="flex items-center justify-center gap-2 p-6 rounded-xl border border-dashed border-border hover:bg-muted/30 cursor-pointer transition-colors text-center w-full">
                                {isUploading ? (
                                  <div className="flex flex-col items-center gap-2">
                                    <Loader2 className="w-6 h-6 text-primary animate-spin" />
                                    <span className="text-[10px] text-muted-foreground font-medium">Uploading to cloud storage...</span>
                                  </div>
                                ) : uploadedUrl ? (
                                  <div className="flex flex-col items-center gap-1">
                                    <Paperclip className="w-6 h-6 text-emerald-500" />
                                    <span className="text-[10px] text-emerald-600 font-bold">File loaded successfully</span>
                                    <span className="text-[9px] text-muted-foreground truncate max-w-[200px]">{newDocName}</span>
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center gap-1.5">
                                    <Upload className="w-6 h-6 text-muted-foreground/60" />
                                    <span className="text-[10px] text-muted-foreground font-semibold">Click to select files</span>
                                  </div>
                                )}
                                <input
                                  type="file"
                                  className="hidden"
                                  onChange={handleFileUpload}
                                  disabled={isUploading}
                                />
                              </label>
                            </div>

                            {uploadedUrl && (
                              <Input
                                label="Document Label / Title *"
                                value={newDocName}
                                onChange={(e) => setNewDocName(e.target.value)}
                                required
                              />
                            )}

                            <Button
                              type="submit"
                              className="w-full text-xs font-bold uppercase tracking-wider bg-primary text-white shadow-md py-2.5"
                              isLoading={uploadDocMutation.isPending}
                              disabled={isUploading || !uploadedUrl}
                            >
                              Save Document
                            </Button>
                          </form>
                        </Card>
                      </div>
                    )}
                  </div>
                )}

                {/* Payslips Tab Panel */}
                {activeTab === 'PAYSLIP' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {isPayrollLoading ? (
                      <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
                        {[1, 2, 3, 4].map(n => (
                          <div key={n} className="p-4 flex justify-between items-center bg-card">
                            <Skeleton className="h-4.5 w-1/6" />
                            <Skeleton className="h-4 w-1/12" />
                            <Skeleton className="h-4 w-1/12" />
                            <Skeleton className="h-4 w-1/12" />
                            <Skeleton className="h-5 w-12 rounded-full" />
                            <Skeleton className="h-8 w-24" />
                          </div>
                        ))}
                      </div>
                    ) : employeePayslips.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-2xl bg-muted/10">
                        <FileText className="w-10 h-10 text-muted-foreground/45 mb-2.5" />
                        <p className="font-bold text-xs">No Payslips Generated</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Run payroll cycles under the payroll tab to generate payslips.</p>
                      </div>
                    ) : (
                      <Card className="overflow-hidden border border-border p-0">
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-xs">
                            <thead>
                              <tr className="bg-muted/40 border-b border-border">
                                <th className="p-3 font-bold text-muted-foreground uppercase">Payout Month</th>
                                <th className="p-3 font-bold text-muted-foreground uppercase">Base Salary</th>
                                <th className="p-3 font-bold text-muted-foreground uppercase">Deductions</th>
                                <th className="p-3 font-bold text-muted-foreground uppercase">Net Payout</th>
                                <th className="p-3 font-bold text-muted-foreground uppercase">Status</th>
                                <th className="p-3 font-bold text-muted-foreground uppercase text-right">Actions</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border/60">
                              {employeePayslips.map(p => (
                                <tr key={p._id} className="hover:bg-muted/10 transition-colors">
                                  <td className="p-3 font-bold text-foreground">{p.month}</td>
                                  <td className="p-3 font-mono">₹{p.baseSalary.toLocaleString()}</td>
                                  <td className="p-3 font-mono text-rose-500">-₹{p.deductions.toLocaleString()}</td>
                                  <td className="p-3 font-mono font-bold text-primary">₹{p.finalSalary.toLocaleString()}</td>
                                  <td className="p-3">
                                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[9px] font-bold border uppercase ${
                                      p.paidStatus === 'PAID'
                                        ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                        : 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'
                                    }`}>
                                      {p.paidStatus}
                                    </span>
                                  </td>
                                  <td className="p-3 text-right">
                                    {p.payslipUrl ? (
                                      <Button
                                        size="sm"
                                        onClick={() => window.open(p.payslipUrl, '_blank')}
                                        className="text-[10px] py-1 px-2.5 flex items-center gap-1 ml-auto"
                                      >
                                        <Download className="w-3 h-3" /> Download Payslip
                                      </Button>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground italic">Payslip PDF not generated</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </Card>
                    )}
                  </div>
                )}

                {/* Assigned Assets Tab Panel */}
                {activeTab === 'ASSET' && (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {isAssetsLoading ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {[1, 2, 3].map(n => (
                          <div key={n} className="p-4 border border-border bg-card rounded-xl space-y-3">
                            <div className="flex justify-between items-start gap-2">
                              <Skeleton className="h-5 w-24" />
                              <Skeleton className="h-4 w-12 rounded" />
                            </div>
                            <Skeleton className="h-3 w-16" />
                            <div className="pt-2.5 border-t border-border/40 flex justify-between items-center">
                              <Skeleton className="h-3.5 w-20" />
                              <Skeleton className="h-4 w-10 rounded-full" />
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : employeeAssets.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-16 text-center border border-dashed border-border rounded-2xl bg-muted/10">
                        <Cpu className="w-10 h-10 text-muted-foreground/45 mb-2.5" />
                        <p className="font-bold text-xs">No Assets Assigned</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5">Assign hardware/software assets under the assets tab.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                        {employeeAssets.map(asset => (
                          <Card key={asset._id} className="p-4 border border-border/80 bg-card/65 flex flex-col justify-between space-y-3">
                            <div>
                              <div className="flex justify-between items-start gap-2">
                                <h4 className="font-bold text-sm text-foreground truncate" title={asset.name}>
                                  {asset.name}
                                </h4>
                                <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded bg-muted border border-border text-muted-foreground">
                                  {asset.type}
                                </span>
                              </div>
                              <p className="text-[10px] text-muted-foreground font-mono mt-1">S/N: {asset.serialNumber}</p>
                              {asset.notes && (
                                <p className="text-[10px] text-muted-foreground/80 italic mt-2 line-clamp-2">
                                  Note: {asset.notes}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center justify-between pt-2.5 border-t border-border/40 text-[10px] text-muted-foreground font-semibold">
                              <span>Allocated Status:</span>
                              <span className="inline-flex px-2 py-0.5 rounded-full font-bold uppercase bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                {asset.status}
                              </span>
                            </div>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-center border border-dashed border-border rounded-2xl bg-muted/15">
              <FolderOpen className="w-16 h-16 text-muted-foreground/40 mb-3" />
              <p className="font-bold text-sm">Please Select a Staff Member</p>
              <p className="text-xs text-muted-foreground mt-0.5">Select an employee from the left sidebar directory to review and manage folders.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
