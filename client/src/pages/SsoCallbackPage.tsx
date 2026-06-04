import React, { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { useNotificationStore } from '../store/useNotificationStore';
import { authV2Api } from '../api_service/authV2Api';
import { Card } from '../Components/WrapperComponents/Card';
import { Loader2, ShieldCheck } from 'lucide-react';
import ESLogo from '../assets/ES_Logo.png';

export const SsoCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { addToast } = useNotificationStore();
  const isTriggered = useRef(false);

  useEffect(() => {
    if (isTriggered.current) return;
    isTriggered.current = true;

    const handleCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const samlResponse = searchParams.get('SAMLResponse');
      const ssoContext = sessionStorage.getItem('es-hrms-sso-context');
      let parsedContext: { orgSlug?: string; providerType?: string } = {};
      try {
        parsedContext = ssoContext ? JSON.parse(ssoContext) : {};
      } catch {
        sessionStorage.removeItem('es-hrms-sso-context');
      }

      // Recover organization slug and provider type from the state parameter if sessionStorage was lost (e.g. cross-port redirect)
      if ((!parsedContext.orgSlug || !parsedContext.providerType) && state) {
        const parts = state.split('_');
        if (parts.length >= 3) {
          parsedContext.orgSlug = parts[1];
          parsedContext.providerType = parts[2];
        }
      }

      if (!code && !samlResponse) {
        addToast('SSO Error', 'Authorization code or SAML assertion was not received.', 'error');
        navigate('/login');
        return;
      }

      try {
        const payload: any = {};
        if (code) payload.code = code;
        if (state) payload.state = state;
        if (samlResponse) payload.SAMLResponse = samlResponse;
        if (parsedContext.orgSlug) payload.orgSlug = parsedContext.orgSlug;
        if (parsedContext.providerType) payload.providerType = parsedContext.providerType;

        // Fetch user from tenant callback
        const data = await authV2Api.handleSSOCallback(payload);
        
        sessionStorage.removeItem('es-hrms-sso-context');
        login(data.user, data.token);
        addToast('Single Sign-On Successful', `Welcome back, ${data.user.name}!`, 'success');
        navigate('/dashboard');
      } catch (err: any) {
        console.error('SSO callback exchange failed', err);
        addToast('SSO Error', err.response?.data?.message || 'Identity token exchange failed. Please contact your IT administrator.', 'error');
        navigate('/login');
      }
    };

    handleCallback();
  }, [searchParams, navigate, login, addToast]);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-background p-4 overflow-hidden relative">
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl pointer-events-none animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl pointer-events-none animate-pulse delay-1000"></div>

      <Card className="w-full max-w-md p-8 z-10 border border-border shadow-2xl backdrop-blur-xl bg-card/90 text-center space-y-6">
        <img src={ESLogo} alt="EthicSec Logo" className="h-16 w-16 mx-auto object-contain drop-shadow-md" />
        
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-foreground tracking-tight">Enterprise SSO</h2>
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
            Securing Single Sign-On session
          </p>
        </div>

        <div className="py-6 flex flex-col items-center justify-center gap-4">
          <Loader2 className="w-10 h-10 text-primary animate-spin" />
          <div className="text-sm font-semibold text-foreground animate-pulse">
            Authenticating your corporate account...
          </div>
          <div className="text-xs text-muted-foreground leading-relaxed max-w-xs">
            Exchanging secure authorization claims and establishing your encrypted HRMS workspace session.
          </div>
        </div>

        <div className="pt-4 border-t border-border flex items-center justify-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
          <ShieldCheck className="w-4 h-4 text-primary" />
          Powered by EthicSecur IAM Engine v2
        </div>
      </Card>
    </div>
  );
};
