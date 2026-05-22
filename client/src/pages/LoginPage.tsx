import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { useTenantStore } from '../store/useTenantStore';
import { authApi } from '../api_service/authApi';
import { authV2Api } from '../api_service/authV2Api';
import { Button } from '../Components/WrapperComponents/Button';
import { Input } from '../Components/WrapperComponents/Input';
import { Card } from '../Components/WrapperComponents/Card';
import {
  ShieldCheck,
  Lock,
  Mail,
  Eye,
  EyeOff,
  Building2,
  KeyRound,
  Chrome,
  Terminal,
  ChevronRight,
  Fingerprint
} from 'lucide-react';
import type { Role } from '../types';
import ESLogo from '../assets/ES_Logo.png';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tenantSlug, setTenantSlug] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<Role>('ADMIN');
  const [isLoading, setIsLoading] = useState(false);

  // MFA Flow States
  const [isMfaRequired, setIsMfaRequired] = useState(false);
  const [mfaPendingToken, setMfaPendingToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [isMfaLoading, setIsMfaLoading] = useState(false);

  const navigate = useNavigate();
  const { login, isAuthenticated } = useAuthStore();
  const { addToast } = useNotificationStore();
  const { tenantConfig, fetchTenantConfig, clearTenantConfig } = useTenantStore();

  // If tenantConfig is resolved, set the tenantSlug state
  useEffect(() => {
    if (tenantConfig) {
      setTenantSlug(tenantConfig.slug);
    }
  }, [tenantConfig]);

  useEffect(() => {
    if (isAuthenticated) {
      navigate('/dashboard');
    }
  }, [isAuthenticated, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const activeSlug = tenantConfig ? tenantConfig.slug : tenantSlug.trim().toLowerCase();

    if (!activeSlug || !email || !password) {
      addToast('Validation Error', 'Please enter organization, email, and password.', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const data = await authApi.login({
        email,
        password,
        role: selectedRole,
        tenantSlug: activeSlug,
      });

      if (data.mfaRequired && data.mfaToken) {
        setIsMfaRequired(true);
        setMfaPendingToken(data.mfaToken);
        addToast('MFA Required', 'Please enter your verification code to complete sign-in.', 'info');
      } else {
        login(data.user, data.token);
        addToast('Login Successful', `Welcome back, ${data.user.name}!`, 'success');
        navigate('/dashboard');
      }
    } catch (err: any) {
      addToast(
        'Login Error',
        err.response?.data?.message || 'Invalid credentials or organization. Please try again.',
        'error'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaPendingToken || !mfaCode) {
      addToast('Validation Error', 'Please enter your verification code.', 'error');
      return;
    }

    setIsMfaLoading(true);
    try {
      const data = await authApi.verifyMfa({
        mfaToken: mfaPendingToken,
        code: mfaCode,
      });

      login(data.user, data.token);
      addToast('MFA Verification Successful', `Welcome back, ${data.user.name}!`, 'success');
      navigate('/dashboard');
    } catch (err: any) {
      addToast(
        'Verification Failed',
        err.response?.data?.message || 'Invalid verification code. Please try again.',
        'error'
      );
    } finally {
      setIsMfaLoading(false);
    }
  };

  const handleSsoLogin = async (providerType: string) => {
    const activeSlug = tenantConfig ? tenantConfig.slug : tenantSlug.trim().toLowerCase();
    if (!activeSlug) {
      addToast('Organization Required', 'Enter your organization slug before starting SSO.', 'error');
      return;
    }

    try {
      await authV2Api.initiateSSO(activeSlug, providerType);
    } catch (error: any) {
      addToast(
        'SSO Unavailable',
        error.response?.data?.message ||
          'This identity provider is not available for the selected organization.',
        'error'
      );
    }
  };

  const handleManualSlugResolve = async (e: React.FocusEvent<HTMLInputElement>) => {
    const slug = e.target.value.trim().toLowerCase();
    if (slug.length > 1) {
      await fetchTenantConfig(slug);
    }
  };

  // Branding helper values
  const themeSetting = tenantConfig?.settings?.theme || 'dark';
  const logoUrl = tenantConfig?.settings?.logoUrl || ESLogo;
  const brandName = tenantConfig?.name || 'ES EthicSecur SofTec HRMS';
  const authProviders = tenantConfig?.authProviders || [];
  const isLocalEnabled = selectedRole === 'ADMIN' || !tenantConfig || authProviders.includes('LOCAL');

  return (
    <div className={`min-h-screen w-full flex items-center justify-center bg-slate-950 p-4 overflow-hidden relative ${themeSetting}`}>
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#F75F0A]/10 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none animate-pulse delay-1000"></div>

      {!isMfaRequired ? (
        <Card className="w-full max-w-lg p-8 z-10 border border-slate-800 shadow-2xl backdrop-blur-xl bg-slate-900/90 text-white">
          <div className="text-center mb-8">
            <img
              src={logoUrl}
              alt="Organization Logo"
              className="h-16 w-16 mx-auto object-contain drop-shadow-md mb-4 rounded-xl"
            />
            <h2 className="text-2xl font-extrabold text-white tracking-tight">{brandName}</h2>
            <p className="text-xs text-slate-400 mt-1.5 font-medium">
              {tenantConfig?.sector
                ? `${tenantConfig.sector} Portal • Enterprise IAM Secure Gate`
                : 'Enterprise Workforce & Payroll Management SaaS'}
            </p>

            {tenantConfig && (
              <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#F75F0A]/10 border border-[#F75F0A]/20 text-[#F75F0A] text-[10px] font-bold">
                <ShieldCheck className="w-3.5 h-3.5" />
                Verified Organization Portal
                <button
                  type="button"
                  onClick={() => {
                    clearTenantConfig();
                    setTenantSlug('');
                  }}
                  className="text-slate-400 hover:text-white underline ml-1.5 font-normal"
                >
                  Change
                </button>
              </div>
            )}
          </div>

          {/* Professional Role Selector Tabs */}
          <div className="mb-6 p-1 rounded-xl bg-slate-950 border border-slate-850 grid grid-cols-3 gap-1">
            {(['ADMIN', 'HR', 'EMPLOYEE'] as Role[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRole(r)}
                className={`py-2 text-xs font-bold rounded-lg transition-all ${
                  selectedRole === r
                    ? 'bg-[#F75F0A] text-white shadow-md border border-[#F75F0A]/80 scale-[1.02]'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {r === 'ADMIN' ? 'Administrator' : r === 'HR' ? 'HR Manager' : 'Employee'}
              </button>
            ))}
          </div>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            {/* Show organization input ONLY if tenantConfig is not resolved */}
            {!tenantConfig && (
              <div className="relative">
                <Building2 className="absolute left-3 top-[34px] h-4 w-4 text-slate-400" />
                <Input
                  label="Organization Code (Slug)"
                  type="text"
                  placeholder="e.g. techcorp"
                  value={tenantSlug}
                  onChange={(e) => setTenantSlug(e.target.value)}
                  onBlur={handleManualSlugResolve}
                  className="pl-10 bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                  required
                />
              </div>
            )}

            {/* Dynamic SSO Buttons */}
            {tenantConfig && authProviders.filter((p) => p !== 'LOCAL').length > 0 && (
              <div className="space-y-2 mb-4">
                <p className="text-[10px] uppercase font-bold text-slate-500 tracking-wider text-center">
                  Sign in with Corporate SSO
                </p>
                <div className="grid grid-cols-1 gap-2">
                  {authProviders
                    .filter((p) => p !== 'LOCAL')
                    .map((provider) => (
                      <Button
                        key={provider}
                        type="button"
                        variant="outline"
                        onClick={() => handleSsoLogin(provider)}
                        className="w-full border-slate-800 text-slate-200 hover:bg-slate-850 hover:text-white flex items-center justify-center py-2.5"
                      >
                        {provider === 'GOOGLE' ? (
                          <Chrome className="w-4 h-4 mr-2 text-red-400" />
                        ) : provider === 'MICROSOFT' ? (
                          <Terminal className="w-4 h-4 mr-2 text-[#F75F0A]" />
                        ) : (
                          <KeyRound className="w-4 h-4 mr-2 text-[#F75F0A]" />
                        )}
                        Continue with {provider.charAt(0) + provider.slice(1).toLowerCase()}
                      </Button>
                    ))}
                </div>

                {isLocalEnabled && (
                  <div className="relative my-4 flex items-center justify-center">
                    <span className="absolute inset-x-0 h-px bg-slate-850"></span>
                    <span className="relative bg-slate-900 px-3 text-[10px] text-slate-500 uppercase font-bold">
                      Or local login
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Local Username & Password Form */}
            {isLocalEnabled && (
              <>
                <div className="relative">
                  <Mail className="absolute left-3 top-[34px] h-4 w-4 text-slate-400" />
                  <Input
                    label="Work Email Address"
                    type="email"
                    placeholder="name@organization.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                    required
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-[34px] h-4 w-4 text-slate-400" />
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 bg-slate-950 border-slate-800 text-white placeholder-slate-500 focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-[34px] text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      className="rounded border-slate-800 bg-slate-950 text-[#F75F0A] focus:ring-[#F75F0A] h-4 w-4"
                      defaultChecked
                    />
                    <span>Remember 30-day session</span>
                  </label>
                  <a
                    href="#forgot"
                    onClick={() =>
                      addToast(
                        'Reset Link Sent',
                        'Password reset instructions sent to email.',
                        'info'
                      )
                    }
                    className="text-[#F75F0A] font-bold hover:underline"
                  >
                    Forgot password?
                  </a>
                </div>

                <Button
                  type="submit"
                  isLoading={isLoading}
                  className="w-full bg-[#F75F0A] hover:bg-[#F75F0A]/90 text-white font-bold tracking-wider py-3 shadow-lg shadow-[#F75F0A]/20 hover:shadow-[#F75F0A]/30 transition-all scale-[1.01] mt-2 flex items-center justify-center"
                >
                  <ShieldCheck className="w-5 h-5 mr-2" />
                  SECURE SIGN IN
                </Button>
              </>
            )}

            {!isLocalEnabled && (
              <div className="text-center py-6 text-slate-400 text-xs bg-slate-950/50 rounded-xl border border-slate-850">
                <Lock className="w-8 h-8 mx-auto text-[#F75F0A]/50 mb-2" />
                Local password logins are disabled for your organization. Please use one of the corporate single
                sign-on providers listed above.
              </div>
            )}
          </form>

          {/* Developer Sandbox Quick Access */}
          <div className="mt-6 pt-5 border-t border-slate-850 text-center animate-in fade-in slide-in-from-bottom-2 duration-300">
            <p className="text-[9px] uppercase font-black text-[#F75F0A] tracking-wider mb-3">
              Developer Sandbox • One-Click Role Switcher
            </p>
            <div className="grid grid-cols-5 gap-1.5">
              {(['ADMIN', 'MANAGER', 'HR', 'TEAM_LEAD', 'EMPLOYEE'] as Role[]).map((r) => {
                const colors: Record<Role, string> = {
                  ADMIN: 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 hover:border-red-500/40',
                  MANAGER: 'bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border-indigo-500/20 hover:border-indigo-500/40',
                  HR: 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40',
                  TEAM_LEAD: 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border-amber-500/20 hover:border-amber-500/40',
                  EMPLOYEE: 'bg-slate-800 hover:bg-slate-700 text-slate-300 border-slate-750 hover:border-slate-650',
                };
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      useAuthStore.getState().setDemoUser(r);
                      addToast('Sandbox Access', `Logged in as Demo ${r}`, 'success');
                      navigate('/dashboard');
                    }}
                    className={`py-2 px-1 text-[9px] font-black tracking-tight rounded-lg border transition-all duration-200 uppercase active:scale-95 ${colors[r]}`}
                    title={`Log in as ${r}`}
                  >
                    {r.replace('_', ' ')}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 pt-5 border-t border-slate-850 text-center text-xs text-slate-500">
            <p className="font-semibold text-slate-400">Zero-Trust Enterprise IAM Active</p>
            <p className="mt-1">
              Geofenced check-ins are active. Sessions outside allowed network bounds are logged under WFH logs.
            </p>
          </div>
        </Card>
      ) : (
        /* MFA Prompt challenge screen */
        <Card className="w-full max-w-md p-8 z-10 border border-slate-800 shadow-2xl backdrop-blur-xl bg-slate-900/90 text-white text-center">
          <div className="mb-6">
            <div className="w-14 h-14 bg-[#F75F0A]/10 border border-[#F75F0A]/20 text-[#F75F0A] rounded-full flex items-center justify-center mx-auto mb-4 animate-bounce">
              <Fingerprint className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-extrabold text-white tracking-tight">Two-Factor Authentication</h2>
            <p className="text-xs text-slate-400 mt-2">
              Provide the 6-digit verification code from your authenticator app or one of your backup recovery
              codes to verify your identity.
            </p>
          </div>

          <form onSubmit={handleMfaVerify} className="space-y-4">
            <div className="relative text-left">
              <Input
                label="Verification Code"
                type="text"
                placeholder="000000 or backup code"
                value={mfaCode}
                onChange={(e) => setMfaCode(e.target.value)}
                className="bg-slate-950 border-slate-800 text-white text-center tracking-widest text-lg font-bold placeholder-slate-700 focus:border-[#F75F0A] focus:ring-[#F75F0A]"
                maxLength={16}
                required
                autoFocus
              />
            </div>

            <Button
              type="submit"
              isLoading={isMfaLoading}
              className="w-full bg-[#F75F0A] hover:bg-[#F75F0A]/90 text-white font-bold py-2.5 shadow-lg shadow-[#F75F0A]/20 flex items-center justify-center"
            >
              Verify Code
              <ChevronRight className="w-4 h-4 ml-1.5" />
            </Button>

            <button
              type="button"
              onClick={() => {
                setIsMfaRequired(false);
                setMfaPendingToken(null);
                setMfaCode('');
              }}
              className="text-slate-400 hover:text-slate-200 text-xs mt-2 transition-colors block mx-auto underline"
            >
              Cancel and go back
            </button>
          </form>
        </Card>
      )}
    </div>
  );
};
