"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrganizationActivityService = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const OrganizationActivity_js_1 = require("../models/OrganizationActivity.js");
const auditLog_service_js_1 = require("./auditLog.service.js");
const socketHandler_js_1 = require("../sockets/socketHandler.js");
const Notification_js_1 = require("../models/Notification.js");
const User_js_1 = require("../models/User.js");
class OrganizationActivityService {
    /**
     * Logs a global activity, creates an audit log, triggers real-time socket events for dashboard refresh,
     * and optionally alerts managing roles.
     */
    static async logActivity(orgId, userId, actorName, actionType, description, referenceId, referenceModel, notifyRoles, redirectUrl) {
        const organizationId = new mongoose_1.default.Types.ObjectId(orgId.toString());
        const actorUserId = new mongoose_1.default.Types.ObjectId(userId.toString());
        const refId = referenceId ? new mongoose_1.default.Types.ObjectId(referenceId.toString()) : undefined;
        // 1. Create activity record
        const activity = new OrganizationActivity_js_1.OrganizationActivity({
            organizationId,
            userId: actorUserId,
            actorName,
            actionType,
            description,
            referenceId: refId,
            referenceModel
        });
        await activity.save();
        // 2. Create standard Audit Log
        await (0, auditLog_service_js_1.createAuditLog)(actionType, actorName, referenceModel || 'SYSTEM', referenceId?.toString() || 'SYSTEM', description, organizationId);
        // 3. Emit real-time WebSocket updates to the organization room
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            // Emit activity_logged so clients can append to the activity feed
            io.to(`org_${orgId.toString()}`).emit('activity_logged', {
                activity,
                refreshRequired: true
            });
            // Emit a specific dashboard_refresh event to trigger refetching lists/stats
            io.to(`org_${orgId.toString()}`).emit('dashboard_refresh', {
                actionType,
                description
            });
        }
        // 4. Send targeted notifications to specified roles (e.g. HR, ADMIN)
        if (notifyRoles && notifyRoles.length > 0 && io) {
            for (const role of notifyRoles) {
                // Find users with this role in the organization
                const users = await User_js_1.User.find({ organizationId, role, isActive: true });
                for (const u of users) {
                    const notif = new Notification_js_1.Notification({
                        organizationId,
                        recipientId: u._id.toString(),
                        title: `New Event: ${actionType.replace(/_/g, ' ')}`,
                        message: description,
                        channel: 'IN_APP',
                        type: referenceModel || 'GENERAL',
                        status: 'SENT',
                        read: false,
                        payload: {
                            referenceId: refId?.toString(),
                            redirectUrl: redirectUrl || '/dashboard'
                        }
                    });
                    await notif.save();
                    // Emit live notification via socket directly to the recipient's room
                    io.to(`user_${u._id.toString()}`).emit('new_notification', {
                        _id: notif._id,
                        organizationId: orgId.toString(),
                        recipientId: u._id.toString(),
                        title: notif.title,
                        message: notif.message,
                        channel: notif.channel,
                        type: notif.type,
                        read: false,
                        createdAt: notif.createdAt.toISOString()
                    });
                }
            }
        }
        return activity;
    }
}
exports.OrganizationActivityService = OrganizationActivityService;
