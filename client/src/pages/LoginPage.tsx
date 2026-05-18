import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { authApi } from '../api_service/authApi';
import { Button } from '../Components/WrapperComponents/Button';
import { Input } from '../Components/WrapperComponents/Input';
import { Card } from '../Components/WrapperComponents/Card';
import { ShieldCheck, Lock, Mail } from 'lucide-react';
import type { Role } from '../types';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>('ADMIN');
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { addToast } = useNotificationStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      addToast('Validation Error', 'Please enter your email address', 'error');
      return;
    }

    setIsLoading(true);
    try {
      const data = await authApi.login({ email, password, role: selectedRole });
      login(data.user, data.token);
      addToast('Login Successful', `Welcome back, ${data.user.name}!`, 'success');
      navigate('/dashboard');
    } catch {
      addToast('Login Error', 'Invalid credentials. Please try again.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 overflow-hidden relative">
      {/* Background glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl pointer-events-none animate-pulse delay-1000"></div>

      <Card className="w-full max-w-lg p-8 z-10 border border-border shadow-2xl backdrop-blur-xl bg-card/90">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-primary to-accent text-white font-black text-3xl shadow-lg shadow-primary/30 mb-4">
            ES
          </div>
          <h2 className="text-3xl font-extrabold text-foreground tracking-tight">ETHICSEC HRMS</h2>
          <p className="text-sm text-muted-foreground mt-1 font-medium">
            Enterprise Workforce & Payroll Management SaaS
          </p>
        </div>

        {/* Professional Role Selector Tabs */}
        <div className="mb-6 p-1.5 rounded-xl bg-muted border border-border grid grid-cols-3 gap-1.5">
          {(['ADMIN', 'HR', 'EMPLOYEE'] as Role[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setSelectedRole(r)}
              className={`py-2.5 text-xs font-bold rounded-lg transition-all ${
                selectedRole === r
                  ? 'bg-card text-foreground shadow-sm border border-border scale-[1.02]'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {r === 'ADMIN' ? 'Administrator' : r === 'HR' ? 'HR Manager' : 'Employee'}
            </button>
          ))}
        </div>

        <form onSubmit={handleLogin} className="space-y-5 text-left">
          <div className="relative">
            <Mail className="absolute left-3 top-9 h-4 w-4 text-muted-foreground" />
            <Input
              label="Work Email Address"
              type="email"
              placeholder="name@ethicsec.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10"
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-3 top-9 h-4 w-4 text-muted-foreground" />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="flex items-center justify-between text-xs">
            <label className="flex items-center gap-2 text-muted-foreground cursor-pointer">
              <input type="checkbox" className="rounded border-border text-primary focus:ring-primary h-4 w-4" defaultChecked />
              <span>Remember 30-day session</span>
            </label>
            <a href="#forgot" onClick={() => addToast('Reset Link Sent', 'Password reset instructions sent to email.', 'info')} className="text-primary font-bold hover:underline">
              Forgot password?
            </a>
          </div>

          <Button
            type="submit"
            isLoading={isLoading}
            className="w-full bg-gradient-to-r from-primary to-accent text-white font-bold tracking-wider py-3 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all scale-[1.01]"
          >
            <ShieldCheck className="w-5 h-5 mr-2" />
            SECURE SIGN IN
          </Button>
        </form>

        <div className="mt-8 pt-6 border-t border-border text-center text-xs text-muted-foreground">
          <p className="font-semibold text-foreground">Office IP Restriction Active</p>
          <p className="mt-1">Access outside office WiFi requires HR pre-approved WFH override.</p>
        </div>
      </Card>
    </div>
  );
};
