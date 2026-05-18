import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { attendanceApi } from '../api_service/attendanceApi';
import { employeeApi } from '../api_service/employeeApi';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Select } from '../Components/WrapperComponents/Input';
import { TableWrapper } from '../Components/WrapperComponents/TableWrapper';
import type { Attendance } from '../types';
import { exportAttendanceExcel } from '../utils/exportUtils';
import { formatDate } from '../utils/formatters';
import { CalendarCheck, Download, Wifi } from 'lucide-react';

export const AttendancePage: React.FC = () => {
  const [selectedEmp, setSelectedEmp] = useState('ALL');

  const { data: attendances, isLoading: attLoading } = useQuery({
    queryKey: ['attendances'],
    queryFn: attendanceApi.getToday, // Using robust mock attendance list
  });

  const { data: employees, isLoading: empLoading } = useQuery({
    queryKey: ['employees'],
    queryFn: employeeApi.getAll,
  });

  const filteredAttendances = attendances?.filter((att) => {
    if (selectedEmp === 'ALL') return true;
    const empId = typeof att.employeeId === 'object' ? att.employeeId._id : att.employeeId;
    return empId === selectedEmp;
  }) || [];

  const columns = [
    {
      header: 'Employee',
      accessor: (row: Attendance) => {
        const emp = employees?.find((e) => e._id === (typeof row.employeeId === 'object' ? row.employeeId._id : row.employeeId));
        return (
          <div className="flex items-center gap-2">
            <span className="font-bold text-xs text-foreground">{emp?.fullName || 'Logapriyan M'}</span>
            <span className="text-[10px] text-muted-foreground font-mono">({emp?.employeeCode || 'DEV-001'})</span>
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
  ];

  if (attLoading || empLoading) {
    return (
      <Card className="animate-pulse h-96 bg-muted/20">
        <div />
      </Card>
    );
  }

  const empOptions = [
    { value: 'ALL', label: 'All Employees' },
    ...(employees?.map((e) => ({ value: e._id, label: `${e.fullName} (${e.employeeCode})` })) || []),
  ];

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

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Select
            value={selectedEmp}
            onChange={(e) => setSelectedEmp(e.target.value)}
            options={empOptions}
            className="w-full sm:w-64"
          />

          <Button
            onClick={() => exportAttendanceExcel(filteredAttendances)}
            className="bg-foreground text-background hover:bg-foreground/90 font-bold tracking-wider shadow-lg flex-shrink-0"
          >
            <Download className="w-4 h-4 mr-2" />
            EXPORT EXCEL
          </Button>
        </div>
      </div>

      <Card className="border-l-4 border-l-primary shadow-md">
        <TableWrapper
          columns={columns}
          data={filteredAttendances}
          searchKey="ipAddress"
          searchPlaceholder="Filter attendance by IP address..."
        />
      </Card>
    </div>
  );
};
