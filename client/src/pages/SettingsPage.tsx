import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { analyticsApi } from '../api_service/analyticsApi';
import { useNotificationStore } from '../store/useNotificationStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input } from '../Components/WrapperComponents/Input';
import { Settings, Wifi, Save, Plus, Trash2 } from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { addToast } = useNotificationStore();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: analyticsApi.getSettings,
  });

  const [companyName, setCompanyName] = useState(settings?.companyName || 'EthicSecur SofTec');
  const [adminEmail, setAdminEmail] = useState(settings?.adminEmail || 'Official@ethicsecur.co.in');
  const [monthlyLeaveLimit, setMonthlyLeaveLimit] = useState(settings?.monthlyLeaveLimit || 2);
  const [monthlyWFHLimit, setMonthlyWFHLimit] = useState(settings?.monthlyWFHLimit || 1);
  const [monthlyPermissionHours, setMonthlyPermissionHours] = useState(settings?.monthlyPermissionHours || 3);
  const [officeIPs, setOfficeIPs] = useState<string[]>(settings?.officeWiFiIPs || ['192.168.29.50', '192.168.29.55']);
  const [newIP, setNewIP] = useState('');

  React.useEffect(() => {
    if (settings) {
      setCompanyName(settings.companyName);
      setAdminEmail(settings.adminEmail);
      setMonthlyLeaveLimit(settings.monthlyLeaveLimit);
      setMonthlyWFHLimit(settings.monthlyWFHLimit);
      setMonthlyPermissionHours(settings.monthlyPermissionHours);
      setOfficeIPs(settings.officeWiFiIPs);
    }
  }, [settings]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => analyticsApi.updateSettings(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      addToast('Settings Saved', 'Company configurations updated successfully.', 'success');
    },
    onError: () => {
      addToast('Error', 'Could not save settings.', 'error');
    },
  });

  const handleAddIP = () => {
    if (!newIP.trim()) return;
    if (officeIPs.includes(newIP.trim())) {
      addToast('Duplicate IP', 'This IP address is already whitelisted.', 'warning');
      return;
    }
    setOfficeIPs([...officeIPs, newIP.trim()]);
    setNewIP('');
  };

  const handleRemoveIP = (ip: string) => {
    setOfficeIPs(officeIPs.filter((item) => item !== ip));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      companyName,
      adminEmail,
      monthlyLeaveLimit,
      monthlyWFHLimit,
      monthlyPermissionHours,
      officeWiFiIPs: officeIPs,
    });
  };

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
          <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            System & Security Settings
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure company global policies, office WiFi whitelisting for IP attendance, and admin preferences
          </p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <Card className="space-y-6 border-l-4 border-l-primary shadow-md">
          <h3 className="text-lg font-bold text-foreground border-b border-border pb-3">General Company Profile</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Input label="Company Name *" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
            <Input label="Admin Contact Email *" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
          </div>
        </Card>

        <Card className="space-y-6 border-l-4 border-l-foreground shadow-md">
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Wifi className="w-5 h-5 text-foreground" />
            <h3 className="text-lg font-bold text-foreground">Office WiFi IP Whitelist (Attendance Security)</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Attendance check-ins are restricted to the IP addresses listed below. Logins from external networks will be flagged as remote and require an approved WFH override.
          </p>

          <div className="flex items-center gap-3 max-w-md">
            <Input placeholder="Add new IP address (e.g. 192.168.29.100)..." value={newIP} onChange={(e) => setNewIP(e.target.value)} />
            <Button type="button" onClick={handleAddIP} className="flex-shrink-0 bg-foreground text-background hover:bg-foreground/90 shadow-md">
              <Plus className="w-4 h-4 mr-1" /> Add IP
            </Button>
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            {officeIPs.map((ip) => (
              <div key={ip} className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-muted border border-border text-xs font-mono font-bold text-foreground shadow-sm">
                <span>{ip}</span>
                <button type="button" onClick={() => handleRemoveIP(ip)} className="text-primary hover:text-primary/80 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>

        <Card className="space-y-6 border-l-4 border-l-muted-foreground shadow-md">
          <h3 className="text-lg font-bold text-foreground border-b border-border pb-3">Monthly Global Allowance Policies</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Input label="Casual Leave Limit (Days/Month) *" type="number" value={monthlyLeaveLimit} onChange={(e) => setMonthlyLeaveLimit(Number(e.target.value))} required />
            <Input label="WFH Limit (Days/Month) *" type="number" value={monthlyWFHLimit} onChange={(e) => setMonthlyWFHLimit(Number(e.target.value))} required />
            <Input label="Permission Limit (Hours/Month) *" type="number" value={monthlyPermissionHours} onChange={(e) => setMonthlyPermissionHours(Number(e.target.value))} required />
          </div>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="submit" isLoading={updateMutation.isPending} size="lg" className="bg-primary text-white font-bold tracking-wider shadow-lg shadow-primary/20">
            <Save className="w-5 h-5 mr-2" />
            SAVE ALL SETTINGS
          </Button>
        </div>
      </form>
    </div>
  );
};
