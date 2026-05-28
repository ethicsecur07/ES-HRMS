import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { analyticsApi } from '../api_service/analyticsApi';
import { departmentApi } from '../api_service/departmentApi';
import { designationApi } from '../api_service/designationApi';
import { authV2Api } from '../api_service/authV2Api';
import { useNotificationStore } from '../store/useNotificationStore';
import { useAuthStore } from '../store/useAuthStore';
import { Card } from '../Components/WrapperComponents/Card';
import { Button } from '../Components/WrapperComponents/Button';
import { Input, Select, Textarea } from '../Components/WrapperComponents/Input';
import {
  Settings,
  Wifi,
  Save,
  Plus,
  Trash2,
  Users,
  ShieldCheck,
  Briefcase,
  FolderTree,
  X,
  Fingerprint,
  Globe,
  Eye,
  EyeOff,
  Lock,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { addToast } = useNotificationStore();
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const isAdmin = user?.role === 'ADMIN';
  const [activeSubTab, setActiveSubTab] = useState<'global' | 'departments' | 'designations' | 'sso'>(
    isAdmin ? 'global' : 'departments'
  );

  // --- SSO Configuration Queries & Mutations ---
  const { data: authProviders = [], isLoading: isAuthProvidersLoading } = useQuery({
    queryKey: ['authProviders'],
    queryFn: authV2Api.listProviders,
    enabled: isAdmin && activeSubTab === 'sso',
  });

  const registerProviderMutation = useMutation({
    mutationFn: (data: any) => authV2Api.registerProvider(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['authProviders'] });
      addToast('Success', 'SSO Provider configured successfully.', 'success');
      setIsSSOModalOpen(false);
    },
    onError: (err: any) => {
      addToast('Error', err.response?.data?.message || 'Could not configure SSO Provider.', 'error');
    },
  });

  const removeProviderMutation = useMutation({
    mutationFn: (providerType: string) => authV2Api.removeProvider(providerType),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['authProviders'] });
      addToast('Success', 'SSO Provider configuration removed.', 'success');
    },
    onError: (err: any) => {
      addToast('Error', err.response?.data?.message || 'Could not remove SSO Provider.', 'error');
    },
  });

  const [isSSOModalOpen, setIsSSOModalOpen] = useState(false);
  const [ssoModalMode, setSsoModalMode] = useState<'GOOGLE' | 'MICROSOFT' | 'SAML' | 'OAUTH'>('GOOGLE');
  const [ssoDisplayName, setSsoDisplayName] = useState('');
  const [ssoIsEnabled, setSsoIsEnabled] = useState(true);
  const [ssoIsPrimary, setSsoIsPrimary] = useState(false);
  const [ssoClientId, setSsoClientId] = useState('');
  const [ssoClientSecret, setSsoClientSecret] = useState('');
  const [ssoRedirectUri, setSsoRedirectUri] = useState('');
  const [ssoTenantId, setSsoTenantId] = useState('');
  const [ssoAuthorizationUrl, setSsoAuthorizationUrl] = useState('');
  const [ssoTokenUrl, setSsoTokenUrl] = useState('');
  const [ssoUserInfoUrl, setSsoUserInfoUrl] = useState('');
  const [ssoScopes, setSsoScopes] = useState('');
  const [ssoSamlEntryPoint, setSsoSamlEntryPoint] = useState('');
  const [ssoSamlIssuer, setSsoSamlIssuer] = useState('');
  const [ssoSamlCert, setSsoSamlCert] = useState('');
  const [ssoSamlCallbackUrl, setSsoSamlCallbackUrl] = useState('');
  const [ssoSamlSignatureAlgorithm, setSsoSamlSignatureAlgorithm] = useState('sha256');
  const [ssoAutoProvision, setSsoAutoProvision] = useState(false);
  const [ssoDefaultRoleCode, setSsoDefaultRoleCode] = useState('EMPLOYEE');
  
  // Attribute mappings
  const [ssoAttrEmail, setSsoAttrEmail] = useState('email');
  const [ssoAttrName, setSsoAttrName] = useState('name');
  const [ssoAttrFirstName, setSsoAttrFirstName] = useState('');
  const [ssoAttrLastName, setSsoAttrLastName] = useState('');
  const [ssoAttrGroups, setSsoAttrGroups] = useState('');
  const [ssoAttrDepartment, setSsoAttrDepartment] = useState('');

  const [showClientSecret, setShowClientSecret] = useState(false);

  const handleOpenSSOModal = (providerType: 'GOOGLE' | 'MICROSOFT' | 'SAML' | 'OAUTH') => {
    setSsoModalMode(providerType);
    setShowClientSecret(false);

    // Find if we already have a configuration for this providerType in authProviders
    const existing = authProviders.find((p: any) => p.provider === providerType);

    const defaultRedirect = window.location.origin + '/sso/callback';

    if (existing) {
      setSsoDisplayName(existing.displayName || '');
      setSsoIsEnabled(existing.isEnabled !== false);
      setSsoIsPrimary(existing.isPrimary || false);
      setSsoClientId(existing.clientId || '');
      setSsoClientSecret(existing.clientSecret || '');
      setSsoRedirectUri(existing.redirectUri || defaultRedirect);
      setSsoTenantId(existing.tenantId || '');
      setSsoAuthorizationUrl(existing.authorizationUrl || '');
      setSsoTokenUrl(existing.tokenUrl || '');
      setSsoUserInfoUrl(existing.userInfoUrl || '');
      setSsoScopes(existing.scopes ? existing.scopes.join(', ') : '');
      setSsoSamlEntryPoint(existing.samlEntryPoint || '');
      setSsoSamlIssuer(existing.samlIssuer || '');
      setSsoSamlCert(existing.samlCert || '');
      setSsoSamlCallbackUrl(existing.samlCallbackUrl || defaultRedirect);
      setSsoSamlSignatureAlgorithm(existing.samlSignatureAlgorithm || 'sha256');
      setSsoAutoProvision(existing.autoProvision || false);
      setSsoDefaultRoleCode(existing.defaultRoleCode || 'EMPLOYEE');

      // Mappings
      const mappings = existing.attributeMapping || {};
      setSsoAttrEmail(mappings.email || 'email');
      setSsoAttrName(mappings.name || 'name');
      setSsoAttrFirstName(mappings.firstName || '');
      setSsoAttrLastName(mappings.lastName || '');
      setSsoAttrGroups(mappings.groups || '');
      setSsoAttrDepartment(mappings.department || '');
    } else {
      // Default initialization
      setSsoDisplayName(
        providerType === 'GOOGLE'
          ? 'Google Workspace'
          : providerType === 'MICROSOFT'
          ? 'Microsoft Entra ID'
          : providerType === 'SAML'
          ? 'SAML 2.0 Identity Provider'
          : 'Custom OAuth 2.0 Engine'
      );
      setSsoIsEnabled(true);
      setSsoIsPrimary(false);
      setSsoClientId('');
      setSsoClientSecret('');
      setSsoRedirectUri(defaultRedirect);
      setSsoTenantId(providerType === 'MICROSOFT' ? 'common' : '');
      setSsoAuthorizationUrl('');
      setSsoTokenUrl('');
      setSsoUserInfoUrl('');
      setSsoScopes(providerType === 'OAUTH' ? 'openid, profile, email' : '');
      setSsoSamlEntryPoint('');
      setSsoSamlIssuer('');
      setSsoSamlCert('');
      setSsoSamlCallbackUrl(defaultRedirect);
      setSsoSamlSignatureAlgorithm('sha256');
      setSsoAutoProvision(false);
      setSsoDefaultRoleCode('EMPLOYEE');

      setSsoAttrEmail('email');
      setSsoAttrName('name');
      setSsoAttrFirstName('');
      setSsoAttrLastName('');
      setSsoAttrGroups('');
      setSsoAttrDepartment('');
    }

    setIsSSOModalOpen(true);
  };

  const handleSaveSSOProvider = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Construct request payload
    const payload: any = {
      provider: ssoModalMode,
      displayName: ssoDisplayName.trim(),
      isEnabled: ssoIsEnabled,
      isPrimary: ssoIsPrimary,
      autoProvision: ssoAutoProvision,
      defaultRoleCode: ssoDefaultRoleCode,
    };

    if (ssoModalMode === 'GOOGLE' || ssoModalMode === 'MICROSOFT' || ssoModalMode === 'OAUTH') {
      payload.clientId = ssoClientId.trim();
      payload.clientSecret = ssoClientSecret.trim();
      payload.redirectUri = ssoRedirectUri.trim();
    }

    if (ssoModalMode === 'MICROSOFT') {
      payload.tenantId = ssoTenantId.trim();
    }

    if (ssoModalMode === 'OAUTH') {
      payload.authorizationUrl = ssoAuthorizationUrl.trim();
      payload.tokenUrl = ssoTokenUrl.trim();
      payload.userInfoUrl = ssoUserInfoUrl.trim();
      payload.scopes = ssoScopes
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s !== '');
      payload.attributeMapping = {
        email: ssoAttrEmail.trim() || 'email',
        name: ssoAttrName.trim() || 'name',
        firstName: ssoAttrFirstName.trim() || undefined,
        lastName: ssoAttrLastName.trim() || undefined,
        groups: ssoAttrGroups.trim() || undefined,
        department: ssoAttrDepartment.trim() || undefined,
      };
    }

    if (ssoModalMode === 'SAML') {
      payload.samlEntryPoint = ssoSamlEntryPoint.trim();
      payload.samlIssuer = ssoSamlIssuer.trim();
      payload.samlCert = ssoSamlCert.trim();
      payload.samlCallbackUrl = ssoSamlCallbackUrl.trim();
      payload.samlSignatureAlgorithm = ssoSamlSignatureAlgorithm;
      payload.attributeMapping = {
        email: ssoAttrEmail.trim() || 'email',
        name: ssoAttrName.trim() || 'name',
        firstName: ssoAttrFirstName.trim() || undefined,
        lastName: ssoAttrLastName.trim() || undefined,
        groups: ssoAttrGroups.trim() || undefined,
        department: ssoAttrDepartment.trim() || undefined,
      };
    }

    registerProviderMutation.mutate(payload);
  };

  const renderProviderCard = (
    providerType: 'GOOGLE' | 'MICROSOFT' | 'SAML' | 'OAUTH',
    title: string,
    description: string,
    icon: React.ReactNode
  ) => {
    const config = authProviders.find((p: any) => p.provider === providerType);
    const isConfigured = !!config;
    const isEnabled = config?.isEnabled !== false;
    const isPrimary = config?.isPrimary || false;

    return (
      <Card className="flex flex-col justify-between border border-border/80 hover:border-border hover:shadow-lg transition-all p-6 relative group overflow-hidden bg-card/60 backdrop-blur-sm">
        {/* Subtle decorative glow */}
        <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-xl pointer-events-none group-hover:bg-primary/10 transition-all duration-300"></div>

        <div className="space-y-4">
          <div className="flex justify-between items-start">
            <div className="p-3 rounded-xl bg-muted/60 border border-border/50">
              {icon}
            </div>
            <div className="flex flex-wrap gap-1.5 justify-end">
              {isConfigured ? (
                <>
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded-full ${
                    isEnabled 
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                      : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
                  }`}>
                    {isEnabled ? 'Active' : 'Disabled'}
                  </span>
                  {isPrimary && (
                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                      Primary
                    </span>
                  )}
                </>
              ) : (
                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded-full bg-muted text-muted-foreground border border-border/30">
                  Not Configured
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <h4 className="text-base font-bold text-foreground">{title}</h4>
            <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
          </div>

          {isConfigured && (
            <div className="pt-2 border-t border-border/40 text-[11px] text-muted-foreground space-y-1 font-mono">
              {providerType === 'SAML' ? (
                <>
                  <div className="truncate"><span className="text-foreground/75 font-semibold font-sans">Issuer:</span> {config.samlIssuer || 'N/A'}</div>
                  <div className="truncate"><span className="text-foreground/75 font-semibold font-sans">Entrypoint:</span> {config.samlEntryPoint || 'N/A'}</div>
                </>
              ) : (
                <>
                  <div className="truncate"><span className="text-foreground/75 font-semibold font-sans">Client ID:</span> {config.clientId || 'N/A'}</div>
                  {providerType === 'OAUTH' && (
                    <div className="truncate"><span className="text-foreground/75 font-semibold font-sans">Auth URL:</span> {config.authorizationUrl || 'N/A'}</div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6 pt-4 border-t border-border/60">
          <Button
            type="button"
            onClick={() => handleOpenSSOModal(providerType)}
            className="flex-1 bg-muted hover:bg-muted/80 text-foreground border border-border/60 font-semibold text-xs py-2 shadow-sm"
          >
            {isConfigured ? 'Edit Details' : 'Configure'}
          </Button>

          {isConfigured && (
            <Button
              type="button"
              onClick={() => {
                if (confirm(`Are you sure you want to remove the SSO configuration for ${title}? This will immediately disable SSO logins via this provider.`)) {
                  removeProviderMutation.mutate(providerType);
                }
              }}
              isLoading={removeProviderMutation.isPending && removeProviderMutation.variables === providerType}
              className="px-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 shadow-none"
              title="Remove Configuration"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </Card>
    );
  };

  // --- Global Settings State & Queries ---
  const { data: settings, isLoading: isSettingsLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: analyticsApi.getSettings,
    enabled: isAdmin,
  });

  const [companyName, setCompanyName] = useState('');
  const [adminEmail, setAdminEmail] = useState('');
  const [monthlyLeaveLimit, setMonthlyLeaveLimit] = useState(2);
  const [monthlyWFHLimit, setMonthlyWFHLimit] = useState(1);
  const [monthlyPermissionHours, setMonthlyPermissionHours] = useState(3);
  const [salaryCycleStartDay, setSalaryCycleStartDay] = useState(1);
  const [officeIPs, setOfficeIPs] = useState<string[]>([]);
  const [newIP, setNewIP] = useState('');
  const [activeWorkdays, setActiveWorkdays] = useState<string[]>(['Mon', 'Tue', 'Wed', 'Thu', 'Fri']);

  useEffect(() => {
    if (settings) {
      setCompanyName(settings.companyName);
      setAdminEmail(settings.adminEmail);
      setMonthlyLeaveLimit(settings.monthlyLeaveLimit);
      setMonthlyWFHLimit(settings.monthlyWFHLimit);
      setMonthlyPermissionHours(settings.monthlyPermissionHours);
      setSalaryCycleStartDay(settings.salaryCycleStartDay || 1);
      setOfficeIPs(settings.officeWiFiIPs || []);
      if (settings.activeWorkdays) {
        setActiveWorkdays(settings.activeWorkdays);
      }
    }
  }, [settings]);

  const updateSettingsMutation = useMutation({
    mutationFn: (data: any) => analyticsApi.updateSettings(data),
    onSuccess: () => {
      // Invalidate both keys: 'settings' (used here) and 'companySettings' (used by PayrollSetupModal & AttendancePage)
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      queryClient.invalidateQueries({ queryKey: ['companySettings'] });
      addToast('Settings Saved', 'Global settings updated successfully and policy updates broadcasted to all employees.', 'success');
    },
    onError: (err: any) => {
      addToast('Error', err.message || 'Could not save settings.', 'error');
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

  const handleToggleWorkday = (day: string) => {
    setActiveWorkdays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate({
      companyName,
      adminEmail,
      monthlyLeaveLimit,
      monthlyWFHLimit,
      monthlyPermissionHours,
      salaryCycleStartDay,
      officeWiFiIPs: officeIPs,
      activeWorkdays,
    });
  };

  // --- Departments Queries & Mutations ---
  const { data: departments = [], isLoading: isDeptsLoading } = useQuery({
    queryKey: ['departments'],
    queryFn: departmentApi.getAll,
  });



  // --- Designations Queries & Mutations ---
  const { data: designations = [], isLoading: isDesigsLoading } = useQuery({
    queryKey: ['designations'],
    queryFn: () => designationApi.getAll(),
  });



  const isLoading =
    (isAdmin && isSettingsLoading) ||
    isDeptsLoading ||
    isDesigsLoading ||
    (activeSubTab === 'sso' && isAuthProvidersLoading);

  if (isLoading) {
    return (
      <Card className="animate-pulse h-96 bg-muted/20 flex items-center justify-center">
        <div className="text-muted-foreground">Loading configurations...</div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 text-left animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 rounded-2xl bg-card border border-border shadow-sm">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight flex items-center gap-2">
            <Settings className="w-6 h-6 text-primary" />
            System & Organization Settings
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure company global policies, whitelisted networks, departments, and designations.
          </p>
        </div>
      </div>

      {/* Settings Navigation Tabs */}
      <div className="flex flex-wrap border-b border-border">
        {isAdmin && (
          <>
            <button
              type="button"
              onClick={() => setActiveSubTab('global')}
              className={`px-6 py-3 font-bold text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
                activeSubTab === 'global'
                  ? 'border-primary text-primary font-extrabold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Settings className="w-4 h-4" /> Global Settings
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('sso')}
              className={`px-6 py-3 font-bold text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
                activeSubTab === 'sso'
                  ? 'border-primary text-primary font-extrabold'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <ShieldCheck className="w-4 h-4" /> SSO Configuration
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setActiveSubTab('departments')}
          className={`px-6 py-3 font-bold text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
            activeSubTab === 'departments'
              ? 'border-primary text-primary font-extrabold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <FolderTree className="w-4 h-4" /> Departments
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('designations')}
          className={`px-6 py-3 font-bold text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
            activeSubTab === 'designations'
              ? 'border-primary text-primary font-extrabold'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Briefcase className="w-4 h-4" /> Designations
        </button>
        <NavLink
          to="/settings/roles"
          className={({ isActive }) =>
            `px-6 py-3 font-bold text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              isActive
                ? 'border-primary text-primary font-extrabold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`
          }
        >
          <Users className="w-4 h-4" /> Role Management
        </NavLink>
        <NavLink
          to="/settings/permissions"
          className={({ isActive }) =>
            `px-6 py-3 font-bold text-xs uppercase tracking-wider border-b-2 flex items-center gap-2 transition-all ${
              isActive
                ? 'border-primary text-primary font-extrabold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`
          }
        >
          <ShieldCheck className="w-4 h-4" /> Permissions Matrix
        </NavLink>
      </div>

      {/* Tab Panels */}
      {activeSubTab === 'global' && isAdmin && (
        <form onSubmit={handleSaveSettings} className="space-y-6">
          <Card className="space-y-6 border-l-4 border-l-primary shadow-md">
            <h3 className="text-lg font-bold text-foreground border-b border-border pb-3">General Company Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <Input label="Company Name *" value={companyName} onChange={(e) => setCompanyName(e.target.value)} required />
              <Input label="Admin Contact Email *" type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required />
            </div>
          </Card>

          <Card className="space-y-6 border-l-4 border-l-amber-500 shadow-md">
            <h3 className="text-lg font-bold text-foreground border-b border-border pb-3">Weekly Working Days Configuration</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Select the active working days for your organization. Weekends/non-working days are automatically excluded from leave deductions and attendance calculations.
            </p>
            <div className="flex flex-wrap gap-4 pt-2">
              {[
                { label: 'Monday (Mon)', value: 'Mon' },
                { label: 'Tuesday (Tue)', value: 'Tue' },
                { label: 'Wednesday (Wed)', value: 'Wed' },
                { label: 'Thursday (Thu)', value: 'Thu' },
                { label: 'Friday (Fri)', value: 'Fri' },
                { label: 'Saturday (Sat)', value: 'Sat' },
                { label: 'Sunday (Sun)', value: 'Sun' },
              ].map((day) => (
                <label key={day.value} className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary bg-background"
                    checked={activeWorkdays.includes(day.value)}
                    onChange={() => handleToggleWorkday(day.value)}
                  />
                  {day.label}
                </label>
              ))}
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
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-6">
              <Input label="Casual Leave Limit (Days/Month) *" type="number" value={monthlyLeaveLimit} onChange={(e) => setMonthlyLeaveLimit(Number(e.target.value))} required />
              <Input label="WFH Limit (Days/Month) *" type="number" value={monthlyWFHLimit} onChange={(e) => setMonthlyWFHLimit(Number(e.target.value))} required />
              <Input label="Permission Limit (Hours/Month) *" type="number" value={monthlyPermissionHours} onChange={(e) => setMonthlyPermissionHours(Number(e.target.value))} required />
              <Input label="Salary & Attendance Cycle Start Day (1-31) *" type="number" value={salaryCycleStartDay} onChange={(e) => setSalaryCycleStartDay(Number(e.target.value))} min={1} max={31} required />
            </div>
          </Card>

          <div className="flex justify-end gap-4">
            <Button type="submit" isLoading={updateSettingsMutation.isPending} size="lg" className="bg-primary text-white font-bold tracking-wider shadow-lg shadow-primary/20">
              <Save className="w-5 h-5 mr-2" />
              SAVE ALL SETTINGS
            </Button>
          </div>
        </form>
      )}

      {activeSubTab === 'departments' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-foreground">Departments Directory</h3>
            <span className="text-xs text-muted-foreground bg-muted border border-border px-3 py-1 rounded-lg">
              Managed via Microsoft Directory Sync
            </span>
          </div>

          <Card className="overflow-hidden shadow-md p-0 border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Code</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Department Name</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Head of Department</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {departments.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">
                        No departments found. Please sync from Microsoft Directory.
                      </td>
                    </tr>
                  ) : (
                    departments.map((dept: any) => (
                      <tr key={dept._id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-4 text-sm font-mono font-bold text-primary">{dept.code}</td>
                        <td className="p-4 text-sm font-semibold text-foreground">{dept.name}</td>
                        <td className="p-4 text-sm text-muted-foreground">{dept.headOfDepartment || 'Not Assigned'}</td>
                        <td className="p-4 text-xs">
                          <span className={`px-2.5 py-1 rounded-full font-bold ${dept.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {dept.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeSubTab === 'designations' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-foreground">Designations Directory</h3>
            <span className="text-xs text-muted-foreground bg-muted border border-border px-3 py-1 rounded-lg">
              Managed via Microsoft Directory Sync
            </span>
          </div>

          <Card className="overflow-hidden shadow-md p-0 border border-border">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Code</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Designation Name</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Department</th>
                    <th className="p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {designations.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-sm text-muted-foreground">
                        No designations found. Please sync from Microsoft Directory.
                      </td>
                    </tr>
                  ) : (
                    designations.map((desig: any) => (
                      <tr key={desig._id} className="hover:bg-muted/10 transition-colors">
                        <td className="p-4 text-sm font-mono font-bold text-primary">{desig.code}</td>
                        <td className="p-4 text-sm font-semibold text-foreground">{desig.name}</td>
                        <td className="p-4 text-sm text-muted-foreground">
                          {desig.departmentId?.name || (typeof desig.departmentId === 'string' ? desig.departmentId : 'Unassigned')}
                        </td>
                        <td className="p-4 text-xs">
                          <span className={`px-2.5 py-1 rounded-full font-bold ${desig.isActive ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                            {desig.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {activeSubTab === 'sso' && isAdmin && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-card border border-border p-6 rounded-2xl shadow-sm">
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" />
                SSO & OAuth Identity Providers
              </h3>
              <p className="text-xs text-muted-foreground max-w-2xl leading-relaxed">
                Configure external single sign-on directory services for your organization workspace. Active configurations allow employees to login securely via enterprise OAuth 2.0 or SAML 2.0 protocols.
              </p>
            </div>
            <div className="text-xs text-muted-foreground bg-muted/50 border border-border/80 px-4 py-3 rounded-xl max-w-md w-full lg:w-auto">
              <span className="font-bold text-foreground block mb-1">Corporate SSO Callback (ACS URL)</span>
              <div className="flex items-center gap-2">
                <code className="text-primary font-mono text-[10px] select-all bg-background px-2 py-1 rounded border border-border/50 block truncate max-w-[280px]">
                  {window.location.origin}/sso/callback
                </code>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Register this URI with your Identity Provider.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* GOOGLE CARD */}
            {renderProviderCard(
              'GOOGLE',
              'Google Workspace',
              'Allow users to authenticate using their corporate Google Accounts via standard OAuth 2.0.',
              <svg className="w-8 h-8" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98 1 12 1 7.35 1 3.37 3.65 1.48 7.5l3.87 3C6.27 7.74 8.91 5.04 12 5.04z"/>
                <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.45h6.45c-.28 1.47-1.11 2.71-2.36 3.55l3.66 2.84c2.14-1.97 3.74-4.88 3.74-8.5z"/>
                <path fill="#FBBC05" d="M5.35 14.5c-.24-.74-.38-1.52-.38-2.33s.14-1.59.38-2.33l-3.87-3C.56 8.78 0 10.33 0 12s.56 3.22 1.48 5.17l3.87-3.17z"/>
                <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.66-2.84c-1.01.68-2.31 1.09-4.3 1.09-3.09 0-5.73-2.7-6.65-5.46l-3.87 3C3.37 20.35 7.35 23 12 23z"/>
              </svg>
            )}

            {/* MICROSOFT CARD */}
            {renderProviderCard(
              'MICROSOFT',
              'Microsoft Entra ID (Azure AD)',
              'Authenticate using corporate Microsoft Office 355, Azure Active Directory, or Entra ID.',
              <svg className="w-8 h-8" viewBox="0 0 23 23">
                <path fill="#f35325" d="M0 0h11v11H0z"/>
                <path fill="#81bc06" d="M12 0h11v11H12z"/>
                <path fill="#05a6f0" d="M0 12h11v11H0z"/>
                <path fill="#ffba08" d="M12 12h11v11H12z"/>
              </svg>
            )}

            {/* SAML CARD */}
            {renderProviderCard(
              'SAML',
              'SAML 2.0 Federated SSO',
              'Federated identity provider integrations with Okta, Ping Identity, JumpCloud, OneLogin, and custom SAML 2.0 IDPs.',
              <Fingerprint className="w-8 h-8 text-indigo-400" />
            )}

            {/* OAUTH CARD */}
            {renderProviderCard(
              'OAUTH',
              'Custom OAuth 2.0 Engine',
              'Dynamic OAuth 2.0 provider integration engine. Connect custom OAuth / OIDC databases with explicit claim scopes and key mapping.',
              <Globe className="w-8 h-8 text-teal-400" />
            )}
          </div>
        </div>
      )}

      {/* --- SSO Provider Modal --- */}
      {isSSOModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-card border border-border p-6 shadow-2xl animate-in zoom-in-95 duration-200 my-8">
            <div className="flex justify-between items-center border-b border-border pb-3 mb-4">
              <div className="flex items-center gap-2">
                {ssoModalMode === 'GOOGLE' && <span className="p-1.5 rounded-lg bg-red-500/10 text-red-400"><Lock className="w-5 h-5" /></span>}
                {ssoModalMode === 'MICROSOFT' && <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400"><Lock className="w-5 h-5" /></span>}
                {ssoModalMode === 'SAML' && <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400"><Fingerprint className="w-5 h-5" /></span>}
                {ssoModalMode === 'OAUTH' && <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400"><Globe className="w-5 h-5" /></span>}
                <h4 className="text-lg font-bold text-foreground">
                  Configure {ssoModalMode === 'GOOGLE' ? 'Google Workspace' : ssoModalMode === 'MICROSOFT' ? 'Microsoft Entra ID' : ssoModalMode === 'SAML' ? 'SAML 2.0' : 'Custom OAuth 2.0'}
                </h4>
              </div>
              <button onClick={() => setIsSSOModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSSOProvider} className="space-y-6 text-left">
              {/* SECTION: GENERAL SETTINGS */}
              <div className="space-y-4">
                <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">General Configuration</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Display Name *"
                    placeholder="e.g. Corporate Google Login"
                    value={ssoDisplayName}
                    onChange={(e) => setSsoDisplayName(e.target.value)}
                    required
                  />
                  <Select
                    label="Default Provisioning Role *"
                    value={ssoDefaultRoleCode}
                    onChange={(e) => setSsoDefaultRoleCode(e.target.value)}
                    options={[
                      { value: 'EMPLOYEE', label: 'General Employee' },
                      { value: 'TEAM_LEAD', label: 'Team Lead' },
                      { value: 'HR', label: 'HR Manager' },
                      { value: 'MANAGER', label: 'Operations Manager' },
                      { value: 'ADMIN', label: 'System Administrator' },
                    ]}
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/60">
                    <div className="space-y-0.5">
                      <label htmlFor="ssoIsEnabled" className="text-xs font-bold text-foreground cursor-pointer uppercase tracking-wide">
                        Status
                      </label>
                      <p className="text-[10px] text-muted-foreground">Enable login via this IDP</p>
                    </div>
                    <input
                      type="checkbox"
                      id="ssoIsEnabled"
                      checked={ssoIsEnabled}
                      onChange={(e) => setSsoIsEnabled(e.target.checked)}
                      className="h-4.5 w-4.5 rounded border border-border bg-background text-primary focus:ring-primary/20 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/60">
                    <div className="space-y-0.5">
                      <label htmlFor="ssoIsPrimary" className="text-xs font-bold text-foreground cursor-pointer uppercase tracking-wide">
                        Primary Provider
                      </label>
                      <p className="text-[10px] text-muted-foreground">Default redirect for SSO logins</p>
                    </div>
                    <input
                      type="checkbox"
                      id="ssoIsPrimary"
                      checked={ssoIsPrimary}
                      onChange={(e) => setSsoIsPrimary(e.target.checked)}
                      className="h-4.5 w-4.5 rounded border border-border bg-background text-primary focus:ring-primary/20 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border/60">
                    <div className="space-y-0.5">
                      <label htmlFor="ssoAutoProvision" className="text-xs font-bold text-foreground cursor-pointer uppercase tracking-wide">
                        Auto Provision
                      </label>
                      <p className="text-[10px] text-muted-foreground">Create account on success</p>
                    </div>
                    <input
                      type="checkbox"
                      id="ssoAutoProvision"
                      checked={ssoAutoProvision}
                      onChange={(e) => setSsoAutoProvision(e.target.checked)}
                      className="h-4.5 w-4.5 rounded border border-border bg-background text-primary focus:ring-primary/20 cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: CREDENTIALS (OAUTH/OIDC) */}
              {(ssoModalMode === 'GOOGLE' || ssoModalMode === 'MICROSOFT' || ssoModalMode === 'OAUTH') && (
                <div className="space-y-4 border-t border-border/60 pt-4">
                  <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">API & Client Credentials</h5>
                  <div className="space-y-4">
                    <Input
                      label="Client ID *"
                      placeholder="Enter identity provider Client ID"
                      value={ssoClientId}
                      onChange={(e) => setSsoClientId(e.target.value)}
                      required
                    />

                    <div className="relative">
                      <Input
                        label="Client Secret *"
                        type={showClientSecret ? 'text' : 'password'}
                        placeholder="••••••••••••••••"
                        value={ssoClientSecret}
                        onChange={(e) => setSsoClientSecret(e.target.value)}
                        required
                        className="pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowClientSecret(!showClientSecret)}
                        className="absolute right-3 top-[38px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showClientSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    <Input
                      label="Redirect URI *"
                      value={ssoRedirectUri}
                      onChange={(e) => setSsoRedirectUri(e.target.value)}
                      required
                      placeholder="e.g. http://localhost:5173/sso/callback"
                    />
                  </div>
                </div>
              )}

              {/* MICROSOFT SPECIFIC */}
              {ssoModalMode === 'MICROSOFT' && (
                <div className="space-y-4 border-t border-border/60 pt-4">
                  <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Microsoft Directory Settings</h5>
                  <Input
                    label="Directory (Tenant) ID *"
                    placeholder="e.g. common, organizations, or UUID"
                    value={ssoTenantId}
                    onChange={(e) => setSsoTenantId(e.target.value)}
                    required
                  />
                </div>
              )}

              {/* CUSTOM OAUTH SPECIFIC */}
              {ssoModalMode === 'OAUTH' && (
                <div className="space-y-4 border-t border-border/60 pt-4">
                  <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Custom OAuth Endpoint Configuration</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Authorization URL *"
                      placeholder="e.g. https://idp.example.com/oauth/authorize"
                      value={ssoAuthorizationUrl}
                      onChange={(e) => setSsoAuthorizationUrl(e.target.value)}
                      required
                    />
                    <Input
                      label="Token Exchange URL *"
                      placeholder="e.g. https://idp.example.com/oauth/token"
                      value={ssoTokenUrl}
                      onChange={(e) => setSsoTokenUrl(e.target.value)}
                      required
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="User Profile Info URL *"
                      placeholder="e.g. https://idp.example.com/oauth/userinfo"
                      value={ssoUserInfoUrl}
                      onChange={(e) => setSsoUserInfoUrl(e.target.value)}
                      required
                    />
                    <Input
                      label="Authorization Scopes *"
                      placeholder="e.g. openid, profile, email (comma separated)"
                      value={ssoScopes}
                      onChange={(e) => setSsoScopes(e.target.value)}
                      required
                    />
                  </div>
                </div>
              )}

              {/* SAML SPECIFIC */}
              {ssoModalMode === 'SAML' && (
                <div className="space-y-4 border-t border-border/60 pt-4">
                  <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">SAML 2.0 Directory Settings</h5>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Identity Provider Single Sign-On URL (EntryPoint) *"
                        placeholder="e.g. https://idp.example.com/saml/sso"
                        value={ssoSamlEntryPoint}
                        onChange={(e) => setSsoSamlEntryPoint(e.target.value)}
                        required
                      />
                      <Input
                        label="Identity Provider Issuer (Entity ID) *"
                        placeholder="e.g. https://idp.example.com/saml/metadata"
                        value={ssoSamlIssuer}
                        onChange={(e) => setSsoSamlIssuer(e.target.value)}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Assertion Consumer Service (ACS) Callback URL *"
                        value={ssoSamlCallbackUrl}
                        onChange={(e) => setSsoSamlCallbackUrl(e.target.value)}
                        required
                      />
                      <Select
                        label="Signature Algorithm *"
                        value={ssoSamlSignatureAlgorithm}
                        onChange={(e) => setSsoSamlSignatureAlgorithm(e.target.value)}
                        options={[
                          { value: 'sha256', label: 'RSA-SHA256' },
                          { value: 'sha1', label: 'RSA-SHA1 (Legacy)' },
                          { value: 'sha512', label: 'RSA-SHA512' },
                        ]}
                        required
                      />
                    </div>
                    <Textarea
                      label="X.509 Public Certificate (PEM format) *"
                      placeholder="-----BEGIN CERTIFICATE-----\nMIIB...-----END CERTIFICATE-----"
                      value={ssoSamlCert}
                      onChange={(e) => setSsoSamlCert(e.target.value)}
                      required
                      rows={5}
                      className="font-mono text-[11px]"
                    />
                  </div>
                </div>
              )}

              {/* ATTRIBUTE CLAIMS MAP SECTION (SAML & CUSTOM OAUTH) */}
              {(ssoModalMode === 'SAML' || ssoModalMode === 'OAUTH') && (
                <div className="space-y-4 border-t border-border/60 pt-4">
                  <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Profile Claim Attribute Mappings</h5>
                  <p className="text-[11px] text-muted-foreground leading-relaxed -mt-2">
                    Specify which keys in the SAML assertion or userinfo profile payload correspond to standard fields.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Email Attribute Key *"
                      value={ssoAttrEmail}
                      onChange={(e) => setSsoAttrEmail(e.target.value)}
                      required
                    />
                    <Input
                      label="Full Name Attribute Key *"
                      value={ssoAttrName}
                      onChange={(e) => setSsoAttrName(e.target.value)}
                      required
                    />
                    <Input
                      label="First Name Key (Optional)"
                      value={ssoAttrFirstName}
                      onChange={(e) => setSsoAttrFirstName(e.target.value)}
                      placeholder="e.g. givenName"
                    />
                    <Input
                      label="Last Name Key (Optional)"
                      value={ssoAttrLastName}
                      onChange={(e) => setSsoAttrLastName(e.target.value)}
                      placeholder="e.g. surName"
                    />
                    <Input
                      label="Groups/Roles Key (Optional)"
                      value={ssoAttrGroups}
                      onChange={(e) => setSsoAttrGroups(e.target.value)}
                      placeholder="e.g. memberOf"
                    />
                    <Input
                      label="Department Key (Optional)"
                      value={ssoAttrDepartment}
                      onChange={(e) => setSsoAttrDepartment(e.target.value)}
                      placeholder="e.g. department"
                    />
                  </div>
                </div>
              )}

              {/* ACTION BUTTONS */}
              <div className="flex justify-end gap-3 pt-3 border-t border-border mt-6">
                <Button
                  type="button"
                  onClick={() => setIsSSOModalOpen(false)}
                  className="bg-muted hover:bg-muted/80 text-foreground border border-border"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={registerProviderMutation.isPending}
                  className="bg-primary text-white"
                >
                  Save Provider Settings
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
