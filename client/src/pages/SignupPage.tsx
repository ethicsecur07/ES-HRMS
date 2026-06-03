import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '../Components/WrapperComponents/Card';
import { Input } from '../Components/WrapperComponents/Input';
import { Button } from '../Components/WrapperComponents/Button';
import { Select } from '../Components/WrapperComponents/Input';
import { authApi } from '../api_service/authApi';
import { useNotificationStore } from '../store/useNotificationStore';
import { useAuthStore } from '../store/useAuthStore';
import { Building2, Shield, Lock, User, Mail, Sparkles, Globe, Chrome, Cpu, KeyRound } from 'lucide-react';

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const addToast = useNotificationStore((state) => state.addToast);
  const login = useAuthStore((state) => state.login);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1);

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

  // SSO Flow States (Mandatory SSO)
  const [ssoProvider, setSsoProvider] = useState<'GOOGLE' | 'MICROSOFT' | 'OAUTH' | 'SAML'>('GOOGLE');
  const [ssoConfig, setSsoConfig] = useState({
    clientId: '',
    clientSecret: '',
    tenantId: 'common',
    redirectUri: window.location.origin + '/sso/callback',
    authorizationUrl: '',
    tokenUrl: '',
    userInfoUrl: '',
    scopes: 'openid, profile, email',
    samlEntryPoint: '',
    samlIssuer: '',
    samlCert: '',
  });

  const handleSsoConfigChange = (field: string, value: string) => {
    setSsoConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

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

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    const { name, email, password, organizationName, organizationSlug, organizationSector } = formData;

    if (!name || !email || !password || !organizationName || !organizationSlug || !organizationSector) {
      addToast('Validation Error', 'Please fill in all details.', 'error');
      return;
    }

    if (passwordStrength.score < 5) {
      addToast('Password Weak', 'Please satisfy all complexity requirements (length >= 8, uppercase, lowercase, number, and special character).', 'warning');
      return;
    }

    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate SSO config fields based on ssoProvider
    if (ssoProvider === 'GOOGLE' || ssoProvider === 'MICROSOFT' || ssoProvider === 'OAUTH') {
      if (!ssoConfig.clientId || !ssoConfig.clientSecret) {
        addToast('Validation Error', 'Client ID and Client Secret are required.', 'error');
        return;
      }
    }
    if (ssoProvider === 'MICROSOFT' && !ssoConfig.tenantId) {
      addToast('Validation Error', 'Tenant ID is required for Microsoft Entra ID.', 'error');
      return;
    }
    if (ssoProvider === 'OAUTH') {
      if (!ssoConfig.authorizationUrl || !ssoConfig.tokenUrl || !ssoConfig.userInfoUrl) {
        addToast('Validation Error', 'All OAuth Endpoint URLs are required.', 'error');
        return;
      }
    }
    if (ssoProvider === 'SAML') {
      if (!ssoConfig.samlEntryPoint || !ssoConfig.samlIssuer || !ssoConfig.samlCert) {
        addToast('Validation Error', 'All SAML configuration fields are required.', 'error');
        return;
      }
    }

    setLoading(true);
    try {
      const response = await authApi.signup({
        ...formData,
        ssoProvider,
        ssoConfig,
      });

      if (response.user && response.token) {
        addToast('Registration Successful', `Organization "${formData.organizationName}" registered and logged in successfully!`, 'success');
        login(response.user, response.token);
        navigate('/dashboard');
      } else {
        addToast('Registration Successful', `Organization "${formData.organizationName}" registered successfully!`, 'success');
        navigate(`/login?tenant=${formData.organizationSlug}`);
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Organization registration failed. Please try again.';
      addToast('Registration Failed', msg, 'error');
    } finally {
      setLoading(false);
    }
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

      {/* Floating System Shield Banner */}
      <div className="absolute top-8 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-slate-900/60 border border-slate-800/80 px-4 py-2 rounded-full backdrop-blur-md">
        <Shield className="w-4 h-4 text-[#F75F0A]" />
        <span className="text-[10px] font-black uppercase tracking-widest text-slate-300">
          Zero-Trust Tenant Registration Active
        </span>
      </div>

      <Card className="w-full max-w-xl p-8 z-10 border border-slate-800 shadow-2xl backdrop-blur-xl bg-slate-900/90 text-white">
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-[#F75F0A]/10 border border-[#F75F0A]/20 text-[#F75F0A] rounded-2xl flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Register New Organization</h2>
          <p className="text-xs text-slate-400 mt-1">
            Establish your business workspace domain and configure your administrator account in one click.
          </p>
        </div>

        {/* Step Progress Indicator */}
        <div className="flex items-center justify-center mb-8 px-4">
          <div className="flex items-center w-full max-w-xs">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs border transition-all ${
              step === 1
                ? 'bg-[#F75F0A] border-[#F75F0A] text-white shadow-lg shadow-[#F75F0A]/20'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
            }`}>
              {step > 1 ? '✓' : '1'}
            </div>
            <div className={`flex-1 h-0.5 mx-2 transition-all ${step > 1 ? 'bg-[#F75F0A]' : 'bg-slate-850'}`}></div>
            <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs border transition-all ${
              step === 2
                ? 'bg-[#F75F0A] border-[#F75F0A] text-white shadow-lg shadow-[#F75F0A]/20'
                : 'bg-slate-900 border-slate-800 text-slate-500'
            }`}>
              2
            </div>
          </div>
        </div>

        <form onSubmit={step === 1 ? handleNextStep : handleSubmit} className="space-y-4 px-2">
          {/* Step 1: Workspace Profile Settings */}
          {step === 1 && (
            <div className="space-y-4 animate-in fade-in duration-300">
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

              {/* Action Buttons for Step 1 */}
              <div className="pt-4 space-y-3">
                <Button
                  type="submit"
                  className="w-full bg-[#F75F0A] hover:bg-[#F75F0A]/90 text-white font-bold tracking-wider py-3 shadow-lg shadow-[#F75F0A]/20 hover:shadow-[#F75F0A]/30 transition-all scale-[1.01] mt-2 flex items-center justify-center"
                >
                  CONTINUE TO SSO CONFIGURATION
                </Button>

                <div className="text-center text-xs text-slate-400">
                  Already have an active organization?{' '}
                  <Link to="/login" className="text-[#F75F0A] font-bold hover:underline">
                    Sign In
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: SSO Configuration */}
          {step === 2 && (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="space-y-4 p-3 bg-slate-950/50 border border-slate-850 rounded-xl">
                <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
                  <Globe className="w-4 h-4 text-[#F75F0A]" />
                  <span className="text-[10px] font-black uppercase tracking-wider text-[#F75F0A]">
                    Single Sign-On (SSO) Integration (Required)
                  </span>
                </div>

                <p className="text-[10px] text-slate-400 font-sans leading-relaxed">
                  Configure corporate Single Sign-On. Once set up, members of your workspace can authenticate instantly using their identity provider.
                </p>

                {/* Identity Provider Cards Grid */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'GOOGLE', label: 'Google Workspace', icon: <Chrome className="w-4 h-4 text-red-400" /> },
                    {
                      id: 'MICROSOFT',
                      label: 'Microsoft Entra ID',
                      icon: (
                        <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 21 21" xmlns="http://www.w3.org/2000/svg">
                          <rect x="0" y="0" width="10" height="10" fill="#F25022"/>
                          <rect x="11" y="0" width="10" height="10" fill="#7FBA00"/>
                          <rect x="0" y="11" width="10" height="10" fill="#00A4EF"/>
                          <rect x="11" y="11" width="10" height="10" fill="#FFB900"/>
                        </svg>
                      ),
                    },
                    { id: 'OAUTH', label: 'Custom OAuth 2.0', icon: <Cpu className="w-4 h-4 text-cyan-400" /> },
                    { id: 'SAML', label: 'SAML 2.0 SSO', icon: <KeyRound className="w-4 h-4 text-amber-400" /> },
                  ].map((prov) => {
                    const isSelected = ssoProvider === prov.id;
                    return (
                      <button
                        key={prov.id}
                        type="button"
                        onClick={() => setSsoProvider(prov.id as any)}
                        className={`p-2.5 rounded-lg border text-left flex flex-col justify-between h-20 transition-all ${
                          isSelected
                            ? 'border-[#F75F0A] bg-[#F75F0A]/10 shadow-[#F75F0A]/5 shadow-sm'
                            : 'border-slate-800 bg-slate-950/40 hover:bg-slate-900/60 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex justify-between items-center w-full">
                          {prov.icon}
                          {isSelected && (
                            <span className="w-3.5 h-3.5 rounded-full bg-[#F75F0A] flex items-center justify-center text-[8px] font-black text-white">
                              ✓
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] font-bold text-slate-200 mt-1 block">
                          {prov.label}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Dynamic SSO Config Fields */}
                <div className="space-y-3 pt-2 border-t border-slate-900 animate-in fade-in duration-200">
                  {(ssoProvider === 'GOOGLE' || ssoProvider === 'MICROSOFT' || ssoProvider === 'OAUTH') && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input
                        label="Client ID"
                        value={ssoConfig.clientId}
                        onChange={(e) => handleSsoConfigChange('clientId', e.target.value)}
                        placeholder="Enter client credential ID"
                        className="bg-slate-950 border-slate-800 text-xs text-white placeholder-slate-650 focus:border-[#F75F0A]"
                        required
                      />
                      <Input
                        label="Client Secret"
                        type="password"
                        value={ssoConfig.clientSecret}
                        onChange={(e) => handleSsoConfigChange('clientSecret', e.target.value)}
                        placeholder="Enter client credential secret"
                        className="bg-slate-950 border-slate-800 text-xs text-white placeholder-slate-650 focus:border-[#F75F0A]"
                        required
                      />
                    </div>
                  )}

                  {ssoProvider === 'MICROSOFT' && (
                    <Input
                      label="Tenant ID"
                      value={ssoConfig.tenantId}
                      onChange={(e) => handleSsoConfigChange('tenantId', e.target.value)}
                      placeholder="e.g. common, organizations, or UUID"
                      className="bg-slate-950 border-slate-800 text-xs text-white placeholder-slate-650 focus:border-[#F75F0A]"
                      required
                    />
                  )}

                  {ssoProvider === 'OAUTH' && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          label="Authorization Endpoint URL"
                          value={ssoConfig.authorizationUrl}
                          onChange={(e) => handleSsoConfigChange('authorizationUrl', e.target.value)}
                          placeholder="https://example.com/oauth/authorize"
                          className="bg-slate-950 border-slate-800 text-xs text-white placeholder-slate-650 focus:border-[#F75F0A]"
                          required
                        />
                        <Input
                          label="Token Endpoint URL"
                          value={ssoConfig.tokenUrl}
                          onChange={(e) => handleSsoConfigChange('tokenUrl', e.target.value)}
                          placeholder="https://example.com/oauth/token"
                          className="bg-slate-950 border-slate-800 text-xs text-white placeholder-slate-650 focus:border-[#F75F0A]"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          label="User Info Endpoint URL"
                          value={ssoConfig.userInfoUrl}
                          onChange={(e) => handleSsoConfigChange('userInfoUrl', e.target.value)}
                          placeholder="https://example.com/oauth/userinfo"
                          className="bg-slate-950 border-slate-800 text-xs text-white placeholder-slate-650 focus:border-[#F75F0A]"
                          required
                        />
                        <Input
                          label="OAuth Scopes"
                          value={ssoConfig.scopes}
                          onChange={(e) => handleSsoConfigChange('scopes', e.target.value)}
                          placeholder="openid, profile, email"
                          className="bg-slate-950 border-slate-800 text-xs text-white placeholder-slate-650 focus:border-[#F75F0A]"
                          required
                        />
                      </div>
                    </>
                  )}

                  {ssoProvider === 'SAML' && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <Input
                          label="Identity Provider Entry Point (SSO URL)"
                          value={ssoConfig.samlEntryPoint}
                          onChange={(e) => handleSsoConfigChange('samlEntryPoint', e.target.value)}
                          placeholder="https://idp.example.com/saml/sso"
                          className="bg-slate-950 border-slate-800 text-xs text-white placeholder-slate-650 focus:border-[#F75F0A]"
                          required
                        />
                        <Input
                          label="Issuer (Entity ID)"
                          value={ssoConfig.samlIssuer}
                          onChange={(e) => handleSsoConfigChange('samlIssuer', e.target.value)}
                          placeholder="e.g. es-hrms-client"
                          className="bg-slate-950 border-slate-800 text-xs text-white placeholder-slate-650 focus:border-[#F75F0A]"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-[12px] font-medium text-foreground mb-1.5 text-left">
                          Public x509 Certificate
                        </label>
                        <textarea
                          value={ssoConfig.samlCert}
                          onChange={(e) => handleSsoConfigChange('samlCert', e.target.value)}
                          placeholder="-----BEGIN CERTIFICATE-----\nMIIDXTCCAkWgAwIBAgIJA..."
                          className="w-full h-24 p-2 font-mono text-[10px] rounded-lg border border-slate-800 bg-slate-950 text-white placeholder-slate-700 focus:border-[#F75F0A] focus:ring-1 focus:ring-[#F75F0A] focus:outline-none"
                          required
                        />
                      </div>
                    </>
                  )}

                  <Input
                    label="OAuth/SAML Callback URL (Redirect URI)"
                    value={ssoConfig.redirectUri}
                    onChange={(e) => handleSsoConfigChange('redirectUri', e.target.value)}
                    placeholder="http://localhost:5173/sso/callback"
                    className="bg-slate-950 border-slate-800 text-xs text-white placeholder-slate-650 focus:border-[#F75F0A]"
                    required
                    disabled
                  />
                  <p className="text-[9px] text-slate-500 font-sans">
                    * This callback URL is read-only and preconfigured to receive credentials from your provider securely.
                  </p>
                </div>
              </div>

              {/* Action Buttons for Step 2 */}
              <div className="pt-4 flex gap-3">
                <Button
                  type="button"
                  onClick={() => setStep(1)}
                  variant="outline"
                  className="w-1/3 border-slate-800 text-slate-350 hover:bg-slate-900/60 font-bold py-3 shadow-md transition-all flex items-center justify-center"
                >
                  BACK
                </Button>

                <Button
                  type="submit"
                  className="w-2/3 bg-[#F75F0A] hover:bg-[#F75F0A]/90 text-white font-bold tracking-wider py-3 shadow-lg shadow-[#F75F0A]/20 hover:shadow-[#F75F0A]/30 transition-all scale-[1.01] flex items-center justify-center"
                  isLoading={loading}
                >
                  <Building2 className="w-5 h-5 mr-2" />
                  REGISTER WORKSPACE
                </Button>
              </div>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
};

export default SignupPage;
