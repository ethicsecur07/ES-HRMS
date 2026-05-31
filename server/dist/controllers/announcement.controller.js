"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAnnouncement = exports.createAnnouncement = exports.getAnnouncements = void 0;
const Announcement_js_1 = require("../models/Announcement.js");
const User_js_1 = require("../models/User.js");
const auditLog_service_js_1 = require("../services/auditLog.service.js");
const logger_js_1 = require("../utils/logger.js");
/**
 * GET /api/announcements
 * Retrieve all announcements & policy updates for the user's organization.
 */
const getAnnouncements = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ message: 'Unauthorized. No organization ID.' });
            return;
        }
        const announcements = await Announcement_js_1.Announcement.find({ organizationId: orgId })
            .sort({ createdAt: -1 })
            .limit(50); // Get latest 50 announcements
        res.status(200).json({ announcements });
    }
    catch (error) {
        logger_js_1.logger.error('[announcements] getAnnouncements error', { error: error.message });
        res.status(500).json({ message: 'Failed to fetch announcements.' });
    }
};
exports.getAnnouncements = getAnnouncements;
/**
 * POST /api/announcements
 * Create a manual announcement. Allowed for ADMIN, HR, and MANAGER.
 */
const createAnnouncement = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        const userId = req.user?.id;
        if (!orgId || !userId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }
        const { title, content, type } = req.body;
        if (!title || !content) {
            res.status(400).json({ message: 'Title and content are required.' });
            return;
        }
        // Fetch the creating user to cache their full name and role in the announcement
        const user = await User_js_1.User.findOne({ _id: userId, organizationId: orgId });
        if (!user) {
            res.status(404).json({ message: 'User not found.' });
            return;
        }
        const announcement = await Announcement_js_1.Announcement.create({
            organizationId: orgId,
            title,
            content,
            type: type || 'ANNOUNCEMENT',
            createdBy: userId,
            createdByName: user.name,
            createdByRole: user.role,
        });
        await (0, auditLog_service_js_1.createAuditLog)('ANNOUNCEMENT_CREATED', req.user.email, 'ANNOUNCEMENT', announcement.id, `Created announcement: ${title}`, orgId);
        res.status(201).json({ announcement, message: 'Announcement published successfully.' });
    }
    catch (error) {
        logger_js_1.logger.error('[announcements] createAnnouncement error', { error: error.message });
        res.status(500).json({ message: 'Failed to publish announcement.' });
    }
};
exports.createAnnouncement = createAnnouncement;
/**
 * DELETE /api/announcements/:id
 * Delete an announcement. Allowed for ADMIN, HR, and MANAGER.
 */
const deleteAnnouncement = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        const { id } = req.params;
        if (!orgId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }
        const announcement = await Announcement_js_1.Announcement.findOne({ _id: id, organizationId: orgId });
        if (!announcement) {
            res.status(404).json({ message: 'Announcement not found.' });
            return;
        }
        await Announcement_js_1.Announcement.deleteOne({ _id: id });
        await (0, auditLog_service_js_1.createAuditLog)('ANNOUNCEMENT_DELETED', req.user.email, 'ANNOUNCEMENT', id, `Deleted announcement: ${announcement.title}`, orgId);
        res.status(200).json({ message: 'Announcement deleted successfully.' });
    }
    catch (error) {
        logger_js_1.logger.error('[announcements] deleteAnnouncement error', { error: error.message });
        res.status(500).json({ message: 'Failed to delete announcement.' });
    }
};
exports.deleteAnnouncement = deleteAnnouncement;
