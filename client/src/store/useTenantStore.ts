import { create } from 'zustand';
import axios from 'axios';

// Get backend API URL from env or fallback
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const BASE_URL = API_URL.replace(/\/api$/, '');

interface TenantSettings {
  theme?: 'dark' | 'light' | 'custom';
  logoUrl?: string;
  allowedIPs?: string[];
  primaryColor?: string;
  brandName?: string;
  [key: string]: any;
}

interface TenantConfig {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  sector: string;
  settings: TenantSettings;
  authProviders: string[];
}

interface TenantState {
  tenantConfig: TenantConfig | null;
  isLoading: boolean;
  error: string | null;
  lastFetchedSlug: string | null;
  fetchTenantConfig: (slugOrDomain: string) => Promise<TenantConfig | null>;
  clearTenantConfig: () => void;
}

export const useTenantStore = create<TenantState>((set, get) => ({
  tenantConfig: null,
  isLoading: false,
  error: null,
  lastFetchedSlug: null,

  fetchTenantConfig: async (slugOrDomain: string) => {
    if (!slugOrDomain || slugOrDomain === 'undefined') return null;

    if (get().lastFetchedSlug === slugOrDomain) {
      return get().tenantConfig;
    }

    set({ isLoading: true, error: null, lastFetchedSlug: slugOrDomain });
    try {
      const response = await axios.get(`${BASE_URL}/api/public/organization-config/${encodeURIComponent(slugOrDomain)}`);
      const resData = response.data;
      const config = resData.data || resData;
      if (resData && resData.notFound) {
        set({ error: resData.message || 'Organization not found.', isLoading: false, tenantConfig: null });
        return null;
      }
      set({ tenantConfig: config, isLoading: false });
      return config;
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Failed to load organization settings.';
      set({ error: errorMsg, isLoading: false, tenantConfig: null });
      return null;
    }
  },

  clearTenantConfig: () => set({ tenantConfig: null, error: null, lastFetchedSlug: null }),
}));
