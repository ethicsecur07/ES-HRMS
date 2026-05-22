"use strict";
/**
 * holidayCalendar.controller.ts
 * --------------------------------
 * Full CRUD for the organization holiday calendar.
 * Admin/HR can manage; all authenticated users can view.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteHoliday = exports.updateHoliday = exports.createHoliday = exports.getHolidays = void 0;
const HolidayCalendar_js_1 = require("../models/HolidayCalendar.js");
const auditLog_service_js_1 = require("../services/auditLog.service.js");
const logger_js_1 = require("../utils/logger.js");
/**
 * GET /api/holiday-calendar
 * All authenticated users can fetch holidays for their org.
 */
const getHolidays = async (req, res) => {
    try {
        const authReq = req;
        const orgId = authReq.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }
        const { year } = req.query;
        const query = { organizationId: orgId };
        if (year) {
            query.date = {
                $gte: `${year}-01-01`,
                $lte: `${year}-12-31`,
            };
        }
        const holidays = await HolidayCalendar_js_1.HolidayCalendar.find(query).sort({ date: 1 });
        res.status(200).json({ holidays });
    }
    catch (error) {
        logger_js_1.logger.error('[holidayCalendar] getHolidays error', { error: error.message });
        res.status(500).json({ message: 'Failed to fetch holidays.' });
    }
};
exports.getHolidays = getHolidays;
/**
 * POST /api/holiday-calendar
 * Admin/HR only — create a new holiday.
 */
const createHoliday = async (req, res) => {
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
        const holiday = await HolidayCalendar_js_1.HolidayCalendar.create({
            organizationId: orgId,
            name: name.trim(),
            date,
            isRestricted: isRestricted ?? false,
        });
        await (0, auditLog_service_js_1.createAuditLog)('HOLIDAY_CREATED', req.user.email, 'HOLIDAY_CALENDAR', holiday.id, `Created holiday: ${name} on ${date}`, orgId);
        res.status(201).json({ holiday, message: 'Holiday created successfully.' });
    }
    catch (error) {
        if (error.code === 11000) {
            res.status(409).json({ message: 'A holiday already exists on this date for your organization.' });
            return;
        }
        logger_js_1.logger.error('[holidayCalendar] createHoliday error', { error: error.message });
        res.status(500).json({ message: 'Failed to create holiday.' });
    }
};
exports.createHoliday = createHoliday;
/**
 * PUT /api/holiday-calendar/:id
 * Admin/HR only — update an existing holiday.
 */
const updateHoliday = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }
        const holiday = await HolidayCalendar_js_1.HolidayCalendar.findOne({ _id: id, organizationId: orgId });
        if (!holiday) {
            res.status(404).json({ message: 'Holiday not found in your organization.' });
            return;
        }
        const { name, date, isRestricted } = req.body;
        if (name !== undefined)
            holiday.name = name.trim();
        if (date !== undefined) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
                res.status(400).json({ message: 'Date must be in YYYY-MM-DD format.' });
                return;
            }
            holiday.date = date;
        }
        if (isRestricted !== undefined)
            holiday.isRestricted = isRestricted;
        await holiday.save();
        await (0, auditLog_service_js_1.createAuditLog)('HOLIDAY_UPDATED', req.user.email, 'HOLIDAY_CALENDAR', holiday.id, `Updated holiday: ${holiday.name} on ${holiday.date}`, orgId);
        res.status(200).json({ holiday, message: 'Holiday updated successfully.' });
    }
    catch (error) {
        logger_js_1.logger.error('[holidayCalendar] updateHoliday error', { error: error.message });
        res.status(500).json({ message: 'Failed to update holiday.' });
    }
};
exports.updateHoliday = updateHoliday;
/**
 * DELETE /api/holiday-calendar/:id
 * Admin/HR only — remove a holiday.
 */
const deleteHoliday = async (req, res) => {
    try {
        const { id } = req.params;
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }
        const holiday = await HolidayCalendar_js_1.HolidayCalendar.findOneAndDelete({ _id: id, organizationId: orgId });
        if (!holiday) {
            res.status(404).json({ message: 'Holiday not found in your organization.' });
            return;
        }
        await (0, auditLog_service_js_1.createAuditLog)('HOLIDAY_DELETED', req.user.email, 'HOLIDAY_CALENDAR', id, `Deleted holiday: ${holiday.name} on ${holiday.date}`, orgId);
        res.status(200).json({ message: 'Holiday deleted successfully.' });
    }
    catch (error) {
        logger_js_1.logger.error('[holidayCalendar] deleteHoliday error', { error: error.message });
        res.status(500).json({ message: 'Failed to delete holiday.' });
    }
};
exports.deleteHoliday = deleteHoliday;
