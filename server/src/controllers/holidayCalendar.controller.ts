/**
 * holidayCalendar.controller.ts
 * --------------------------------
 * Full CRUD for the organization holiday calendar.
 * Admin/HR can manage; all authenticated users can view.
 */

import { Request, Response } from 'express';
import { HolidayCalendar } from '../models/HolidayCalendar.js';
import { AuthRequest } from '../types/index.js';
import { createAuditLog } from '../services/auditLog.service.js';
import { logger } from '../utils/logger.js';

/**
 * GET /api/holiday-calendar
 * All authenticated users can fetch holidays for their org.
 */
export const getHolidays = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    const orgId = authReq.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    const { year } = req.query;
    const query: any = { organizationId: orgId };

    if (year) {
      query.date = {
        $gte: `${year}-01-01`,
        $lte: `${year}-12-31`,
      };
    }

    const customHolidays = await HolidayCalendar.find(query).sort({ date: 1 });
    
    // Fetch Indian public holidays from Google Calendar API
    const targetYear = year ? String(year) : new Date().getFullYear().toString();
    const timeMin = `${targetYear}-01-01T00:00:00Z`;
    const timeMax = `${targetYear}-12-31T23:59:59Z`;
    const googleCalendarUrl = `https://www.googleapis.com/calendar/v3/calendars/en.indian%23holiday@group.v.calendar.google.com/events?key=AIzaSyCY87FQ_qeyvH822Rocc6PI2CDDqG3jFxM&timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`;
    
    let googleHolidays: any[] = [];
    
    try {
      const response = await fetch(googleCalendarUrl);
      if (response.ok) {
        const data = await response.json();
        if (data.items && Array.isArray(data.items)) {
          googleHolidays = data.items
            .filter((item: any) => item.start && (item.start.date || item.start.dateTime))
            .map((item: any) => {
              const dateStr = item.start.date || item.start.dateTime.split('T')[0];
              const isObservance = item.description && item.description.toLowerCase().includes('observance');
              return {
                _id: `google-${item.id}`,
                organizationId: orgId,
                name: item.summary,
                date: dateStr,
                isRestricted: !!isObservance,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              };
            });
            
          if (year) {
            googleHolidays = googleHolidays.filter(h => h.date.startsWith(`${year}-`));
          }
        }
      } else {
        logger.warn('[holidayCalendar] Failed to fetch Google Calendar holidays', { status: response.status });
      }
    } catch (gcalError: any) {
      logger.warn('[holidayCalendar] Google Calendar API error', { error: gcalError.message });
    }

    // Merge and sort
    const allHolidays = [...customHolidays.map(h => h.toObject()), ...googleHolidays];
    allHolidays.sort((a, b) => a.date.localeCompare(b.date));

    // Deduplicate by date (prefer custom holidays over google ones)
    const uniqueHolidays = [];
    const seenDates = new Set();
    for (const h of allHolidays) {
      if (!seenDates.has(h.date)) {
        seenDates.add(h.date);
        uniqueHolidays.push(h);
      }
    }

    res.status(200).json({ holidays: uniqueHolidays });
  } catch (error: any) {
    logger.error('[holidayCalendar] getHolidays error', { error: error.message });
    res.status(500).json({ message: 'Failed to fetch holidays.' });
  }
};

/**
 * POST /api/holiday-calendar
 * Admin/HR only — create a new holiday.
 */
export const createHoliday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    const { name, date, isRestricted } = req.body;

    if (!name || !date) {
      res.status(400).json({ message: 'Name and date are required.' });
      return;
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ message: 'Date must be in YYYY-MM-DD format.' });
      return;
    }

    const holiday = await HolidayCalendar.create({
      organizationId: orgId,
      name: name.trim(),
      date,
      isRestricted: isRestricted ?? false,
    });

    await createAuditLog(
      'HOLIDAY_CREATED',
      req.user!.email,
      'HOLIDAY_CALENDAR',
      holiday.id,
      `Created holiday: ${name} on ${date}`,
      orgId
    );

    res.status(201).json({ holiday, message: 'Holiday created successfully.' });
  } catch (error: any) {
    if (error.code === 11000) {
      res.status(409).json({ message: 'A holiday already exists on this date for your organization.' });
      return;
    }
    logger.error('[holidayCalendar] createHoliday error', { error: error.message });
    res.status(500).json({ message: 'Failed to create holiday.' });
  }
};

/**
 * PUT /api/holiday-calendar/:id
 * Admin/HR only — update an existing holiday.
 */
export const updateHoliday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    const holiday = await HolidayCalendar.findOne({ _id: id, organizationId: orgId });
    if (!holiday) {
      res.status(404).json({ message: 'Holiday not found in your organization.' });
      return;
    }

    const { name, date, isRestricted } = req.body;
    if (name !== undefined) holiday.name = name.trim();
    if (date !== undefined) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        res.status(400).json({ message: 'Date must be in YYYY-MM-DD format.' });
        return;
      }
      holiday.date = date;
    }
    if (isRestricted !== undefined) holiday.isRestricted = isRestricted;

    await holiday.save();

    await createAuditLog(
      'HOLIDAY_UPDATED',
      req.user!.email,
      'HOLIDAY_CALENDAR',
      holiday.id,
      `Updated holiday: ${holiday.name} on ${holiday.date}`,
      orgId
    );

    res.status(200).json({ holiday, message: 'Holiday updated successfully.' });
  } catch (error: any) {
    logger.error('[holidayCalendar] updateHoliday error', { error: error.message });
    res.status(500).json({ message: 'Failed to update holiday.' });
  }
};

/**
 * DELETE /api/holiday-calendar/:id
 * Admin/HR only — remove a holiday.
 */
export const deleteHoliday = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ message: 'Unauthorized.' });
      return;
    }

    const holiday = await HolidayCalendar.findOneAndDelete({ _id: id, organizationId: orgId });
    if (!holiday) {
      res.status(404).json({ message: 'Holiday not found in your organization.' });
      return;
    }

    await createAuditLog(
      'HOLIDAY_DELETED',
      req.user!.email,
      'HOLIDAY_CALENDAR',
      id,
      `Deleted holiday: ${holiday.name} on ${holiday.date}`,
      orgId
    );

    res.status(200).json({ message: 'Holiday deleted successfully.' });
  } catch (error: any) {
    logger.error('[holidayCalendar] deleteHoliday error', { error: error.message });
    res.status(500).json({ message: 'Failed to delete holiday.' });
  }
};
