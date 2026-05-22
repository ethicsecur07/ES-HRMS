import { axiosInstance } from './axiosInstance';

export interface GeoFence {
  _id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
  isActive: boolean;
}

export interface BiometricDevice {
  _id: string;
  deviceId: string;
  name: string;
  ipAddress?: string;
  isActive: boolean;
  lastPingAt?: string;
}

export interface ShiftRotation {
  _id: string;
  employeeId: string;
  shiftId: string;
  startDate: string;
  endDate: string;
  organizationId: string;
}

export interface ValidateLocationResponse {
  inRange: boolean;
  distance: number | null;
  fenceName: string | null;
}

export const advancedAttendanceApi = {
  // Config and Settings
  getSettings: async () => {
    const response = await axiosInstance.get<{
      devices: BiometricDevice[];
      fences: GeoFence[];
      rotations: ShiftRotation[];
    }>('/attendance/settings');
    return response.data;
  },

  // Geofence Actions
  createGeoFence: async (data: Omit<GeoFence, '_id'>) => {
    const response = await axiosInstance.post<GeoFence>('/attendance/geofence', data);
    return response.data;
  },

  updateGeoFence: async (id: string, data: Partial<GeoFence>) => {
    const response = await axiosInstance.put<GeoFence>(`/attendance/geofence/${id}`, data);
    return response.data;
  },

  deleteGeoFence: async (id: string) => {
    const response = await axiosInstance.delete<{ message: string }>(`/attendance/geofence/${id}`);
    return response.data;
  },

  // GPS Location Coordinate Range Check
  validateLocation: async (lat: number, lng: number) => {
    const response = await axiosInstance.post<ValidateLocationResponse>('/attendance/validate-location', { lat, lng });
    return response.data;
  },

  // Biometric device pings
  createBiometricDevice: async (data: { deviceId: string; name: string; ipAddress?: string; isActive?: boolean }) => {
    const response = await axiosInstance.post<BiometricDevice>('/attendance/device', data);
    return response.data;
  },

  simulateBiometricPing: async (data: { deviceId: string; cardNo: string; direction: 'IN' | 'OUT' }) => {
    const response = await axiosInstance.post<{ success: boolean; message: string; timestamp: string }>('/attendance/ping', data);
    return response.data;
  },

  // Shift Rotation
  createShiftRotation: async (data: { employeeId: string; shiftId: string; startDate: string; endDate: string }) => {
    const response = await axiosInstance.post<ShiftRotation>('/attendance/shift-rotation', data);
    return response.data;
  },
};
