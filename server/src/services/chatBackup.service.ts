import { User } from '../models/User.js';
import { Employee } from '../models/Employee.js';
import { Message } from '../models/Message.js';
import { Project } from '../models/Project.js';
import { OrganizationAuthConfig } from '../models/OrganizationAuthConfig.js';
import { Organization } from '../models/Organization.js';
import { getOneDriveAccessToken } from '../utils/onedrive.js';
import { logger } from '../utils/logger.js';

/**
 * Uploads a formatted log file to a user's OneDrive.
 */
export const uploadToUserOneDrive = async (
  organizationId: string,
  userEmail: string,
  yearMonth: string,
  fileName: string,
  fileBuffer: Buffer
): Promise<boolean> => {
  try {
    const accessToken = await getOneDriveAccessToken(organizationId);
    
    // Construct the direct Graph API URL for uploading to the user's specific OneDrive
    const uploadUrl = `https://graph.microsoft.com/v1.0/users/${encodeURIComponent(
      userEmail
    )}/drive/root:/ChatHistory/${yearMonth}/${fileName}:/content`;

    logger.info(`[ChatBackupService] Uploading backup to OneDrive of user ${userEmail}: ${fileName}`);

    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'text/plain; charset=utf-8',
      },
      body: fileBuffer as any,
    });

    if (!response.ok) {
      const errorBody = await response.text();
      logger.error(`[ChatBackupService] Upload failed for user ${userEmail} (${fileName}): ${response.status} - ${errorBody}`);
      return false;
    }

    logger.info(`[ChatBackupService] Upload success for user ${userEmail}: ${fileName}`);
    return true;
  } catch (err: any) {
    logger.error(`[ChatBackupService] Error uploading to user ${userEmail} OneDrive:`, { error: err.message });
    return false;
  }
};

/**
 * Performs chat backup to OneDrive for all active users of a specific organization on a given date.
 */
export const backupChatsForOrganization = async (
  organizationId: string,
  date: Date
): Promise<{ successCount: number; failedCount: number }> => {
  const dateStr = date.toISOString().split('T')[0];
  const yearMonth = dateStr.substring(0, 7); // e.g., '2026-06'

  logger.info(`[ChatBackupService] Starting chat backup for organization ${organizationId} on date ${dateStr}`);

  let successCount = 0;
  let failedCount = 0;

  try {
    // 1. Fetch active users & projects for the organization
    const users = await User.find({ organizationId, isActive: true });
    const employees = await Employee.find({ organizationId, isActive: true });
    const projects = await Project.find({ organizationId });

    if (users.length === 0) {
      logger.info(`[ChatBackupService] No active users in organization ${organizationId}`);
      return { successCount: 0, failedCount: 0 };
    }

    // Maps to quickly resolve names and associate users with employees
    const userMap = new Map<string, typeof users[0]>();
    users.forEach(u => userMap.set(u._id.toString(), u));

    const employeeMap = new Map<string, typeof employees[0]>();
    employees.forEach(e => employeeMap.set(e._id.toString(), e));

    const userEmployeeMap = new Map<string, typeof employees[0]>();
    users.forEach(u => {
      if (u.employeeId) {
        const emp = employeeMap.get(u.employeeId.toString());
        if (emp) userEmployeeMap.set(u._id.toString(), emp);
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
        .filter(p => 
          p.allocatedManagerId?.toString() === user._id.toString() ||
          p.teamLeadId?.toString() === user._id.toString() ||
          (empIdStr && p.teamMemberIds.some(tmId => tmId.toString() === empIdStr))
        )
        .map(p => p._id.toString());

      // Query all messages this user sent, received 1:1, or is part of via broadcast/project/department groups
      const userMessages = await Message.find({
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
      const threads: Record<string, typeof userMessages> = {};
      
      for (const msg of userMessages) {
        let threadKey = '';
        if (msg.receiverId === 'broadcast') {
          threadKey = 'Broadcast_Channel';
        } else if (msg.receiverId.startsWith('group_project_')) {
          const projId = msg.receiverId.replace('group_project_', '');
          const proj = projects.find(p => p._id.toString() === projId);
          const nameSafe = proj ? proj.name.replace(/[^a-zA-Z0-9_-]/g, '_') : projId;
          threadKey = `Project_${nameSafe}`;
        } else if (msg.receiverId.startsWith('group_dept_')) {
          const dept = msg.receiverId.replace('group_dept_', '');
          const nameSafe = dept.replace(/[^a-zA-Z0-9_-]/g, '_');
          threadKey = `Department_${nameSafe}`;
        } else {
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
        const success = await uploadToUserOneDrive(
          organizationId,
          user.email,
          yearMonth,
          fileName,
          fileBuffer
        );

        if (success) {
          successCount++;
        } else {
          failedCount++;
        }
      }
    }
  } catch (err: any) {
    logger.error(`[ChatBackupService] Backup failed for organization ${organizationId}:`, { error: err.message });
  }

  return { successCount, failedCount };
};

/**
 * Global backup runner to be called daily by the cron job or triggered manually by an admin.
 */
export const runGlobalChatBackup = async (dateParam?: Date): Promise<void> => {
  const targetDate = dateParam || new Date(Date.now() - 24 * 60 * 60 * 1000); // Default to yesterday
  const dateStr = targetDate.toISOString().split('T')[0];

  logger.info(`[ChatBackupService] Initializing global chat backup for date: ${dateStr}`);

  try {
    // Retrieve all active configurations that utilize the MICROSOFT provider
    const microsoftConfigs = await OrganizationAuthConfig.find({
      provider: 'MICROSOFT',
      isEnabled: true,
    });

    if (microsoftConfigs.length === 0) {
      logger.info(`[ChatBackupService] No organizations configured with active Microsoft auth/OneDrive provider.`);
      return;
    }

    for (const config of microsoftConfigs) {
      const orgId = config.organizationId.toString();
      try {
        const result = await backupChatsForOrganization(orgId, targetDate);
        logger.info(`[ChatBackupService] Organization ${orgId} backup complete: Successes=${result.successCount}, Failures=${result.failedCount}`);
      } catch (orgErr: any) {
        logger.error(`[ChatBackupService] Individual organization backup failed for org ${orgId}:`, { error: orgErr.message });
      }
    }

    logger.info(`[ChatBackupService] Global chat backup finished.`);
  } catch (err: any) {
    logger.error('[ChatBackupService] Global chat backup failed:', { error: err.message });
  }
};
