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

    // Calculate warning if the check-in is late (1st or 2nd time)
    let warning: string | undefined = undefined;
    if (attendance.isLate) {
      const now = new Date();
      const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      const mongoose = (await import('mongoose')).default;
      const empId = new mongoose.Types.ObjectId(employeeId);
      const orgId = new mongoose.Types.ObjectId(organizationId);
      const Attendance = (await import('../models/Attendance.js')).Attendance;

      const lateCountThisMonth = await Attendance.countDocuments({
        organizationId: orgId,
        employeeId: empId,
        isLate: true,
        date: { $gte: monthStart, $lte: monthEnd }
      });

      warning = `Late check-in recorded! (This is late day #${lateCountThisMonth} this month. On the 3rd late check-in, you will be blocked and required to request leave.)`;
    }

    res.status(201).json({
      data: {
        ...(attendance.toObject ? attendance.toObject() : attendance),
        warning
      }
    });
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

export const getPendingReports = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { organizationId, email, role, id: userId } = req.user || {};
    if (!organizationId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const User = (await import('../models/User.js')).User;
    const Employee = (await import('../models/Employee.js')).Employee;
    const Attendance = (await import('../models/Attendance.js')).Attendance;

    const user = await User.findOne({ _id: userId, organizationId });
    let employeeId = user?.employeeId;
    if (user && !employeeId) {
      const employee = await Employee.findOne({ email, organizationId });
      if (employee) employeeId = employee._id;
    }

    if (!employeeId) {
      res.status(200).json({ data: [] });
      return;
    }

    const pending = await Attendance.find({
      organizationId,
      employeeId,
      pendingReportUpdate: true
    }).sort({ date: -1 });

    res.status(200).json({ data: pending });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

export const submitPendingReport = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { organizationId, email, role, id: userId } = req.user || {};
    if (!organizationId) {
      res.status(401).json({ message: 'Unauthorized' });
      return;
    }

    const { attendanceId, completedTasks, inProgressTasks, pendingTasks, blockers, tomorrowPlan } = req.body;
    if (!attendanceId || !completedTasks) {
      res.status(400).json({ message: 'Attendance ID and completed tasks are required.' });
      return;
    }

    const User = (await import('../models/User.js')).User;
    const Employee = (await import('../models/Employee.js')).Employee;
    const Attendance = (await import('../models/Attendance.js')).Attendance;
    const TaskReport = (await import('../models/TaskReport.js')).TaskReport;
    const createAuditLog = (await import('../services/auditLog.service.js')).createAuditLog;

    const user = await User.findOne({ _id: userId, organizationId });
    let employeeId = user?.employeeId;
    if (user && !employeeId) {
      const employee = await Employee.findOne({ email, organizationId });
      if (employee) employeeId = employee._id;
    }

    if (!employeeId) {
      res.status(400).json({ message: 'Employee profile not found.' });
      return;
    }

    const att = await Attendance.findOne({
      _id: attendanceId,
      employeeId,
      organizationId,
      pendingReportUpdate: true
    });

    if (!att) {
      res.status(404).json({ message: 'Pending attendance record not found.' });
      return;
    }

    // Create the retroactive TaskReport
    const taskReport = await TaskReport.create({
      organizationId,
      employeeId,
      date: att.date,
      completedTasks,
      inProgressTasks: inProgressTasks || '',
      pendingTasks: pendingTasks || '',
      blockers: blockers || 'None',
      tomorrowPlan: tomorrowPlan || '',
      submittedAt: new Date()
    });

    // Update Attendance record
    att.pendingReportUpdate = false;
    att.taskSubmitted = true;
    await att.save();

    await createAuditLog(
      'TASK_REPORT_SUBMIT_RETROACTIVE',
      email || 'Employee',
      'TASK',
      taskReport.id,
      `Submitted retroactive task report for forgot checkout date ${att.date}`,
      organizationId
    );

    res.status(200).json({ message: 'Retroactive report submitted successfully.', data: taskReport });
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};
