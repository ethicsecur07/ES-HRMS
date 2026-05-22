import { Request, Response } from 'express';
import { AuthRequest } from '../types/index.js';
import { AttendanceService } from '../domains/attendance-engine/services/AttendanceService.js';

export const getTodayAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const { organizationId, id: userId, role, email } = authReq.user || {};
    if (!organizationId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    
    const attendances = await AttendanceService.getTodayAttendance(organizationId, userId, role, email);
    res.status(200).json({ data: attendances });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const getAllAttendance = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const { organizationId, id: userId, role, email } = authReq.user || {};
    if (!organizationId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }
    
    const attendances = await AttendanceService.getAllAttendance(organizationId, userId, role, email);
    res.status(200).json({ data: attendances });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const checkIn = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { employeeId, deviceInfo, overrideReason, lat, lng } = req.body;
    const { organizationId, email } = req.user || {};
    if (!organizationId || !email) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
    const ipAddress = Array.isArray(clientIP) ? clientIP[0] : clientIP;

    const attendance = await AttendanceService.checkIn(
      organizationId,
      employeeId,
      email,
      ipAddress,
      deviceInfo,
      overrideReason,
      lat,
      lng
    );
    res.status(201).json({ data: attendance });
  } catch (error: any) {
    res.status(error.message === 'Attendance already recorded for today' || error.message.includes('already') ? 400 : 500).json({ message: error.message });
  }
};

export const checkOut = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { taskReportId } = req.body;
    const { organizationId, email } = req.user || {};
    if (!organizationId || !email) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const attendance = await AttendanceService.checkOut(organizationId, id, email, taskReportId);
    res.status(200).json({ data: attendance });
  } catch (error: any) {
    res.status(error.message === 'Attendance record not found' || error.message.includes('not found') ? 404 : 500).json({ message: error.message });
  }
};

export const verifyIP = async (req: Request, res: Response): Promise<void> => {
  const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '0.0.0.0';
  const ipString = Array.isArray(clientIP) ? clientIP[0] : clientIP;
  const isOfficeIP = ipString.includes('192.168.29.') || ipString === '127.0.0.1' || ipString === '::1';

  res.status(200).json({ data: { isOfficeIP, currentIP: ipString } });
};

export const updateAttendance = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { loginTime, logoutTime, status } = req.body;
    const { organizationId, email } = req.user || {};
    if (!organizationId || !email) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const attendance = await AttendanceService.updateAttendance(organizationId, id, email, loginTime, logoutTime, status);
    res.status(200).json({ data: attendance });
  } catch (error: any) {
    res.status(error.message === 'Attendance record not found' || error.message.includes('not found') ? 404 : 500).json({ message: error.message });
  }
};
