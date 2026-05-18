import React from 'react';
import { AuditLogViewer } from '../Components/SpecifiedComponents/AuditLogViewer';
import { ShieldCheck } from 'lucide-react';

export const AuditLogsPage: React.FC = () => {
  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-destructive" />
            System Audit & Security Logs
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Immutable tracking of security overrides, leave approvals, payroll edits, and attendance checks
          </p>
        </div>
      </div>

      <AuditLogViewer />
    </div>
  );
};
