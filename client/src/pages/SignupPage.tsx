import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card } from '../Components/WrapperComponents/Card';
import { Input } from '../Components/WrapperComponents/Input';
import { Button } from '../Components/WrapperComponents/Button';
import { Select } from '../Components/WrapperComponents/Input';
import { authApi } from '../api_service/authApi';
import { useNotificationStore } from '../store/useNotificationStore';
import { Building2, Shield, Lock, User, Mail, Sparkles } from 'lucide-react';

export const SignupPage: React.FC = () => {
  const navigate = useNavigate();
  const addToast = useNotificationStore((state) => state.addToast);
  const [loading, setLoading] = useState(false);

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

  const handleSubmit = async (e: React.FormEvent) => {
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
        addToast('Registration Successful', `Organization "${organizationName}" registered successfully!`, 'success');
        // Redirect to login page and prepopulate tenant slug
        navigate(`/login?tenant=${response.slug}`);
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

        <form onSubmit={handleSubmit} className="space-y-4 px-2">
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
    </div>
  );
};

export default SignupPage;
