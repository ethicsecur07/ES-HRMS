import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card } from '../Components/WrapperComponents/Card';
import { Input, Select, Textarea } from '../Components/WrapperComponents/Input';
import { Button } from '../Components/WrapperComponents/Button';
import { authApi } from '../api_service/authApi';
import { authV2Api } from '../api_service/authV2Api';
import { useNotificationStore } from '../store/useNotificationStore';
import { useAuthStore } from '../store/useAuthStore';
import {
  Building2,
  Shield,
  Lock,
  User,
  Mail,
  Sparkles,
  Fingerprint,
  Globe,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const addToast = useNotificationStore((state) => state.addToast);
  const { login, logout } = useAuthStore();

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const [registeredSlug, setRegisteredSlug] = useState('');
  const [registeredOrgName, setRegisteredOrgName] = useState('');

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    organizationName: '',
    organizationSlug: '',
    organizationSector: '',
  });

  const [passwordStrength, setPasswordStrength] = useState({
    score: 0,
    label: 'Too Weak',
    color: 'bg-red-500',
  });

  // --- Step 2: SSO Modal States ---
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

  // --- react-query for SSO Config ---
  const { data: authProviders = [], refetch: refetchProviders } = useQuery({
    queryKey: ['signupAuthProviders'],
    queryFn: authV2Api.listProviders,
    enabled: step === 2,
  });

  const registerProviderMutation = useMutation({
    mutationFn: (data: any) => authV2Api.registerProvider(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['signupAuthProviders'] });
      refetchProviders();
      addToast('Success', 'SSO Provider configured successfully.', 'success');
      setIsSSOModalOpen(false);
    },
    onError: (err: any) => {
      addToast('Error', err.response?.data?.message || 'Could not configure SSO Provider.', 'error');
    },
  });

  // Automatically slugify organization name on change
  const handleOrgNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value;
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');

    setFormData({
      ...formData,
      organizationName: name,
      organizationSlug: slug,
    });
  };

  // Evaluate password strength in real time
  const handlePasswordChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value;
    let score = 0;

    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/[a-z]/.test(password)) score += 1;
    if (/[0-9]/.test(password)) score += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score += 1;

    let label = 'Too Weak';
    let color = 'bg-red-500';

    if (score === 5) {
      label = 'Very Strong';
      color = 'bg-emerald-500';
    } else if (score >= 4) {
      label = 'Strong';
      color = 'bg-teal-500';
    } else if (score >= 3) {
      label = 'Fair';
      color = 'bg-amber-500';
    } else if (score >= 2) {
      label = 'Weak';
      color = 'bg-orange-500';
    }

    setPasswordStrength({ score, label, color });
    setFormData({ ...formData, password });
  };

  const handleSubmitStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    const { name, email, password, organizationName, organizationSlug, organizationSector } = formData;

    if (!name || !email || !password || !organizationName || !organizationSlug || !organizationSector) {
      addToast('Validation Error', 'Please fill in all registration fields.', 'error');
      return;
    }

    if (passwordStrength.score < 5) {
      addToast('Password Weak', 'Please satisfy all complexity requirements (length >= 8, uppercase, lowercase, number, and special character).', 'warning');
      return;
    }

    setLoading(true);
    try {
      const response = await authApi.signup({
        name,
        email,
        password,
        organizationName,
        organizationSlug,
        organizationSector,
      });

      if (response.success) {
        addToast('Registration Successful', `Organization "${organizationName}" registered! Proceed to configure SSO.`, 'success');
        setRegisteredSlug(response.slug);
        setRegisteredOrgName(organizationName);

        // Auto-login the administrator using the returned credentials
        if (response.user && response.token) {
          login(response.user, response.token);
        }

        // Advance to Step 2
        setStep(2);
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Organization registration failed. Please try again.';
      addToast('Registration Failed', msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenSSOModal = (providerType: 'GOOGLE' | 'MICROSOFT' | 'SAML' | 'OAUTH') => {
    setSsoModalMode(providerType);
    setShowClientSecret(false);

    // Find if we already have a configuration for this providerType
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

      const mappings = existing.attributeMapping || {};
      setSsoAttrEmail(mappings.email || 'email');
      setSsoAttrName(mappings.name || 'name');
      setSsoAttrFirstName(mappings.firstName || '');
      setSsoAttrLastName(mappings.lastName || '');
      setSsoAttrGroups(mappings.groups || '');
      setSsoAttrDepartment(mappings.department || '');
    } else {
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

  const handleFinishOnboarding = () => {
    // Log out admin user to ensure clean session state on redirect
    logout();
    navigate(`/login?tenant=${registeredSlug}`);
  };

  const renderOnboardingProviderCard = (
    providerType: 'GOOGLE' | 'MICROSOFT' | 'SAML' | 'OAUTH',
    title: string,
    description: string,
    icon: React.ReactNode
  ) => {
    const config = authProviders.find((p: any) => p.provider === providerType);
    const isConfigured = !!config;
    const isEnabled = config?.isEnabled !== false;

    return (
      <Card className="flex flex-col justify-between border border-slate-800 bg-slate-900/40 p-5 hover:border-slate-700 transition-all relative overflow-hidden backdrop-blur-sm">
        <div className="space-y-3.5">
          <div className="flex justify-between items-start">
            <div className="p-2.5 rounded-xl bg-slate-950/60 border border-slate-800">
              {icon}
            </div>
            {isConfigured ? (
              <span className={`px-2 py-0.5 text-[9px] font-black uppercase rounded-full tracking-wider flex items-center gap-1 ${
                isEnabled
                  ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  : 'bg-orange-500/10 text-orange-400 border border-orange-500/20'
              }`}>
                <CheckCircle2 className="w-3 h-3" /> Configured
              </span>
            ) : (
              <span className="px-2 py-0.5 text-[9px] font-black uppercase rounded-full bg-slate-950 text-slate-500 border border-slate-800/60 tracking-wider">
                Not Configured
              </span>
            )}
          </div>

          <div className="space-y-1 text-left">
            <h4 className="text-sm font-bold text-white">{title}</h4>
            <p className="text-[11px] text-slate-400 leading-normal">{description}</p>
          </div>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-950 flex gap-2">
          <Button
            type="button"
            onClick={() => handleOpenSSOModal(providerType)}
            className="w-full bg-slate-950 hover:bg-slate-900 text-white border border-slate-850 hover:border-slate-800 text-[10px] font-extrabold py-2 tracking-wider"
          >
            {isConfigured ? 'Edit Details' : 'Configure SSO'}
          </Button>
        </div>
      </Card>
    );
  };

  const sectors = [
    { value: 'IT', label: 'Information Technology' },
    { value: 'Startups', label: 'Tech Startups' },
    { value: 'Manufacturing', label: 'Manufacturing & Industrial' },
    { value: 'Hospitals', label: 'Healthcare & Hospitals' },
    { value: 'Schools', label: 'Education & Schools' },
    { value: 'Logistics', label: 'Logistics & Supply Chain' },
    { value: 'Agencies', label: 'Creative & Consulting Agencies' },
    { value: 'Enterprises', label: 'General Enterprises' },
  ];

  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-slate-950 p-6 overflow-hidden">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#F75F0A]/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none animate-pulse delay-1000"></div>

      {/* Floating Stepper Indicators */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-6 bg-slate-900/60 border border-slate-800/80 px-6 py-2.5 rounded-full backdrop-blur-md">
        <div className="flex items-center gap-2">
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
            step === 1 ? 'bg-[#F75F0A] text-white' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
          }`}>
            {step === 1 ? '1' : '✓'}
          </span>
          <span className={`text-[10px] font-black uppercase tracking-wider ${step === 1 ? 'text-white' : 'text-slate-400'}`}>
            Workspace Signup
          </span>
        </div>
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <div className="flex items-center gap-2">
          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${
            step === 2 ? 'bg-[#F75F0A] text-white' : 'bg-slate-950 text-slate-600'
          }`}>
            2
          </span>
          <span className={`text-[10px] font-black uppercase tracking-wider ${step === 2 ? 'text-white' : 'text-slate-600'}`}>
            SSO Directory Config
          </span>
        </div>
      </div>

      {step === 1 ? (
        <Card className="w-full max-w-xl p-8 z-10 border border-slate-800 shadow-2xl backdrop-blur-xl bg-slate-900/90 text-white mt-10">
          <div className="text-center mb-6">
            <div className="w-12 h-12 bg-[#F75F0A]/10 border border-[#F75F0A]/20 text-[#F75F0A] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Building2 className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Register New Organization</h2>
            <p className="text-xs text-slate-400 mt-1">
              Establish your business workspace domain and configure your administrator account in one click.
            </p>
          </div>

          <form onSubmit={handleSubmitStep1} className="space-y-4 px-2">
            {/* Organization Details Section */}
            <div className="space-y-3.5">
              <p className="text-[9px] font-black uppercase tracking-wider text-[#F75F0A] mb-1">
                Workspace Profile Settings
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Organization Name"
                  value={formData.organizationName}
                  onChange={handleOrgNameChange}
                  placeholder="e.g. EthicSec Corporation"
                  icon={<Building2 className="w-4 h-4" />}
                  className="bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                  required
                />

                <div className="w-full">
                  <Input
                    label="Organization Code (Slug)"
                    value={formData.organizationSlug}
                    onChange={(e) => setFormData({ ...formData, organizationSlug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                    placeholder="e.g. ethicsec"
                    icon={<Sparkles className="w-4 h-4 text-[#F75F0A]" />}
                    className="bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                    required
                  />
                  <p className="mt-1 text-[10px] text-slate-400 text-left font-sans">
                    This unique identifier serves as your subdomain login code.
                  </p>
                </div>
              </div>

              <Select
                label="Industry Sector"
                value={formData.organizationSector}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormData({ ...formData, organizationSector: e.target.value })}
                options={[{ value: '', label: 'Select Sector...' }, ...sectors]}
                className="bg-slate-950 border-slate-800 text-white focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                required
              />
            </div>

            {/* Admin User Section */}
            <div className="space-y-3.5 pt-2 border-t border-slate-800">
              <p className="text-[9px] font-black uppercase tracking-wider text-[#F75F0A] mb-1">
                Primary Administrator Credentials
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Administrator Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Abishek"
                  icon={<User className="w-4 h-4" />}
                  className="bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                  required
                />

                <Input
                  label="Corporate Email Address"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g. admin@ethicsecur.co.in"
                  icon={<Mail className="w-4 h-4" />}
                  className="bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Input
                  label="Secure Master Password"
                  type="password"
                  value={formData.password}
                  onChange={handlePasswordChange}
                  placeholder="••••••••••••"
                  icon={<Lock className="w-4 h-4" />}
                  className="bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                  required
                />

                {formData.password && (
                  <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-400">Password Strength:</span>
                      <span className="font-bold text-slate-300">{passwordStrength.label}</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${passwordStrength.color}`}
                        style={{ width: `${(passwordStrength.score / 5) * 100}%` }}
                      />
                    </div>
                    {/* Dynamic password requirements checklist */}
                    <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/40">
                      {[
                        { label: 'Min 8 characters', met: formData.password.length >= 8 },
                        { label: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(formData.password) },
                        { label: 'One lowercase letter (a-z)', met: /[a-z]/.test(formData.password) },
                        { label: 'One number (0-9)', met: /[0-9]/.test(formData.password) },
                        { label: 'One special symbol (!@#...)', met: /[!@#$%^&*(),.?":{}|<>]/.test(formData.password) },
                      ].map((criteria, i) => (
                        <div key={i} className="flex items-center gap-1.5 transition-all">
                          <span className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[8px] font-black border transition-all ${
                            criteria.met
                              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                              : 'bg-slate-900 border-slate-800 text-slate-500'
                          }`}>
                            {criteria.met ? '✓' : '•'}
                          </span>
                          <span className={criteria.met ? 'text-emerald-400/90 font-medium' : 'text-slate-500'}>
                            {criteria.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 space-y-3">
              <Button
                type="submit"
                className="w-full bg-[#F75F0A] hover:bg-[#F75F0A]/90 text-white font-bold tracking-wider py-3 shadow-lg shadow-[#F75F0A]/20 hover:shadow-[#F75F0A]/30 transition-all scale-[1.01] mt-2 flex items-center justify-center"
                isLoading={loading}
              >
                <Building2 className="w-5 h-5 mr-2" />
                REGISTER WORKSPACE
              </Button>

              <div className="text-center text-xs text-slate-400">
                Already have an active organization?{' '}
                <Link to="/login" className="text-[#F75F0A] font-bold hover:underline">
                  Sign In
                </Link>
              </div>
            </div>
          </form>
        </Card>
      ) : (
        /* STEP 2: SSO ONBOARDING PAGE */
        <Card className="w-full max-w-4xl p-8 z-10 border border-slate-800 shadow-2xl backdrop-blur-xl bg-slate-900/90 text-white mt-16 text-center animate-in fade-in zoom-in-98 duration-300">
          <div className="mb-6 space-y-2">
            <div className="w-12 h-12 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Shield className="w-6 h-6 animate-pulse" />
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Configure Enterprise SSO</h2>
            <p className="text-xs text-slate-400 max-w-2xl mx-auto leading-relaxed">
              Step 2: Secure login directories for **{registeredOrgName}**. Configure corporate authentication systems (Google, Microsoft Entra, SAML, or OAuth 2.0). 
              If skipped, users will fall back to local password logins.
            </p>

            <div className="text-[10px] text-slate-400 bg-slate-950/80 border border-slate-850 px-4 py-2.5 rounded-xl max-w-md mx-auto inline-block mt-3">
              <span className="font-bold text-slate-300 block mb-1">Corporate SSO ACS Callback URL</span>
              <code className="text-indigo-400 font-mono text-[9px] select-all bg-slate-900 px-2 py-0.5 rounded border border-slate-800 block truncate max-w-[340px] mx-auto">
                {window.location.origin}/sso/callback
              </code>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 my-6 text-left">
            {/* GOOGLE CARD */}
            {renderOnboardingProviderCard(
              'GOOGLE',
              'Google Workspace',
              'Allow users to authenticate using their corporate Google Accounts via standard OAuth 2.0.',
              <svg className="w-6 h-6" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12 5.04c1.66 0 3.2.57 4.38 1.69l3.27-3.27C17.68 1.54 14.98 1 12 1 7.35 1 3.37 3.65 1.48 7.5l3.87 3C6.27 7.74 8.91 5.04 12 5.04z"/>
                <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.34H12v4.45h6.45c-.28 1.47-1.11 2.71-2.36 3.55l3.66 2.84c2.14-1.97 3.74-4.88 3.74-8.5z"/>
                <path fill="#FBBC05" d="M5.35 14.5c-.24-.74-.38-1.52-.38-2.33s.14-1.59.38-2.33l-3.87-3C.56 8.78 0 10.33 0 12s.56 3.22 1.48 5.17l3.87-3.17z"/>
                <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.66-2.84c-1.01.68-2.31 1.09-4.3 1.09-3.09 0-5.73-2.7-6.65-5.46l-3.87 3C3.37 20.35 7.35 23 12 23z"/>
              </svg>
            )}

            {/* MICROSOFT CARD */}
            {renderOnboardingProviderCard(
              'MICROSOFT',
              'Microsoft Entra ID (Azure AD)',
              'Authenticate using corporate Microsoft Office 365, Azure Active Directory, or Entra ID.',
              <svg className="w-6 h-6" viewBox="0 0 23 23">
                <path fill="#f35325" d="M0 0h11v11H0z"/>
                <path fill="#81bc06" d="M12 0h11v11H12z"/>
                <path fill="#05a6f0" d="M0 12h11v11H0z"/>
                <path fill="#ffba08" d="M12 12h11v11H12z"/>
              </svg>
            )}

            {/* SAML CARD */}
            {renderOnboardingProviderCard(
              'SAML',
              'SAML 2.0 Federated SSO',
              'Federated identity provider integrations with Okta, Ping Identity, JumpCloud, OneLogin, and custom SAML 2.0 IDPs.',
              <Fingerprint className="w-6 h-6 text-indigo-400" />
            )}

            {/* OAUTH CARD */}
            {renderOnboardingProviderCard(
              'OAUTH',
              'Custom OAuth 2.0 Engine',
              'Dynamic OAuth 2.0 provider integration engine. Connect custom OAuth / OIDC databases with explicit claim scopes.',
              <Globe className="w-6 h-6 text-teal-400" />
            )}
          </div>

          <div className="flex justify-between items-center pt-5 border-t border-slate-950 mt-6">
            <p className="text-[10px] text-slate-500 font-sans text-left leading-normal">
              Need to change this later? Once logged in, these provider configurations will be available in the **Settings &gt; SSO Configuration** tab.
            </p>
            <Button
              type="button"
              onClick={handleFinishOnboarding}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-extrabold px-6 py-2.5 rounded-xl shadow-lg shadow-indigo-600/10 tracking-widest uppercase text-xs flex items-center gap-1.5"
            >
              Finish Onboarding <ArrowRight className="w-4 h-4" />
            </Button>
          </div>
        </Card>
      )}

      {/* --- SSO Provider Modal --- */}
      {isSSOModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl animate-in zoom-in-95 duration-200 my-8 text-white">
            <div className="flex justify-between items-center border-b border-slate-850 pb-3 mb-4">
              <div className="flex items-center gap-2">
                {ssoModalMode === 'GOOGLE' && <span className="p-1.5 rounded-lg bg-red-500/10 text-red-400"><Lock className="w-5 h-5" /></span>}
                {ssoModalMode === 'MICROSOFT' && <span className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400"><Lock className="w-5 h-5" /></span>}
                {ssoModalMode === 'SAML' && <span className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400"><Fingerprint className="w-5 h-5" /></span>}
                {ssoModalMode === 'OAUTH' && <span className="p-1.5 rounded-lg bg-teal-500/10 text-teal-400"><Globe className="w-5 h-5" /></span>}
                <h4 className="text-lg font-bold text-white">
                  Configure {ssoModalMode === 'GOOGLE' ? 'Google Workspace' : ssoModalMode === 'MICROSOFT' ? 'Microsoft Entra ID' : ssoModalMode === 'SAML' ? 'SAML 2.0' : 'Custom OAuth 2.0'}
                </h4>
              </div>
              <button onClick={() => setIsSSOModalOpen(false)} className="text-slate-400 hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSSOProvider} className="space-y-6 text-left">
              {/* SECTION: GENERAL SETTINGS */}
              <div className="space-y-4">
                <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">General Configuration</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Input
                    label="Display Name *"
                    placeholder="e.g. Corporate Google Login"
                    value={ssoDisplayName}
                    onChange={(e) => setSsoDisplayName(e.target.value)}
                    required
                    className="bg-slate-950 border-slate-800 text-white focus:border-[#F75F0A] focus:ring-[#F75F0A]"
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
                    className="bg-slate-950 border-slate-800 text-white focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-2">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-850">
                    <div className="space-y-0.5">
                      <label htmlFor="ssoIsEnabled" className="text-xs font-bold text-white cursor-pointer uppercase tracking-wide">
                        Status
                      </label>
                      <p className="text-[10px] text-slate-500">Enable login via this IDP</p>
                    </div>
                    <input
                      type="checkbox"
                      id="ssoIsEnabled"
                      checked={ssoIsEnabled}
                      onChange={(e) => setSsoIsEnabled(e.target.checked)}
                      className="h-4.5 w-4.5 rounded border border-slate-800 bg-slate-950 text-[#F75F0A] focus:ring-[#F75F0A] cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-850">
                    <div className="space-y-0.5">
                      <label htmlFor="ssoIsPrimary" className="text-xs font-bold text-white cursor-pointer uppercase tracking-wide">
                        Primary Provider
                      </label>
                      <p className="text-[10px] text-slate-500">Default redirect for SSO logins</p>
                    </div>
                    <input
                      type="checkbox"
                      id="ssoIsPrimary"
                      checked={ssoIsPrimary}
                      onChange={(e) => setSsoIsPrimary(e.target.checked)}
                      className="h-4.5 w-4.5 rounded border border-slate-800 bg-slate-950 text-[#F75F0A] focus:ring-[#F75F0A] cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950 border border-slate-850">
                    <div className="space-y-0.5">
                      <label htmlFor="ssoAutoProvision" className="text-xs font-bold text-white cursor-pointer uppercase tracking-wide">
                        Auto Provision
                      </label>
                      <p className="text-[10px] text-slate-500">Create account on success</p>
                    </div>
                    <input
                      type="checkbox"
                      id="ssoAutoProvision"
                      checked={ssoAutoProvision}
                      onChange={(e) => setSsoAutoProvision(e.target.checked)}
                      className="h-4.5 w-4.5 rounded border border-slate-800 bg-slate-950 text-[#F75F0A] focus:ring-[#F75F0A] cursor-pointer"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION: CREDENTIALS (OAUTH/OIDC) */}
              {(ssoModalMode === 'GOOGLE' || ssoModalMode === 'MICROSOFT' || ssoModalMode === 'OAUTH') && (
                <div className="space-y-4 border-t border-slate-850 pt-4">
                  <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">API & Client Credentials</h5>
                  <div className="space-y-4">
                    <Input
                      label="Client ID *"
                      placeholder="Enter identity provider Client ID"
                      value={ssoClientId}
                      onChange={(e) => setSsoClientId(e.target.value)}
                      required
                      className="bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                    />

                    <div className="relative">
                      <Input
                        label="Client Secret *"
                        type={showClientSecret ? 'text' : 'password'}
                        placeholder="••••••••••••••••"
                        value={ssoClientSecret}
                        onChange={(e) => setSsoClientSecret(e.target.value)}
                        required
                        className="pr-10 bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                      />
                      <button
                        type="button"
                        onClick={() => setShowClientSecret(!showClientSecret)}
                        className="absolute right-3 top-[38px] text-slate-400 hover:text-slate-200 transition-colors"
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
                      className="bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                    />
                  </div>
                </div>
              )}

              {/* MICROSOFT SPECIFIC */}
              {ssoModalMode === 'MICROSOFT' && (
                <div className="space-y-4 border-t border-slate-850 pt-4">
                  <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Microsoft Directory Settings</h5>
                  <Input
                    label="Directory (Tenant) ID *"
                    placeholder="e.g. common, organizations, or UUID"
                    value={ssoTenantId}
                    onChange={(e) => setSsoTenantId(e.target.value)}
                    required
                    className="bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                  />
                </div>
              )}

              {/* CUSTOM OAUTH SPECIFIC */}
              {ssoModalMode === 'OAUTH' && (
                <div className="space-y-4 border-t border-slate-850 pt-4">
                  <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Custom OAuth Endpoint Configuration</h5>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Authorization URL *"
                      placeholder="https://idp.example.com/oauth/authorize"
                      value={ssoAuthorizationUrl}
                      onChange={(e) => setSsoAuthorizationUrl(e.target.value)}
                      required
                      className="bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                    />
                    <Input
                      label="Token Exchange URL *"
                      placeholder="https://idp.example.com/oauth/token"
                      value={ssoTokenUrl}
                      onChange={(e) => setSsoTokenUrl(e.target.value)}
                      required
                      className="bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="User Profile Info URL *"
                      placeholder="https://idp.example.com/oauth/userinfo"
                      value={ssoUserInfoUrl}
                      onChange={(e) => setSsoUserInfoUrl(e.target.value)}
                      required
                      className="bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                    />
                    <Input
                      label="Authorization Scopes *"
                      placeholder="openid, profile, email"
                      value={ssoScopes}
                      onChange={(e) => setSsoScopes(e.target.value)}
                      required
                      className="bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                    />
                  </div>
                </div>
              )}

              {/* SAML SPECIFIC */}
              {ssoModalMode === 'SAML' && (
                <div className="space-y-4 border-t border-slate-850 pt-4">
                  <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">SAML 2.0 Directory Settings</h5>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Identity Provider Single Sign-On URL (EntryPoint) *"
                        placeholder="https://idp.example.com/saml/sso"
                        value={ssoSamlEntryPoint}
                        onChange={(e) => setSsoSamlEntryPoint(e.target.value)}
                        required
                        className="bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                      />
                      <Input
                        label="Identity Provider Issuer (Entity ID) *"
                        placeholder="https://idp.example.com/saml/metadata"
                        value={ssoSamlIssuer}
                        onChange={(e) => setSsoSamlIssuer(e.target.value)}
                        required
                        className="bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Input
                        label="Assertion Consumer Service (ACS) Callback URL *"
                        value={ssoSamlCallbackUrl}
                        onChange={(e) => setSsoSamlCallbackUrl(e.target.value)}
                        required
                        className="bg-slate-950 border-slate-800 text-white focus:border-[#F75F0A] focus:ring-[#F75F0A]"
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
                        className="bg-slate-950 border-slate-800 text-white focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                      />
                    </div>
                    <Textarea
                      label="X.509 Public Certificate (PEM format) *"
                      placeholder="-----BEGIN CERTIFICATE-----\nMIIB...-----END CERTIFICATE-----"
                      value={ssoSamlCert}
                      onChange={(e) => setSsoSamlCert(e.target.value)}
                      required
                      rows={5}
                      className="font-mono text-[11px] bg-slate-950 border-slate-800 text-white focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                    />
                  </div>
                </div>
              )}

              {/* ATTRIBUTE CLAIMS MAP SECTION (SAML & CUSTOM OAUTH) */}
              {(ssoModalMode === 'SAML' || ssoModalMode === 'OAUTH') && (
                <div className="space-y-4 border-t border-slate-850 pt-4">
                  <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Profile Claim Attribute Mappings</h5>
                  <p className="text-[11px] text-slate-500 leading-relaxed -mt-2">
                    Specify which keys in the SAML assertion or userinfo profile payload correspond to standard fields.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Email Attribute Key *"
                      value={ssoAttrEmail}
                      onChange={(e) => setSsoAttrEmail(e.target.value)}
                      required
                      className="bg-slate-950 border-slate-800 text-white focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                    />
                    <Input
                      label="Full Name Attribute Key *"
                      value={ssoAttrName}
                      onChange={(e) => setSsoAttrName(e.target.value)}
                      required
                      className="bg-slate-950 border-slate-800 text-white focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="First Name Attribute Key (Optional)"
                      value={ssoAttrFirstName}
                      onChange={(e) => setSsoAttrFirstName(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                    />
                    <Input
                      label="Last Name Attribute Key (Optional)"
                      value={ssoAttrLastName}
                      onChange={(e) => setSsoAttrLastName(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                    />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Input
                      label="Directory Groups Attribute Key (Optional)"
                      value={ssoAttrGroups}
                      onChange={(e) => setSsoAttrGroups(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                    />
                    <Input
                      label="Department Attribute Key (Optional)"
                      value={ssoAttrDepartment}
                      onChange={(e) => setSsoAttrDepartment(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-850">
                <Button
                  type="button"
                  onClick={() => setIsSSOModalOpen(false)}
                  className="bg-slate-950 hover:bg-slate-900 border border-slate-800 text-white font-bold py-2 text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  isLoading={registerProviderMutation.isPending}
                  className="bg-[#F75F0A] hover:bg-[#F75F0A]/90 text-white font-bold py-2 text-xs"
                >
                  Save Configuration
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SignupPage;
