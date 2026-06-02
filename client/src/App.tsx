import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { Layout } from './Components/WrapperComponents/Layout';
import { ProtectedRoute } from './Components/WrapperComponents/ProtectedRoute';

// Code splitting (Lazy Loading)
const LoginPage = lazy(() => import('./pages/LoginPage').then(m => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('./pages/SignupPage').then(m => ({ default: m.SignupPage }))); // signup route configuration
const SsoCallbackPage = lazy(() => import('./pages/SsoCallbackPage').then(m => ({ default: m.SsoCallbackPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const EmployeesPage = lazy(() => import('./pages/EmployeesPage').then(m => ({ default: m.EmployeesPage })));
const EmployeeDetailsPage = lazy(() => import('./pages/EmployeeDetailsPage').then(m => ({ default: m.EmployeeDetailsPage })));
const AttendancePage = lazy(() => import('./pages/AttendancePage').then(m => ({ default: m.AttendancePage })));
const LeaveWFHPage = lazy(() => import('./pages/LeaveWFHPage').then(m => ({ default: m.LeaveWFHPage })));
const PayrollPage = lazy(() => import('./pages/PayrollPage').then(m => ({ default: m.PayrollPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const TaskReportsPage = lazy(() => import('./pages/TaskReportsPage').then(m => ({ default: m.TaskReportsPage })));
const FinancePage = lazy(() => import('./pages/FinancePage').then(m => ({ default: m.FinancePage })));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then(m => ({ default: m.ProfilePage })));
const SelfServicePage = lazy(() => import('./pages/SelfServicePage').then(m => ({ default: m.SelfServicePage })));
const DocumentPage = lazy(() => import('./pages/DocumentPage').then(m => ({ default: m.DocumentPage })));
const ProjectsPage = lazy(() => import('./pages/ProjectsPage').then(m => ({ default: m.ProjectsPage })));
const NotificationCenter = lazy(() => import('./pages/NotificationCenter').then(m => ({ default: m.NotificationCenter })));
const ChatPage = lazy(() => import('./pages/ChatPage').then(m => ({ default: m.ChatPage })));
const ProjectDetailsPage = lazy(() => import('./pages/ProjectDetailsPage').then(m => ({ default: m.ProjectDetailsPage })));
const RecruitmentPage = lazy(() => import('./pages/RecruitmentPage').then(m => ({ default: m.RecruitmentPage })));
const MeetingsPage = lazy(() => import('./pages/MeetingsPage').then(m => ({ default: m.MeetingsPage })));
// Roles and Permissions Management
const RoleManagementPage = lazy(() => import('./pages/RoleManagementPage').then(m => ({ default: m.RoleManagementPage })));
const PermissionPage = lazy(() => import('./pages/PermissionPage').then(m => ({ default: m.PermissionPage })));

import { useEffect, useState } from 'react';
import { useTenantStore } from './store/useTenantStore';
import { useAuthStore } from './store/useAuthStore';
const LeavePolicyPage = lazy(() => import('./pages/LeavePolicyPage').then(m => ({ default: m.LeavePolicyPage })));
import { PermissionProvider } from './hooks/usePermission';
import { authApi } from './api_service/authApi';
import axios from 'axios';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

export const App: React.FC = () => {
  const fetchTenantConfig = useTenantStore((state) => state.fetchTenantConfig);
  const isLoading = useTenantStore((state) => state.isLoading);

  const { isAuthenticated, token, setToken, login, logout, role } = useAuthStore();
  const [isAuthLoading, setIsAuthLoading] = useState(isAuthenticated && !token);

  useEffect(() => {
    const bootstrapAuth = async () => {
      if (isAuthenticated && !token) {
        try {
          // Dynamically determine the backend API base URL based on where the browser is accessing from.
          const getBaseUrl = () => {
            const envApiUrl = import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL;
            if (envApiUrl && !envApiUrl.includes('localhost')) {
              return envApiUrl;
            }
            return `${window.location.protocol}//${window.location.hostname}:5000/api`;
          };
          const refreshUrl = `${getBaseUrl().replace(/\/$/, '')}/auth/refresh`;
          const response = await axios.post(refreshUrl, {}, { withCredentials: true });
          
          const payload = response.data;
          const newToken = payload?.data?.token || payload?.token;
          if (newToken) {
            setToken(newToken);
            // Fetch fresh user profile to ensure user and role in store are completely in sync with the new token
            try {
              const userResponse = await authApi.getMe();
              if (userResponse?.user) {
                login(userResponse.user, newToken);
              }
            } catch (err) {
              console.error('Failed to sync user profile after silent refresh:', err);
            }
          } else {
            logout();
          }
        } catch (err) {
          console.error('Session silent refresh bootstrap failed:', err);
          logout();
        } finally {
          setIsAuthLoading(false);
        }
      } else {
        setIsAuthLoading(false);
      }
    };

    bootstrapAuth();
  }, [isAuthenticated, token, setToken, login, logout]);

  useEffect(() => {
    const resolveTenant = async () => {
      const hostname = window.location.hostname;
      let tenantIdentifier: string;

      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        const urlParams = new URLSearchParams(window.location.search);
        tenantIdentifier = urlParams.get('tenant') || 'ethicsecur';
      } else {
        const parts = hostname.split('.');
        if (parts.length > 2 && !parts[parts.length - 1].match(/^\d+$/)) {
          tenantIdentifier = parts[0];
        } else {
          tenantIdentifier = hostname;
        }
      }

      const config = await fetchTenantConfig(tenantIdentifier);
      if (!config && tenantIdentifier !== hostname) {
        await fetchTenantConfig(hostname);
      }
    };

    resolveTenant();
  }, [fetchTenantConfig]);

  if (isLoading || isAuthLoading) {
    const statusText = isLoading 
      ? '' 
      : 'Authenticating Session...';
    return (
      <div className="flex items-center justify-center h-screen bg-slate-950 text-indigo-400 font-semibold">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xs tracking-wider uppercase text-slate-400">{statusText}</p>
        </div>
      </div>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <PermissionProvider>
        <BrowserRouter>
          <Suspense fallback={<div className="flex items-center justify-center h-screen bg-gray-50 text-indigo-600 font-semibold animate-pulse">Loading Platform...</div>}>
            <Routes>
              {/* Public Route */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/sso/callback" element={<SsoCallbackPage />} />

              {/* Protected Routes wrapped in Layout */}
              <Route element={<Layout />}>
                <Route element={<ProtectedRoute />}>
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/profile" element={<ProfilePage />} />
                  <Route path="/attendance" element={<AttendancePage />} />
                  <Route path="/leave-wfh" element={<LeaveWFHPage />} />
                  {(role === 'ADMIN' || role === 'HR') && (
                    <Route path="/payroll" element={<PayrollPage />} />
                  )}
                  <Route path="/task-reports" element={<TaskReportsPage />} />
                  <Route path="/self-service" element={<SelfServicePage />} />
                  <Route path="/documents" element={<DocumentPage />} />
                  <Route path="/projects" element={<ProjectsPage />} />
                  <Route path="/notifications" element={<NotificationCenter />} />
                  <Route path="/chat" element={<ChatPage />} />
                  <Route path="/projects/:id" element={<ProjectDetailsPage />} />
                  <Route path="/recruitment" element={<RecruitmentPage />} />
                  <Route path="/meetings" element={<MeetingsPage />} />

                  <Route path="/employees" element={<EmployeesPage />} />
                  <Route path="/employees/:id" element={<EmployeeDetailsPage />} />
                  <Route path="/reports" element={<ReportsPage />} />
                  <Route path="/finance" element={<FinancePage />} />
                  <Route path="/settings/roles" element={<RoleManagementPage />} />
                  <Route path="/settings/permissions" element={<PermissionPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="/audit-logs" element={<AuditLogsPage />} />
                  <Route path="/settings/leave-policy" element={<LeavePolicyPage />} />
                </Route>
              </Route>

              {/* Fallback Redirect */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </PermissionProvider>
    </QueryClientProvider>
  );
};

export default App;
