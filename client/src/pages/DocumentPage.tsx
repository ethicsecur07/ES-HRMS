import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { documentApi, type HRDocument } from '../api_service/documentApi';
import { employeeApi } from '../api_service/employeeApi';
import { authApi } from '../api_service/authApi';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input, Select } from '../Components/WrapperComponents/Input';
import { Modal } from '../Components/WrapperComponents/Modal';
import { formatDate } from '../utils/formatters';
import {
  FolderOpen,
  FileText,
  Search,
  Plus,
  Upload,
  Download,
  Calendar,
  History,
  AlertTriangle,
  User,
  Tags,
  FileCheck
} from 'lucide-react';

export const DocumentPage: React.FC = () => {
  const { role } = useAuthStore();
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  const isHRAdmin = role === 'ADMIN' || role === 'HR';

  // Filters State
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [employeeFilter, setEmployeeFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Version History Toggle State
  const [expandedDocs, setExpandedDocs] = useState<Record<string, boolean>>({});

  // Modal States
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showVersionModal, setShowVersionModal] = useState<string | null>(null);

  // File Upload State
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgressUrl, setUploadProgressUrl] = useState('');

  // Form State - New Document
  const [docForm, setDocForm] = useState({
    employeeId: '',
    name: '',
    category: 'CONTRACT' as HRDocument['category'],
    fileUrl: '',
    expiresAt: '',
    signatureStatus: 'NOT_REQUIRED' as HRDocument['signatureStatus'],
  });

  // Queries
  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeApi.getAll().then(res => res.employees),
    enabled: isHRAdmin,
  });

  const { data: documents, isLoading } = useQuery({
    queryKey: ['documents', employeeFilter, selectedCategory],
    queryFn: () => documentApi.getDocuments({
      employeeId: isHRAdmin ? employeeFilter || undefined : undefined,
      category: selectedCategory === 'ALL' ? undefined : selectedCategory
    }),
  });

  // Mutations
  const uploadDocMutation = useMutation({
    mutationFn: documentApi.uploadDocument,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      addToast('Document Registered', 'New document has been successfully saved to index.', 'success');
      setShowUploadModal(false);
      setDocForm({
        employeeId: '',
        name: '',
        category: 'CONTRACT',
        fileUrl: '',
        expiresAt: '',
        signatureStatus: 'NOT_REQUIRED',
      });
      setUploadProgressUrl('');
    },
    onError: (err: any) => {
      addToast('Registration Failed', err.message || 'Could not upload document.', 'error');
    }
  });

  const addVersionMutation = useMutation({
    mutationFn: ({ id, fileUrl }: { id: string; fileUrl: string }) => documentApi.addVersion(id, fileUrl),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      addToast('New Version Added', 'Version index incremented successfully.', 'success');
      setShowVersionModal(null);
      setUploadProgressUrl('');
    },
    onError: (err: any) => {
      addToast('Version Upload Failed', err.message || 'Could not upload version.', 'error');
    }
  });

  // Handle Cloudinary Upload
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const url = await authApi.uploadImage(file);
      addToast('File Securely Uploaded', 'Document reference saved.', 'success');
      setUploadProgressUrl(url);
      setDocForm(prev => ({ ...prev, fileUrl: url }));
    } catch (err: any) {
      addToast('Upload Failed', err.message || 'Could not upload file.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (id: string) => {
    try {
      const data = await documentApi.downloadDocument(id);
      window.open(data.fileUrl, '_blank');
      addToast('Download Initiated', `Opening: ${data.name}`, 'success');
    } catch (err: any) {
      addToast('Download Failed', err.message || 'Access denied or link expired.', 'error');
    }
  };

  // Toggle Version view
  const toggleVersions = (id: string) => {
    setExpandedDocs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Filter categories helper
  const categoriesList = [
    { value: 'ALL', label: 'All Folders' },
    { value: 'CONTRACT', label: 'Contracts' },
    { value: 'PASSPORT', label: 'Passports' },
    { value: 'VISA', label: 'Visas' },
    { value: 'ID_PROOF', label: 'ID Proofs' },
    { value: 'CERTIFICATE', label: 'Certificates' },
    { value: 'OTHER', label: 'Others' },
  ];

  // Dynamic filter for client-side search query
  const filteredDocuments = useMemo(() => {
    if (!documents) return [];
    return documents.filter(doc =>
      doc.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [documents, searchQuery]);

  // Expiration Checker
  const getExpirationStatus = (expiresAtStr?: string) => {
    if (!expiresAtStr) return null;
    const expiresAt = new Date(expiresAtStr);
    const today = new Date();
    const diffTime = expiresAt.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return { text: 'Expired', style: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };
    }
    if (diffDays <= 30) {
      return { text: `Expires in ${diffDays}d`, style: 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse' };
    }
    return { text: `Valid until ${formatDate(expiresAtStr)}`, style: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' };
  };

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      {/* Title & Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <FolderOpen className="w-6 h-6 text-primary" />
            Document Management
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Store, catalog, trace revisions, and track expiration of critical organizational agreements
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <Button onClick={() => setShowUploadModal(true)} className="flex items-center gap-1.5 shadow-lg">
            <Plus className="w-4 h-4" /> Upload Document
          </Button>
        </div>
      </div>

      {/* Main Dual Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
        {/* Left Side Folder Categories */}
        <div className="space-y-4">
          <Card className="p-4 space-y-1 bg-card/60 backdrop-blur-sm border border-border/80">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-3 mb-2 flex items-center gap-1">
              <Tags className="w-3.5 h-3.5" /> File Folders
            </p>
            {categoriesList.map(cat => (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-between transition-all duration-200 ${
                  selectedCategory === cat.value
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/10'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <span>{cat.label}</span>
                {selectedCategory === cat.value && <div className="w-1.5 h-1.5 rounded-full bg-primary-foreground" />}
              </button>
            ))}
          </Card>

          {isHRAdmin && (
            <Card className="p-4 space-y-3 bg-card/60 backdrop-blur-sm border border-border/80">
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> Employee Filter
              </p>
              <select
                value={employeeFilter}
                onChange={(e) => setEmployeeFilter(e.target.value)}
                className="w-full bg-background text-foreground border border-border rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
              >
                <option value="">All Employees</option>
                {employees?.map(emp => (
                  <option key={emp._id} value={emp._id}>{emp.fullName}</option>
                ))}
              </select>
            </Card>
          )}
        </div>

        {/* Right Side File Grid */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-4 top-3.5 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search documents by filename..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-11 py-3 text-sm rounded-2xl bg-card"
            />
          </div>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
              <p className="text-xs font-bold uppercase tracking-widest">Loading Document Registry...</p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border rounded-2xl bg-muted/10">
              <FileText className="w-12 h-12 text-muted-foreground/45 mb-3" />
              <p className="font-bold text-sm">No Documents Found</p>
              <p className="text-xs text-muted-foreground mt-0.5">Upload a new document or modify your filters to begin.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredDocuments.map(doc => {
                const isExp = getExpirationStatus(doc.expiresAt);
                const isExpanded = !!expandedDocs[doc._id];
                const empName = typeof doc.employeeId === 'object' ? doc.employeeId.fullName : 'Employee';

                return (
                  <Card key={doc._id} className="border border-border/80 bg-card hover:shadow-md transition-all duration-200 p-5 flex flex-col justify-between space-y-4 relative group">
                    {/* Header info */}
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-bold text-sm text-foreground tracking-tight group-hover:text-primary transition-colors pr-8 leading-snug truncate" title={doc.name}>
                          {doc.name}
                        </h4>
                        <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 absolute right-5 top-5">
                          v{doc.version}
                        </span>
                      </div>
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 font-medium">
                        <span className="uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted font-bold text-[9px] border border-border">{doc.category}</span>
                        {isHRAdmin && <span>• Owned by: <strong className="text-foreground">{empName}</strong></span>}
                      </p>
                    </div>

                    {/* Expiration and signatures statuses */}
                    <div className="flex flex-wrap items-center gap-2 text-[10px]">
                      {isExp && (
                        <span className={`px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1 ${isExp.style}`}>
                          <Calendar className="w-3 h-3" />
                          {isExp.text}
                        </span>
                      )}

                      <span className={`px-2.5 py-0.5 rounded-full font-bold border flex items-center gap-1 ${
                        doc.signatureStatus === 'SIGNED'
                          ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                          : doc.signatureStatus === 'PENDING'
                          ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 animate-pulse'
                          : 'bg-muted text-muted-foreground border-border/60'
                      }`}>
                        <FileCheck className="w-3 h-3" />
                        {doc.signatureStatus === 'SIGNED' ? 'Signed' : doc.signatureStatus === 'PENDING' ? 'Signature Pending' : 'No Signature Required'}
                      </span>
                    </div>

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 pt-2 border-t border-border/50">
                      <Button size="sm" onClick={() => handleDownload(doc._id)} className="flex-1 text-xs py-1.5 px-3 flex items-center justify-center gap-1">
                        <Download className="w-3.5 h-3.5" /> Download
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setShowVersionModal(doc._id)} className="text-xs py-1.5 px-3 flex items-center justify-center gap-1 border-border/60">
                        <Upload className="w-3.5 h-3.5" /> New Version
                      </Button>
                      
                      {/* Revision timeline toggle */}
                      {doc.versions && doc.versions.length > 0 && (
                        <button
                          onClick={() => toggleVersions(doc._id)}
                          className="p-1.5 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-200"
                          title="View Revisions History"
                        >
                          <History className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Expanded Version list timeline */}
                    {isExpanded && doc.versions && (
                      <div className="mt-3 pt-3 border-t border-dashed border-border space-y-2.5 bg-muted/20 p-3 rounded-xl">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                          <History className="w-3 h-3" /> Revisions Timeline
                        </p>
                        <div className="space-y-3 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[1px] before:bg-border/60">
                          {doc.versions.map((ver) => {
                            const uploaderName = typeof ver.uploadedBy === 'object' ? ver.uploadedBy.name : 'System';
                            return (
                              <div key={ver.version} className="flex items-start gap-3 pl-5 relative">
                                <div className="absolute left-[5px] top-[5px] w-1.5 h-1.5 rounded-full bg-primary border border-background z-10" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-foreground">Version {ver.version}</span>
                                    <span className="text-[9px] text-muted-foreground font-mono">{new Date(ver.uploadedAt).toLocaleDateString()}</span>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                                    Uploaded by: <strong className="text-foreground">{uploaderName}</strong>
                                  </p>
                                  <a href={ver.fileUrl} target="_blank" rel="noreferrer" className="text-[10px] text-primary hover:underline font-mono mt-0.5 block truncate">
                                    {ver.fileUrl}
                                  </a>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal - Upload Document */}
      <Modal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        title="Upload HR Document"
        maxWidth="max-w-md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            uploadDocMutation.mutate({
              name: docForm.name,
              category: docForm.category,
              fileUrl: docForm.fileUrl,
              expiresAt: docForm.expiresAt ? new Date(docForm.expiresAt).toISOString() : undefined,
              signatureStatus: docForm.signatureStatus,
              employeeId: isHRAdmin ? docForm.employeeId || undefined : undefined
            });
          }}
          className="space-y-4"
        >
          {isHRAdmin && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Target Employee *</label>
              <select
                value={docForm.employeeId}
                onChange={(e) => setDocForm(p => ({ ...p, employeeId: e.target.value }))}
                className="w-full bg-background text-foreground border border-border rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                required
              >
                <option value="">Select Employee...</option>
                {employees?.map(emp => (
                  <option key={emp._id} value={emp._id}>{emp.fullName}</option>
                ))}
              </select>
            </div>
          )}

          <Input
            label="Document Label / Name *"
            placeholder="e.g. Visa_Renewal_2026.pdf"
            value={docForm.name}
            onChange={(e) => setDocForm(p => ({ ...p, name: e.target.value }))}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Document Category *"
              value={docForm.category}
              onChange={(e) => setDocForm(p => ({ ...p, category: e.target.value as any }))}
              options={[
                { value: 'CONTRACT', label: 'Contract Agreement' },
                { value: 'PASSPORT', label: 'Passport Copy' },
                { value: 'VISA', label: 'Visa & Residency' },
                { value: 'ID_PROOF', label: 'National ID Proof' },
                { value: 'CERTIFICATE', label: 'Certificates & Degrees' },
                { value: 'OTHER', label: 'Other Document' },
              ]}
            />

            <Select
              label="Signature Obligation *"
              value={docForm.signatureStatus}
              onChange={(e) => setDocForm(p => ({ ...p, signatureStatus: e.target.value as any }))}
              options={[
                { value: 'NOT_REQUIRED', label: 'No Signature Required' },
                { value: 'PENDING', label: 'Require Signature' },
              ]}
            />
          </div>

          <Input
            label="Expiration Date"
            type="date"
            value={docForm.expiresAt}
            onChange={(e) => setDocForm(p => ({ ...p, expiresAt: e.target.value }))}
          />

          {/* Uploader UI */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase block">Upload File *</label>
            <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-xs font-medium cursor-pointer transition-colors w-max">
              <Upload className="w-4 h-4 text-muted-foreground" />
              <span>{isUploading ? 'Uploading Reference...' : uploadProgressUrl ? 'File Uploaded' : 'Choose Document File'}</span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                disabled={isUploading}
              />
            </label>

            {uploadProgressUrl && (
              <p className="text-[10px] text-emerald-500 font-medium truncate">
                Secure link: {uploadProgressUrl}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" type="button" onClick={() => setShowUploadModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={uploadDocMutation.isPending} disabled={isUploading || !docForm.fileUrl}>
              Upload Reference
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal - Upload New Version */}
      <Modal
        isOpen={!!showVersionModal}
        onClose={() => { setShowVersionModal(null); setUploadProgressUrl(''); }}
        title="Upload Document Revision"
        maxWidth="max-w-md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (showVersionModal) {
              addVersionMutation.mutate({
                id: showVersionModal,
                fileUrl: uploadProgressUrl
              });
            }
          }}
          className="space-y-4"
        >
          <div className="flex items-start gap-3 p-4 bg-muted/40 rounded-xl border border-border text-xs">
            <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Revising Existing File</p>
              <p className="text-muted-foreground mt-0.5">Uploading a new file will automatically increment the document's version number by 1, preserving the historical changes and authorship.</p>
            </div>
          </div>

          {/* Version uploader */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground uppercase block">Select Revised Document *</label>
            <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-xs font-medium cursor-pointer transition-colors w-max">
              <Upload className="w-4 h-4 text-muted-foreground" />
              <span>{isUploading ? 'Uploading Reference...' : uploadProgressUrl ? 'File Ready' : 'Choose New Version File'}</span>
              <input
                type="file"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
                disabled={isUploading}
              />
            </label>

            {uploadProgressUrl && (
              <p className="text-[10px] text-emerald-500 font-medium truncate">
                Attached secure link: {uploadProgressUrl}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" type="button" onClick={() => { setShowVersionModal(null); setUploadProgressUrl(''); }}>
              Cancel
            </Button>
            <Button type="submit" isLoading={addVersionMutation.isPending} disabled={isUploading || !uploadProgressUrl}>
              Apply Revision
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
