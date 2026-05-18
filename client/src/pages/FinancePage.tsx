import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeApi } from '../api_service/financeApi';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input } from '../Components/WrapperComponents/Input';
import { Wallet, TrendingDown, DollarSign, PlusCircle, ArrowUpRight, ArrowDownLeft, Calendar, UserCheck, FileText } from 'lucide-react';

export const FinancePage: React.FC = () => {
  const { role } = useAuthStore();
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'ALLOCATION' | 'EXPENSE'>('ALLOCATION');

  const [amount, setAmount] = useState('');
  const [categoryOrReason, setCategoryOrReason] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

  const { data, isLoading } = useQuery({
    queryKey: ['financeSummary'],
    queryFn: financeApi.getSummary,
  });

  const addMutation = useMutation({
    mutationFn: financeApi.addRecord,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['financeSummary'] });
      addToast(
        modalType === 'ALLOCATION' ? 'Budget Allocated' : 'Expense Logged',
        `Successfully recorded $${amount} for ${categoryOrReason}.`,
        'success'
      );
      setShowModal(false);
      setAmount('');
      setCategoryOrReason('');
      setDescription('');
    },
    onError: (err: any) => {
      addToast('Error', err.message || 'Failed to record transaction.', 'error');
    },
  });

  const handleOpenModal = (type: 'ALLOCATION' | 'EXPENSE') => {
    setModalType(type);
    setShowModal(true);
    setAmount('');
    setCategoryOrReason('');
    setDescription('');
    setDate(new Date().toISOString().split('T')[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      addToast('Invalid Amount', 'Please enter a valid positive number.', 'error');
      return;
    }
    if (!categoryOrReason.trim()) {
      addToast('Required Field', 'Please provide a category or reason.', 'error');
      return;
    }
    addMutation.mutate({
      type: modalType,
      amount: Number(amount),
      categoryOrReason,
      description,
      date,
    });
  };

  const summary = data?.summary || { totalAllocated: 0, totalSpent: 0, remainingBalance: 0 };
  const records = data?.records || [];

  return (
    <div className="p-6 space-y-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-6 rounded-2xl border border-border shadow-sm">
        <div className="text-left">
          <h1 className="text-2xl font-extrabold text-foreground tracking-tight flex items-center gap-2">
            <Wallet className="h-7 w-7 text-primary" />
            Office Maintenance & Finance Ledger
          </h1>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            Confidential ledger managed exclusively between ADMIN and HR Manager.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {role === 'ADMIN' && (
            <Button
              type="button"
              onClick={() => handleOpenModal('ALLOCATION')}
              className="bg-primary text-primary-foreground font-bold tracking-wider py-2.5 px-5 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all scale-[1.02]"
            >
              <PlusCircle className="w-5 h-5 mr-2" />
              ALLOCATE BUDGET 
            </Button>
          )}
          {role === 'HR' && (
            <Button
              type="button"
              onClick={() => handleOpenModal('EXPENSE')}
              className="bg-foreground text-background font-bold tracking-wider py-2.5 px-5 shadow-md hover:bg-foreground/90 transition-all scale-[1.02]"
            >
              <PlusCircle className="w-5 h-5 mr-2" />
              LOG MAINTENANCE EXPENSE 
            </Button>
          )}
        </div>
      </div>

      {/* Summary Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6 bg-card border border-border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden text-left">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <Wallet className="w-10 h-10 text-foreground" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <ArrowUpRight className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Allocated Budget</p>
              <p className="text-2xl font-black text-foreground mt-0.5">${summary.totalAllocated.toLocaleString()}</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground border-t border-border/50 pt-3 flex items-center justify-between">
            <span>Allocated by Admin</span>
            <span className="font-bold text-primary">100% Verified</span>
          </div>
        </Card>

        <Card className="p-6 bg-card border border-border shadow-sm hover:shadow-md transition-shadow relative overflow-hidden text-left">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <TrendingDown className="w-10 h-10 text-foreground" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-muted text-muted-foreground border border-border">
              <ArrowDownLeft className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Maintenance Expenses</p>
              <p className="text-2xl font-black text-foreground mt-0.5">${summary.totalSpent.toLocaleString()}</p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground border-t border-border/50 pt-3 flex items-center justify-between">
            <span>Updated & Logged by HR</span>
            <span className="font-semibold text-muted-foreground">Receipts Attached</span>
          </div>
        </Card>

        <Card className="p-6 bg-card border-2 border-primary/40 shadow-lg hover:shadow-xl transition-shadow relative overflow-hidden text-left bg-gradient-to-tr from-card to-primary/5">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <DollarSign className="w-10 h-10 text-primary" />
          </div>
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs font-bold text-primary uppercase tracking-wider">Remaining Available Balance</p>
              <p className={`text-3xl font-black mt-0.5 ${summary.remainingBalance < 0 ? 'text-red-500' : 'text-foreground'}`}>
                ${summary.remainingBalance.toLocaleString()}
              </p>
            </div>
          </div>
          <div className="text-xs text-muted-foreground border-t border-border/50 pt-3 flex items-center justify-between font-medium">
            <span>Available for future maintenance</span>
            <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold uppercase text-[10px] tracking-wider border border-primary/20 animate-pulse">
              Active Ledger
            </span>
          </div>
        </Card>
      </div>

      {/* Transaction Records Ledger */}
      <Card className="p-6 bg-card border border-border shadow-sm text-left">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground tracking-tight">Maintenance & Allocation Ledger History</h2>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">Comprehensive chronological audit trail of all financial adjustments.</p>
          </div>
          <span className="text-xs font-bold px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border uppercase tracking-wider">
            {records.length} Records Found
          </span>
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm font-semibold text-muted-foreground animate-pulse">
            Loading secure financial records...
          </div>
        ) : records.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-border rounded-2xl bg-muted/20">
            <Wallet className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm font-bold text-foreground">No Financial Records Logged Yet</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              Admin can allocate budget or HR can log maintenance expenses to begin populating the secure ledger.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border text-xs font-bold text-muted-foreground uppercase tracking-wider bg-muted/40">
                  <th className="py-3 px-4 rounded-l-xl">Transaction Type</th>
                  <th className="py-3 px-4">Amount</th>
                  <th className="py-3 px-4">Category / Reason</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 rounded-r-xl">Logged By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60 text-sm">
                {records.map((r) => (
                  <tr key={r._id} className="hover:bg-muted/30 transition-colors group">
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wider border ${
                          r.type === 'ALLOCATION'
                            ? 'bg-primary/10 text-primary border-primary/20 shadow-sm shadow-primary/5'
                            : 'bg-muted text-muted-foreground border-border'
                        }`}
                      >
                        {r.type === 'ALLOCATION' ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownLeft className="w-3.5 h-3.5" />}
                        {r.type === 'ALLOCATION' ? 'Budget Allocation' : 'Maintenance Expense'}
                      </span>
                    </td>
                    <td className="py-4 px-4 font-black text-base text-foreground tracking-tight">
                      ${r.amount.toLocaleString()}
                    </td>
                    <td className="py-4 px-4 font-bold text-foreground">
                      {r.categoryOrReason}
                    </td>
                    <td className="py-4 px-4 text-xs text-muted-foreground max-w-xs truncate" title={r.description}>
                      {r.description || <span className="italic opacity-50">No description provided</span>}
                    </td>
                    <td className="py-4 px-4 text-xs font-semibold text-muted-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-primary/70" />
                        {r.date}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-xs font-bold text-foreground whitespace-nowrap">
                      <div className="flex items-center gap-1.5 bg-muted/60 px-2.5 py-1 rounded-lg border border-border/80 w-fit">
                        <UserCheck className="w-3.5 h-3.5 text-primary" />
                        {r.loggedBy}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Allocation / Expense Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
          <Card className="w-full max-w-lg p-6 bg-card border border-border shadow-2xl rounded-2xl text-left animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-border mb-6">
              <div className="flex items-center gap-2.5">
                <div className={`p-2.5 rounded-xl text-white shadow-md ${modalType === 'ALLOCATION' ? 'bg-primary shadow-primary/30' : 'bg-foreground'}`}>
                  {modalType === 'ALLOCATION' ? <Wallet className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-foreground tracking-tight">
                    {modalType === 'ALLOCATION' ? 'Allocate Maintenance Budget' : 'Log Maintenance Expense'}
                  </h3>
                  <p className="text-xs text-muted-foreground font-medium mt-0.5">
                    {modalType === 'ALLOCATION' ? 'Add funds to the office maintenance pool.' : 'Record an expense against the allocated pool.'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <Input
                label="Amount ($)"
                type="number"
                placeholder="e.g. 1500"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
                min="1"
                step="any"
              />

              <Input
                label={modalType === 'ALLOCATION' ? 'Budget Category / Source' : 'Expense Category / Reason'}
                type="text"
                placeholder={modalType === 'ALLOCATION' ? 'e.g. Monthly Office Maintenance Budget' : 'e.g. AC Servicing & High-Speed Internet'}
                value={categoryOrReason}
                onChange={(e) => setCategoryOrReason(e.target.value)}
                required
              />

              <div>
                <label className="block text-xs font-bold text-foreground mb-1.5 uppercase tracking-wider">
                  Detailed Description (Optional)
                </label>
                <textarea
                  className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all min-h-[100px] resize-none"
                  placeholder="Provide additional breakdown, invoice numbers, or voucher details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <Input
                label="Date of Transaction"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  className="font-bold py-2.5 px-5"
                >
                  CANCEL
                </Button>
                <Button
                  type="submit"
                  isLoading={addMutation.isPending}
                  className={`font-bold tracking-wider py-2.5 px-6 shadow-lg ${
                    modalType === 'ALLOCATION'
                      ? 'bg-primary text-primary-foreground shadow-primary/20 hover:shadow-primary/30'
                      : 'bg-foreground text-background hover:bg-foreground/90'
                  }`}
                >
                  {modalType === 'ALLOCATION' ? 'CONFIRM ALLOCATION' : 'CONFIRM EXPENSE'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
};
