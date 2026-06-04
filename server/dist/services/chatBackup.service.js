"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runGlobalChatBackup = exports.backupChatsForOrganization = exports.uploadToUserOneDrive = void 0;
const User_js_1 = require("../models/User.js");
const Employee_js_1 = require("../models/Employee.js");
const Message_js_1 = require("../models/Message.js");
const Project_js_1 = require("../models/Project.js");
const OrganizationAuthConfig_js_1 = require("../models/OrganizationAuthConfig.js");
const onedrive_js_1 = require("../utils/onedrive.js");
const logger_js_1 = require("../utils/logger.js");
/**
 * Uploads a formatted log file to a user's OneDrive.
 */
const uploadToUserOneDrive = async (organizationId, userEmail, yearMonth, fileName, fileBuffer) => {
    try {
        const accessToken = await (0, onedrive_js_1.getOneDriveAccessToken)(organizationId);
        // Construct the direct Graph API URL for uploading to the user's specific OneDrive
        const uploadUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(userEmail)}/drive/root:/ChatHistory/${yearMonth}/${fileName}:/content`;
        logger_js_1.logger.info(`[ChatBackupService] Uploading backup to OneDrive of user ${userEmail}: ${fileName}`);
        const response = await fetch(uploadUrl, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'text/plain; charset=utf-8',
            },
            body: fileBuffer,
        });
        if (!response.ok) {
            const errorBody = await response.text();
            logger_js_1.logger.error(`[ChatBackupService] Upload failed for user ${userEmail} (${fileName}): ${response.status} - ${errorBody}`);
            return false;
        }
        logger_js_1.logger.info(`[ChatBackupService] Upload success for user ${userEmail}: ${fileName}`);
        return true;
    }
    catch (err) {
        logger_js_1.logger.error(`[ChatBackupService] Error uploading to user ${userEmail} OneDrive:`, { error: err.message });
        return false;
    }
};
exports.uploadToUserOneDrive = uploadToUserOneDrive;
/**
 * Performs chat backup to OneDrive for all active users of a specific organization on a given date.
 */
const backupChatsForOrganization = async (organizationId, date) => {
    const dateStr = date.toISOString().split('T')[0];
    const yearMonth = dateStr.substring(0, 7); // e.g., '2026-06'
    logger_js_1.logger.info(`[ChatBackupService] Starting chat backup for organization ${organizationId} on date ${dateStr}`);
    let successCount = 0;
    let failedCount = 0;
    try {
        // 1. Fetch active users & projects for the organization
        const users = await User_js_1.User.find({ organizationId, isActive: true });
        const employees = await Employee_js_1.Employee.find({ organizationId, isActive: true });
        const projects = await Project_js_1.Project.find({ organizationId });
        if (users.length === 0) {
            logger_js_1.logger.info(`[ChatBackupService] No active users in organization ${organizationId}`);
            return { successCount: 0, failedCount: 0 };
        }
        // Maps to quickly resolve names and associate users with employees
        const userMap = new Map();
        users.forEach(u => userMap.set(u._id.toString(), u));
        const employeeMap = new Map();
        employees.forEach(e => employeeMap.set(e._id.toString(), e));
        const userEmployeeMap = new Map();
        users.forEach(u => {
            if (u.employeeId) {
                const emp = employeeMap.get(u.employeeId.toString());
                if (emp)
                    userEmployeeMap.set(u._id.toString(), emp);
            }
        });
        // Determine target date boundaries in local/system time
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);
        // 2. Loop through each user to check and backup their active conversations
        for (const user of users) {
            const userEmployee = userEmployeeMap.get(user._id.toString());
            const userDept = userEmployee?.department || '';
            // Determine project IDs this user belongs to
            const empIdStr = user.employeeId?.toString();
            const userProjectIds = projects
                .filter(p => p.allocatedManagerId?.toString() === user._id.toString() ||
                p.teamLeadId?.toString() === user._id.toString() ||
                (empIdStr && p.teamMemberIds.some(tmId => tmId.toString() === empIdStr)))
                .map(p => p._id.toString());
            // Query all messages this user sent, received 1:1, or is part of via broadcast/project/department groups
            const userMessages = await Message_js_1.Message.find({
                $or: [
                    { senderId: user._id.toString() },
                    { receiverId: user._id.toString() },
                    { receiverId: 'broadcast' },
                    { receiverId: { $in: userProjectIds.map(pId => `group_project_${pId}`) } },
                    ...(userDept ? [{ receiverId: `group_dept_${userDept}` }] : [])
                ],
                createdAt: { $gte: startOfDay, $lte: endOfDay }
            }).sort({ createdAt: 1 });
            if (userMessages.length === 0) {
                continue; // No activity for this user today, skip OneDrive backup
            }
            // Group messages by thread
            const threads = {};
            for (const msg of userMessages) {
                let threadKey = '';
                if (msg.receiverId === 'broadcast') {
                    threadKey = 'Broadcast_Channel';
                }
                else if (msg.receiverId.startsWith('group_project_')) {
                    const projId = msg.receiverId.replace('group_project_', '');
                    const proj = projects.find(p => p._id.toString() === projId);
                    const nameSafe = proj ? proj.name.replace(/[^a-zA-Z0-9_-]/g, '_') : projId;
                    threadKey = `Project_${nameSafe}`;
                }
                else if (msg.receiverId.startsWith('group_dept_')) {
                    const dept = msg.receiverId.replace('group_dept_', '');
                    const nameSafe = dept.replace(/[^a-zA-Z0-9_-]/g, '_');
                    threadKey = `Department_${nameSafe}`;
                }
                else {
                    // 1:1 Chat
                    const otherId = msg.senderId === user._id.toString() ? msg.receiverId : msg.senderId;
                    const otherUser = userMap.get(otherId);
                    const otherNameSafe = otherUser ? otherUser.name.replace(/[^a-zA-Z0-9_-]/g, '_') : otherId;
                    threadKey = `Chat_with_${otherNameSafe}`;
                }
                if (!threads[threadKey]) {
                    threads[threadKey] = [];
                }
                threads[threadKey].push(msg);
            }
            // Format and upload each thread log
            for (const [threadName, msgs] of Object.entries(threads)) {
                let logContent = `==================================================\n`;
                logContent += `Thread: ${threadName.replace(/_/g, ' ')}\n`;
                logContent += `User Archive: ${user.name} (${user.email})\n`;
                logContent += `Date: ${dateStr}\n`;
                logContent += `==================================================\n\n`;
                for (const msg of msgs) {
                    const timeStr = new Date(msg.createdAt).toISOString().split('T')[1].substring(0, 8);
                    const sender = userMap.get(msg.senderId);
                    const senderName = sender ? sender.name : 'Unknown';
                    logContent += `[${timeStr}] ${senderName}: ${msg.content || ''}`;
                    if (msg.messageType !== 'text') {
                        logContent += ` [Attachment: ${msg.fileName || 'file'} - Url: ${msg.fileUrl || ''}]`;
                    }
                    logContent += `\n`;
                }
                const fileName = `${dateStr}_${threadName}.txt`;
                const fileBuffer = Buffer.from(logContent, 'utf-8');
                // Upload to employee's OneDrive
                const success = await (0, exports.uploadToUserOneDrive)(organizationId, user.email, yearMonth, fileName, fileBuffer);
                if (success) {
                    successCount++;
                }
                else {
                    failedCount++;
                }
            }
        }
    }
    catch (err) {
        logger_js_1.logger.error(`[ChatBackupService] Backup failed for organization ${organizationId}:`, { error: err.message });
    }
    return { successCount, failedCount };
};
exports.backupChatsForOrganization = backupChatsForOrganization;
/**
 * Global backup runner to be called daily by the cron job or triggered manually by an admin.
 */
const runGlobalChatBackup = async (dateParam) => {
    const targetDate = dateParam || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to yesterday
    const dateStr = targetDate.toISOString().split('T')[0];
    logger_js_1.logger.info(`[ChatBackupService] Initializing global chat backup for date: ${dateStr}`);
    try {
        // Retrieve all active configurations that utilize the MICROSOFT provider
        const microsoftConfigs = await OrganizationAuthConfig_js_1.OrganizationAuthConfig.find({
            provider: 'MICROSOFT',
            isEnabled: true,
        });
        if (microsoftConfigs.length === 0) {
            logger_js_1.logger.info(`[ChatBackupService] No organizations configured with active Microsoft auth/OneDrive provider.`);
            return;
        }
        for (const config of microsoftConfigs) {
            const orgId = config.organizationId.toString();
            try {
                const result = await (0, exports.backupChatsForOrganization)(orgId, targetDate);
                logger_js_1.logger.info(`[ChatBackupService] Organization ${orgId} backup complete: Successes=${result.successCount}, Failures=${result.failedCount}`);
            }
            catch (orgErr) {
                logger_js_1.logger.error(`[ChatBackupService] Individual organization backup failed for org ${orgId}:`, { error: orgErr.message });
            }
        }
        logger_js_1.logger.info(`[ChatBackupService] Global chat backup finished.`);
    }
    catch (err) {
        logger_js_1.logger.error('[ChatBackupService] Global chat backup failed:', { error: err.message });
    }
};
exports.runGlobalChatBackup = runGlobalChatBackup;
