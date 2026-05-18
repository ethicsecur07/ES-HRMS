import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { attendanceApi } from '../api_service/attendanceApi';
import { employeeApi } from '../api_service/employeeApi';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input, Select } from '../Components/WrapperComponents/Input';
import { TableWrapper } from '../Components/WrapperComponents/TableWrapper';
import { Modal } from '../Components/WrapperComponents/Modal';
import type { Attendance } from '../types';
import { exportAttendanceExcel } from '../utils/exportUtils';
import { formatDate } from '../utils/formatters';
import { CalendarCheck, Download, Wifi, Edit } from 'lucide-react';

export const AttendancePage: React.FC = () => {
  const { role } = useAuthStore();
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  const [nameFilter, setNameFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Editing State
  const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null);
  const [loginTimeInput, setLoginTimeInput] = useState('');
  const [logoutTimeInput, setLogoutTimeInput] = useState('');
  const [statusInput, setStatusInput] = useState<Attendance['status']>('OFFICE');

  const { data: attendances, isLoading: attLoading } = useQuery({
    queryKey: ['attendances'],
    queryFn: attendanceApi.getAll,
  });

  const { data: employees, isLoading: empLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: employeeApi.getAll,
  });

  const filteredAttendances = useMemo(() => {
    if (!attendances) return [];
    return attendances.filter((att) => {
      const empId = att.employeeId ? (typeof att.employeeId === 'object' ? att.employeeId._id : att.employeeId) : '';
      const emp = employees?.find((e) => e._id === empId);
      const empName = emp?.fullName || 'Logapriyan M';

      const matchName = empName.toLowerCase().includes(nameFilter.toLowerCase());
      const matchDate = !dateFilter || att.date === dateFilter;

      return matchName && matchDate;
    });
  }, [attendances, employees, nameFilter, dateFilter]);

  const formatDt = (dtStr?: string) => {
    if (!dtStr) return '';
    try {
      const d = new Date(dtStr);
      const tzoffset = d.getTimezoneOffset() * 60000;
      return new Date(d.getTime() - tzoffset).toISOString().slice(0, 16);
    } catch {
      return '';
    }
  };

  const handleEditClick = (row: Attendance) => {
    setEditingAttendance(row);
    setLoginTimeInput(formatDt(row.loginTime));
    setLogoutTimeInput(row.logoutTime ? formatDt(row.logoutTime) : '');
    setStatusInput(row.status);
  };

  const updateMutation = useMutation({
    mutationFn: (data: { id: string; loginTime?: string; logoutTime?: string; status?: string }) =>
      attendanceApi.update(data.id, { loginTime: data.loginTime, logoutTime: data.logoutTime, status: data.status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendances'] });
      addToast('Attendance Updated', 'Timestamps and status updated successfully.', 'success');
      setEditingAttendance(null);
    },
    onError: (err: any) => {
      addToast('Update Failed', err.message || 'Could not update attendance.', 'error');
    },
  });

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAttendance) return;
    updateMutation.mutate({
      id: editingAttendance._id,
      loginTime: loginTimeInput ? new Date(loginTimeInput).toISOString() : undefined,
      logoutTime: logoutTimeInput ? new Date(logoutTimeInput).toISOString() : undefined,
      status: statusInput,
    });
  };

  const columns = [
    {
      header: 'Employee',
      accessor: (row: Attendance) => {
        const emp = employees?.find((e) => e._id === (row.employeeId ? (typeof row.employeeId === 'object' ? row.employeeId._id : row.employeeId) : ''));
        return (
          <div className="flex items-center gap-3">
            <img src={emp?.profileImage || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150'} alt="" className="w-8 h-8 rounded-full object-cover border border-border flex-shrink-0" />
            <div>
              <p className="font-bold text-xs text-foreground">{emp?.fullName || 'Logapriyan M'}</p>
              <p className="text-[10px] text-muted-foreground font-mono">({emp?.employeeCode || 'DEV-001'})</p>
            </div>
          </div>
        );
      },
    },
    { header: 'Date', accessor: (row: Attendance) => <span className="font-mono text-xs">{formatDate(row.date)}</span> },
    {
      header: 'Login Time',
      accessor: (row: Attendance) => <span className="font-mono text-xs">{new Date(row.loginTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>,
    },
    {
      header: 'Logout Time',
      accessor: (row: Attendance) => (
        <span className="font-mono text-xs">
          {row.logoutTime ? new Date(row.logoutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'In Progress'}
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
          {row.workingHours ? `${row.workingHours} hrs` : 'Calculating...'}
        </span>
      ),
    },
    ...(role === 'ADMIN' || role === 'HR'
      ? [
          {
            header: 'Actions',
            accessor: (row: Attendance) => (
              <Button size="sm" variant="outline" onClick={() => handleEditClick(row)}>
                <Edit className="w-4 h-4 mr-1" /> Edit
              </Button>
            ),
          },
        ]
      : []),
  ];

  if (attLoading || empLoading) {
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
          <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <CalendarCheck className="w-6 h-6 text-primary" />
            Attendance Management
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monitor daily check-ins, IP network compliance, and automatic working hour calculations
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <Button
            onClick={() => exportAttendanceExcel(filteredAttendances)}
            className="bg-foreground text-background hover:bg-foreground/90 font-bold tracking-wider shadow-lg flex-shrink-0"
          >
            <Download className="w-4 h-4 mr-2" />
            EXPORT EXCEL
          </Button>
        </div>
      </div>

      <Card className="border-l-4 border-l-primary shadow-md p-6 space-y-6">
        {/* Advanced Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-4 bg-muted/30 p-4 rounded-xl border border-border">
          <div className="flex-1 w-full">
            <Input
              placeholder="Search attendance by employee name..."
              value={nameFilter}
              onChange={(e) => setNameFilter(e.target.value)}
            />
          </div>
          <div className="w-full sm:w-64">
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
            />
          </div>
        </div>

        <TableWrapper
          columns={columns}
          data={filteredAttendances}
        />
      </Card>

      {/* Edit Attendance Modal */}
      <Modal
        isOpen={!!editingAttendance}
        onClose={() => setEditingAttendance(null)}
        title="Edit Attendance Record"
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4 text-left">
          <Input
            label="Login Time *"
            type="datetime-local"
            value={loginTimeInput}
            onChange={(e) => setLoginTimeInput(e.target.value)}
            required
          />
          <Input
            label="Logout Time"
            type="datetime-local"
            value={logoutTimeInput}
            onChange={(e) => setLogoutTimeInput(e.target.value)}
          />
          <Select
            label="Attendance Status *"
            value={statusInput}
            onChange={(e) => setStatusInput(e.target.value as any)}
            options={[
              { value: 'OFFICE', label: 'Office' },
              { value: 'WFH', label: 'Work From Home' },
              { value: 'HALF_DAY', label: 'Half Day' },
              { value: 'LEAVE', label: 'On Leave' },
            ]}
          />
          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <Button variant="outline" type="button" onClick={() => setEditingAttendance(null)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={updateMutation.isPending}>
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
