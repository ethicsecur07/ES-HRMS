import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { analyticsApi } from '../../api_service/analyticsApi';
import { Card } from '../WrapperComponents/Card';
import { TableWrapper } from '../WrapperComponents/TableWrapper';
import type { AuditLog } from '../../types';
import { ShieldCheck } from 'lucide-react';

import { TableSkeleton } from '../WrapperComponents/Skeleton';

export const AuditLogViewer: React.FC = () => {
  const { data: auditLogs, isLoading } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: analyticsApi.getAuditLogs,
  });

  const columns = [
    {
      header: 'Timestamp',
      accessor: (row: AuditLog) => (
        <span className="text-xs font-mono text-muted-foreground">
          {new Date(row.timestamp).toLocaleString()}
        </span>
      ),
    },
    {
      header: 'Module',
      accessor: (row: AuditLog) => (
        <span className="px-2.5 py-1 rounded-md bg-muted text-xs font-bold uppercase tracking-wider text-foreground border border-border">
          {row.module}
        </span>
      ),
    },
    {
      header: 'Action',
      accessor: (row: AuditLog) => (
        <span className="font-bold text-xs text-primary">{row.action}</span>
      ),
    },
    {
      header: 'Performed By',
      accessor: 'performedBy',
      className: 'font-semibold text-xs',
    },
    {
      header: 'Affected Record / Details',
      accessor: (row: AuditLog) => (
        <div className="text-xs">
          <p className="font-semibold text-foreground">{row.affectedRecord}</p>
          {row.details && <p className="text-muted-foreground mt-0.5">{row.details}</p>}
        </div>
      ),
    },
  ];

  if (isLoading) {
    return <TableSkeleton />;
  }

  return (
    <Card className="space-y-4 text-left border-l-4 border-l-destructive shadow-md">
      <div className="flex items-center gap-2 border-b border-border pb-4">
        <ShieldCheck className="w-6 h-6 text-destructive" />
        <div>
          <h3 className="text-lg font-bold text-foreground tracking-tight">System Audit Logs</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Immutable tracking of security overrides, leave approvals, payroll edits, and attendance checks
          </p>
        </div>
      </div>

      <TableWrapper
        columns={columns}
        data={auditLogs || []}
        searchKey="action"
        searchPlaceholder="Filter audit logs by action..."
        rowsPerPage={8}
      />
    </Card>
  );
};
