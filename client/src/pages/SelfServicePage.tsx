import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { selfServiceApi, type ReimbursementClaim, type AttendanceCorrectionRequest } from '../api_service/selfServiceApi';
import { employeeApi } from '../api_service/employeeApi';
import { authApi } from '../api_service/authApi';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input, Select } from '../Components/WrapperComponents/Input';
import { TableWrapper } from '../Components/WrapperComponents/TableWrapper';
import { Modal } from '../Components/WrapperComponents/Modal';
import { formatDate } from '../utils/formatters';
import {
  Receipt,
  CalendarDays,
  Plus,
  Upload,
  CheckCircle,
  Sparkles,
  Search,
  Eye,
  AlertCircle
} from 'lucide-react';

export const SelfServicePage: React.FC = () => {
  const { role } = useAuthStore();
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  // Tab State: 'reimbursement' | 'attendance'
  const [activeTab, setActiveTab] = useState<'reimbursement' | 'attendance'>('reimbursement');

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [empFilter, setEmpFilter] = useState<string>('');

  // Scanning State
  const [isScanning, setIsScanning] = useState(false);

  // Modal states
  const [showReimbModal, setShowReimbModal] = useState(false);
  const [showAttModal, setShowAttModal] = useState(false);
  const [showApproveModal, setShowApproveModal] = useState<{ id: string; type: 'reimbursement' | 'attendance'; approve: boolean } | null>(null);

  // File uploading states
  const [isUploading, setIsUploading] = useState(false);

  // Form States - Reimbursement
  const [reimbForm, setReimbForm] = useState({
    expenseDate: '',
    amount: '',
    category: 'TRAVEL' as ReimbursementClaim['category'],
    description: '',
    receiptUrl: '',
    employeeId: '',
  });

  // Form States - Attendance Correction
  const [attForm, setAttForm] = useState({
    attendanceDate: '',
    requestedLoginTime: '',
    requestedLogoutTime: '',
    reason: '',
    employeeId: '',
  });

  // Form States - Rejection Reason
  const [rejectionReason, setRejectionReason] = useState('');

  // Queries
  const { data: employees } = useQuery({
    queryKey: ['employees'],
    queryFn: () => employeeApi.getAll().then(res => res.employees),
    enabled: role === 'ADMIN' || role === 'HR',
  });

  const { data: reimbursements, isLoading: reimbLoading } = useQuery({
    queryKey: ['reimbursements', empFilter, statusFilter],
    queryFn: () => selfServiceApi.getReimbursements({
      employeeId: (role === 'EMPLOYEE' || role === 'INTERN') ? undefined : empFilter || undefined,
      status: statusFilter || undefined
    }),
  });

  const { data: attendanceCorrections, isLoading: attLoading } = useQuery({
    queryKey: ['attendanceCorrections', empFilter, statusFilter],
    queryFn: () => selfServiceApi.getAttendanceCorrections({
      employeeId: (role === 'EMPLOYEE' || role === 'INTERN') ? undefined : empFilter || undefined,
      status: statusFilter || undefined
    }),
  });

  // Helper to handle general file uploading
  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const url = await authApi.uploadImage(file);
      addToast('File Uploaded Successfully', 'The file has been uploaded to secure server storage.', 'success');
      setReimbForm(prev => ({ ...prev, receiptUrl: url }));
    } catch (err: any) {
      addToast('Upload Failed', err.message || 'Could not upload file.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  // OCR Scanner Mutation
  const handleOcrScan = async () => {
    if (!reimbForm.receiptUrl) {
      addToast('No Receipt Uploaded', 'Please upload a receipt image first.', 'warning');
      return;
    }
    setIsScanning(true);
    try {
      // Simulate real-time progress for wow effect
      await new Promise(resolve => setTimeout(resolve, 1500));
      const extracted = await selfServiceApi.scanReceipt(reimbForm.receiptUrl);
      
      setReimbForm(prev => ({
        ...prev,
        amount: extracted.amount ? String(extracted.amount) : prev.amount,
        expenseDate: extracted.date ? extracted.date.split('T')[0] : prev.expenseDate,
        category: (extracted.category?.toUpperCase() as any) || prev.category,
        description: extracted.description || extracted.merchantName || prev.description
      }));
      addToast('Receipt Scanned with AI', 'Details successfully extracted and populated.', 'success');
    } catch (err: any) {
      addToast('OCR Scan Failed', 'AI could not read receipt details clearly.', 'error');
    } finally {
      setIsScanning(false);
    }
  };

  // Create Mutations
  const createReimbMutation = useMutation({
    mutationFn: selfServiceApi.createReimbursement,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reimbursements'] });
      addToast('Reimbursement Submitted', 'Your expense claim has been filed successfully.', 'success');
      setShowReimbModal(false);
      setReimbForm({
        expenseDate: '',
        amount: '',
        category: 'TRAVEL',
        description: '',
        receiptUrl: '',
        employeeId: '',
      });
    },
    onError: (err: any) => {
      addToast('Submission Failed', err.message || 'Could not submit claim.', 'error');
    }
  });

  const createAttMutation = useMutation({
    mutationFn: selfServiceApi.createAttendanceCorrection,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendanceCorrections'] });
      addToast('Correction Requested', 'Correction request has been submitted for review.', 'success');
      setShowAttModal(false);
      setAttForm({
        attendanceDate: '',
        requestedLoginTime: '',
        requestedLogoutTime: '',
        reason: '',
        employeeId: '',
      });
    },
    onError: (err: any) => {
      addToast('Request Failed', err.message || 'Could not request correction.', 'error');
    }
  });

  // Approval Mutations
  const approveReimbMutation = useMutation({
    mutationFn: ({ id, status, rejectionReason }: { id: string; status: 'APPROVED' | 'REJECTED'; rejectionReason?: string }) =>
      selfServiceApi.approveReimbursement(id, status, rejectionReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reimbursements'] });
      addToast('Action Completed', 'Reimbursement claim status updated successfully.', 'success');
      setShowApproveModal(null);
      setRejectionReason('');
    },
    onError: (err: any) => {
      addToast('Action Failed', err.message || 'Could not update claim status.', 'error');
    }
  });

  const approveAttMutation = useMutation({
    mutationFn: ({ id, status, rejectionReason }: { id: string; status: 'APPROVED' | 'REJECTED'; rejectionReason?: string }) =>
      selfServiceApi.approveAttendanceCorrection(id, status, rejectionReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendanceCorrections'] });
      addToast('Action Completed', 'Attendance correction status updated successfully.', 'success');
      setShowApproveModal(null);
      setRejectionReason('');
    },
    onError: (err: any) => {
      addToast('Action Failed', err.message || 'Could not update correction status.', 'error');
    }
  });

  const handleApproveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!showApproveModal) return;

    const { id, type, approve } = showApproveModal;
    const status = approve ? 'APPROVED' : 'REJECTED';

    if (type === 'reimbursement') {
      approveReimbMutation.mutate({ id, status, rejectionReason });
    } else if (type === 'attendance') {
      approveAttMutation.mutate({ id, status, rejectionReason });
    }
  };

  const getStatusBadge = (status: ReimbursementClaim['status']) => {
    const map: Record<typeof status, string> = {
      APPROVED: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25',
      REJECTED: 'bg-rose-500/10 text-rose-500 border-rose-500/25',
      PENDING: 'bg-amber-500/10 text-amber-500 border-amber-500/25',
      CANCELLED: 'bg-slate-500/10 text-slate-500 border-slate-500/25'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${map[status] || map.PENDING}`}>
        {status}
      </span>
    );
  };

  const isHRAdmin = role === 'ADMIN' || role === 'HR';

  // Table Columns - Reimbursement
  const reimbColumns = [
    ...(isHRAdmin
      ? [{
          header: 'Employee',
          accessor: (row: ReimbursementClaim) => {
            const emp = typeof row.employeeId === 'object' ? row.employeeId : null;
            return (
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-foreground block">{emp?.fullName || 'Employee'}</span>
                {emp?.employeeCode && !emp.employeeCode.startsWith('TEMP-EMP-') && (
                  <span className="text-[10px] text-muted-foreground font-mono">({emp.employeeCode})</span>
                )}
              </div>
            );
          }
        }]
      : []),
    { header: 'Category', accessor: (row: ReimbursementClaim) => <span className="font-semibold text-xs">{row.category}</span> },
    { header: 'Amount', accessor: (row: ReimbursementClaim) => <span className="font-bold font-mono text-xs text-primary">${row.amount.toFixed(2)}</span> },
    { header: 'Claim Date', accessor: (row: ReimbursementClaim) => <span className="font-mono text-[11px]">{formatDate(row.expenseDate)}</span> },
    { header: 'Description', accessor: (row: ReimbursementClaim) => <span className="text-xs truncate max-w-[200px] block">{row.description}</span> },
    {
      header: 'Receipt',
      accessor: (row: ReimbursementClaim) =>
        row.receiptUrl ? (
          <a href={row.receiptUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline text-xs flex items-center gap-1">
            <Eye className="w-3.5 h-3.5" /> View
          </a>
        ) : (
          <span className="text-muted-foreground text-xs italic">No receipt</span>
        )
    },
    { header: 'Status', accessor: (row: ReimbursementClaim) => getStatusBadge(row.status) },
    ...(isHRAdmin
      ? [{
          header: 'Actions',
          accessor: (row: ReimbursementClaim) =>
            row.status === 'PENDING' ? (
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline" className="px-2.5 py-1 text-[11px] h-auto border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10" onClick={() => setShowApproveModal({ id: row._id, type: 'reimbursement', approve: true })}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" className="px-2.5 py-1 text-[11px] h-auto border-rose-500/30 text-rose-500 hover:bg-rose-500/10" onClick={() => setShowApproveModal({ id: row._id, type: 'reimbursement', approve: false })}>
                  Reject
                </Button>
              </div>
            ) : row.status === 'REJECTED' && row.rejectionReason ? (
              <span className="text-[10px] text-rose-400 italic truncate max-w-[120px] block" title={row.rejectionReason}>Reason: {row.rejectionReason}</span>
            ) : (
              <span className="text-[10px] text-muted-foreground italic">Processed</span>
            )
        }]
      : [{
          header: 'Rejection Details',
          accessor: (row: ReimbursementClaim) =>
            row.status === 'REJECTED' && row.rejectionReason ? (
              <span className="text-xs text-rose-400 italic">{row.rejectionReason}</span>
            ) : (
              <span className="text-xs text-muted-foreground italic">-</span>
            )
        }])
  ];



  // Table Columns - Attendance Correction
  const attColumns = [
    ...(isHRAdmin
      ? [{
          header: 'Employee',
          accessor: (row: AttendanceCorrectionRequest) => {
            const emp = typeof row.employeeId === 'object' ? row.employeeId : null;
            return (
              <div className="flex items-center gap-2">
                <span className="font-bold text-xs text-foreground block">{emp?.fullName || 'Employee'}</span>
                {emp?.employeeCode && !emp.employeeCode.startsWith('TEMP-EMP-') && (
                  <span className="text-[10px] text-muted-foreground font-mono">({emp.employeeCode})</span>
                )}
              </div>
            );
          }
        }]
      : []),
    { header: 'Target Date', accessor: (row: AttendanceCorrectionRequest) => <span className="font-mono text-xs">{formatDate(row.attendanceDate)}</span> },
    {
      header: 'Requested Time',
      accessor: (row: AttendanceCorrectionRequest) => {
        const inStr = new Date(row.requestedLoginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const outStr = new Date(row.requestedLogoutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return (
          <div className="text-xs font-mono">
            <span>{inStr} - {outStr}</span>
          </div>
        );
      }
    },
    { header: 'Reason', accessor: (row: AttendanceCorrectionRequest) => <span className="text-xs max-w-[200px] truncate block">{row.reason}</span> },
    { header: 'Status', accessor: (row: AttendanceCorrectionRequest) => getStatusBadge(row.status) },
    ...(isHRAdmin
      ? [{
          header: 'Actions',
          accessor: (row: AttendanceCorrectionRequest) =>
            row.status === 'PENDING' ? (
              <div className="flex items-center gap-1.5">
                <Button size="sm" variant="outline" className="px-2.5 py-1 text-[11px] h-auto border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/10" onClick={() => setShowApproveModal({ id: row._id, type: 'attendance', approve: true })}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" className="px-2.5 py-1 text-[11px] h-auto border-rose-500/30 text-rose-500 hover:bg-rose-500/10" onClick={() => setShowApproveModal({ id: row._id, type: 'attendance', approve: false })}>
                  Reject
                </Button>
              </div>
            ) : row.status === 'REJECTED' && row.rejectionReason ? (
              <span className="text-[10px] text-rose-400 italic truncate max-w-[120px] block" title={row.rejectionReason}>Reason: {row.rejectionReason}</span>
            ) : (
              <span className="text-[10px] text-muted-foreground italic">Processed</span>
            )
        }]
      : [{
          header: 'Rejection Details',
          accessor: (row: AttendanceCorrectionRequest) =>
            row.status === 'REJECTED' && row.rejectionReason ? (
              <span className="text-xs text-rose-400 italic">{row.rejectionReason}</span>
            ) : (
              <span className="text-xs text-muted-foreground italic">-</span>
            )
        }])
  ];

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      {/* Title block */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Receipt className="w-6 h-6 text-primary" />
            Self Service Center
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Submit reimbursement claims, file tax declarations, and request attendance corrections in one portal
          </p>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          {activeTab === 'reimbursement' && (
            <Button onClick={() => setShowReimbModal(true)} className="flex items-center gap-1.5 shadow-lg">
              <Plus className="w-4 h-4" /> New Claim
            </Button>
          )}
          {activeTab === 'attendance' && (
            <Button onClick={() => setShowAttModal(true)} className="flex items-center gap-1.5 shadow-lg">
              <Plus className="w-4 h-4" /> Request Correction
            </Button>
          )}
        </div>
      </div>

      {/* Tabs list */}
      <div className="flex border-b border-border gap-2">
        <button
          onClick={() => { setActiveTab('reimbursement'); setStatusFilter(''); }}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all duration-200 ${
            activeTab === 'reimbursement'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
          }`}
        >
          <Receipt className="w-4 h-4" />
          Reimbursements
        </button>
        <button
          onClick={() => { setActiveTab('attendance'); setStatusFilter(''); }}
          className={`flex items-center gap-2 px-5 py-3 border-b-2 font-semibold text-sm transition-all duration-200 ${
            activeTab === 'attendance'
              ? 'border-primary text-primary bg-primary/5'
              : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Attendance Corrections
        </button>
      </div>

      {/* Main card panel with filters */}
      <Card className="border-l-4 border-l-primary shadow-md p-6 space-y-6">
        {isHRAdmin && (
          <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border">
            <div className="flex-1 w-full relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <select
                value={empFilter}
                onChange={(e) => setEmpFilter(e.target.value)}
                className="w-full h-10 bg-background text-foreground border border-border rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <option value="">Filter by employee (Show All)...</option>
                {employees?.map((emp) => (
                  <option key={emp._id} value={emp._id}>
                    {emp.fullName} {emp.employeeCode && !emp.employeeCode.startsWith('TEMP-EMP-') ? `(${emp.employeeCode})` : ''} - {emp.designation}
                  </option>
                ))}
              </select>
            </div>
            
            <div className="w-full sm:w-64">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full h-10 bg-background text-foreground border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors disabled:opacity-50 cursor-pointer"
              >
                <option value="">Filter by status (Show All)...</option>
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>
        )}

        {/* Display loading cards */}
        {((activeTab === 'reimbursement' && reimbLoading) ||
          (activeTab === 'attendance' && attLoading)) ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-xs font-semibold uppercase tracking-wider">Loading Requests...</p>
          </div>
        ) : (
          <div>
            {activeTab === 'reimbursement' && (
              <TableWrapper
                columns={reimbColumns}
                data={reimbursements || []}
              />
            )}
            {activeTab === 'attendance' && (
              <TableWrapper
                columns={attColumns}
                data={attendanceCorrections || []}
              />
            )}
          </div>
        )}
      </Card>

      {/* Modal - New Reimbursement Claim */}
      <Modal
        isOpen={showReimbModal}
        onClose={() => setShowReimbModal(false)}
        title="Submit Reimbursement Claim"
        maxWidth="max-w-md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createReimbMutation.mutate({
              expenseDate: new Date(reimbForm.expenseDate).toISOString(),
              amount: parseFloat(reimbForm.amount),
              category: reimbForm.category,
              description: reimbForm.description,
              receiptUrl: reimbForm.receiptUrl || undefined,
              employeeId: isHRAdmin ? reimbForm.employeeId || undefined : undefined
            });
          }}
          className="space-y-4"
        >
          {isHRAdmin && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Target Employee *</label>
              <select
                value={reimbForm.employeeId}
                onChange={(e) => setReimbForm(p => ({ ...p, employeeId: e.target.value }))}
                className="w-full h-10 bg-background text-foreground border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors disabled:opacity-50"
                required
              >
                <option value="">Select Employee...</option>
                {employees?.map((emp) => (
                  <option key={emp._id} value={emp._id}>{emp.fullName}</option>
                ))}
              </select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Expense Date *"
              type="date"
              value={reimbForm.expenseDate}
              onChange={(e) => setReimbForm(p => ({ ...p, expenseDate: e.target.value }))}
              required
            />
            <Select
              label="Category *"
              value={reimbForm.category}
              onChange={(e) => setReimbForm(p => ({ ...p, category: e.target.value as any }))}
              options={[
                { value: 'TRAVEL', label: 'Travel & Commute' },
                { value: 'MEDICAL', label: 'Medical & Healthcare' },
                { value: 'FOOD', label: 'Food & Meals' },
                { value: 'EQUIPMENT', label: 'Office Equipment' },
                { value: 'OTHER', label: 'Other Expenses' },
              ]}
            />
          </div>

          <Input
            label="Claim Amount ($) *"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={reimbForm.amount}
            onChange={(e) => setReimbForm(p => ({ ...p, amount: e.target.value }))}
            required
          />

          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase">Description *</label>
            <textarea
              value={reimbForm.description}
              onChange={(e) => setReimbForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Provide a detailed explanation of the expense..."
              className="w-full h-24 bg-background text-foreground border border-border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors disabled:opacity-50 resize-none"
              required
            />
          </div>

          {/* Receipt Upload & Scan */}
          <div className="space-y-2.5">
            <label className="text-xs font-bold text-muted-foreground uppercase block">Receipt Proof</label>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border hover:bg-muted text-xs font-medium cursor-pointer transition-colors">
                <Upload className="w-4 h-4 text-muted-foreground" />
                <span>{isUploading ? 'Uploading...' : reimbForm.receiptUrl ? 'Change Receipt' : 'Upload Receipt'}</span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  disabled={isUploading}
                />
              </label>

              {reimbForm.receiptUrl && (
                <Button
                  type="button"
                  onClick={handleOcrScan}
                  isLoading={isScanning}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs py-2 px-3 flex items-center gap-1.5 shadow-md shadow-indigo-600/10"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Auto Scan receipt
                </Button>
              )}
            </div>

            {reimbForm.receiptUrl && (
              <p className="text-[10px] text-emerald-500 font-medium truncate">
                Attached: {reimbForm.receiptUrl}
              </p>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" type="button" onClick={() => setShowReimbModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createReimbMutation.isPending} disabled={isUploading || isScanning}>
              Submit Claim
            </Button>
          </div>
        </form>
      </Modal>



      {/* Modal - New Attendance Correction */}
      <Modal
        isOpen={showAttModal}
        onClose={() => setShowAttModal(false)}
        title="Request Attendance Correction"
        maxWidth="max-w-md"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            createAttMutation.mutate({
              attendanceDate: attForm.attendanceDate,
              requestedLoginTime: new Date(`${attForm.attendanceDate}T${attForm.requestedLoginTime}`).toISOString(),
              requestedLogoutTime: new Date(`${attForm.attendanceDate}T${attForm.requestedLogoutTime}`).toISOString(),
              reason: attForm.reason,
              employeeId: isHRAdmin ? attForm.employeeId || undefined : undefined
            });
          }}
          className="space-y-4"
        >
          {isHRAdmin && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Target Employee *</label>
              <select
                value={attForm.employeeId}
                onChange={(e) => setAttForm(p => ({ ...p, employeeId: e.target.value }))}
                className="w-full h-10 bg-background text-foreground border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors disabled:opacity-50"
                required
              >
                <option value="">Select Employee...</option>
                {employees?.map((emp) => (
                  <option key={emp._id} value={emp._id}>{emp.fullName}</option>
                ))}
              </select>
            </div>
          )}

          <Input
            label="Correction Target Date *"
            type="date"
            value={attForm.attendanceDate}
            onChange={(e) => setAttForm(p => ({ ...p, attendanceDate: e.target.value }))}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Requested Check-In *"
              type="time"
              value={attForm.requestedLoginTime}
              onChange={(e) => setAttForm(p => ({ ...p, requestedLoginTime: e.target.value }))}
              required
            />
            <Input
              label="Requested Check-Out *"
              type="time"
              value={attForm.requestedLogoutTime}
              onChange={(e) => setAttForm(p => ({ ...p, requestedLogoutTime: e.target.value }))}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-muted-foreground uppercase">Correction Reason *</label>
            <textarea
              value={attForm.reason}
              onChange={(e) => setAttForm(p => ({ ...p, reason: e.target.value }))}
              placeholder="e.g. Forgot to clock in, out-of-office client meet, internet breakdown..."
              className="w-full h-24 bg-background text-foreground border border-border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors disabled:opacity-50 resize-none"
              required
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" type="button" onClick={() => setShowAttModal(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={createAttMutation.isPending}>
              Send Request
            </Button>
          </div>
        </form>
      </Modal>

      {/* Modal - Approve/Reject with Reason Option */}
      <Modal
        isOpen={!!showApproveModal}
        onClose={() => { setShowApproveModal(null); setRejectionReason(''); }}
        title={showApproveModal?.approve ? 'Confirm Request Approval' : 'Provide Rejection Explanation'}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleApproveSubmit} className="space-y-4">
          <div className="flex items-start gap-3 p-4 bg-muted/40 rounded-xl border border-border">
            {showApproveModal?.approve ? (
              <>
                <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold">Approve this request?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">This will transition the record status to approved, updating employee ledger records in real-time.</p>
                </div>
              </>
            ) : (
              <>
                <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold">Reject this request?</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Please provide a clear reason why this request is being rejected so the employee knows how to amend it.</p>
                </div>
              </>
            )}
          </div>

          {!showApproveModal?.approve && (
            <div className="space-y-1">
              <label className="text-xs font-bold text-muted-foreground uppercase">Rejection Reason *</label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Reason why this request was declined..."
                className="w-full h-24 bg-background text-foreground border border-border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 transition-colors disabled:opacity-50 resize-none"
                required
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" type="button" onClick={() => { setShowApproveModal(null); setRejectionReason(''); }}>
              Cancel
            </Button>
            <Button
              type="submit"
              className={showApproveModal?.approve ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'}
              isLoading={approveReimbMutation.isPending || approveAttMutation.isPending}
            >
              {showApproveModal?.approve ? 'Yes, Approve' : 'Submit Rejection'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
