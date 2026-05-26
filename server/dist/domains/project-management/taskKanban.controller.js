"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTask = exports.updateTask = exports.updateTaskStatus = exports.getProjectTasks = exports.createTask = void 0;
const Task_js_1 = require("../../models/Task.js");
const User_js_1 = require("../../models/User.js");
const TaskActivity_js_1 = require("../../models/TaskActivity.js");
const notification_service_js_1 = require("../../services/notification.service.js");
const socketHandler_js_1 = require("../../sockets/socketHandler.js");
const auditLog_service_js_1 = require("../../services/auditLog.service.js");
const createTask = async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const organizationId = req.user?.organizationId;
        if (!req.body.sprintId || req.body.sprintId === '' || req.body.sprintId === 'backlog') {
            delete req.body.sprintId;
        }
        const task = await Task_js_1.Task.create({
            ...req.body,
            projectId,
            organizationId,
        });
        const populatedTask = await Task_js_1.Task.findById(task._id).populate('assignedTo', 'fullName email profileImage');
        const user = await User_js_1.User.findById(req.user?.id);
        const actorName = user ? user.name : 'Unknown';
        // Log Activity
        await TaskActivity_js_1.TaskActivity.create({
            organizationId,
            projectId,
            taskId: task._id,
            actorId: req.user?.id,
            actorName,
            action: 'CREATED',
        });
        // Notify assigned employee
        if (task.assignedTo) {
            const assignedUser = await User_js_1.User.findOne({ employeeId: task.assignedTo, organizationId });
            if (assignedUser) {
                await notification_service_js_1.notificationService.dispatchNotification({
                    organizationId,
                    recipientId: assignedUser._id.toString(),
                    title: 'New Task Assigned',
                    message: `You have been assigned the task: "${task.title}".`,
                    channels: ['IN_APP', 'EMAIL'],
                    type: 'TASK_ASSIGNED',
                    payload: { taskId: task._id, projectId },
                });
                // Log Assignment Activity
                await TaskActivity_js_1.TaskActivity.create({
                    organizationId,
                    projectId,
                    taskId: task._id,
                    actorId: req.user?.id,
                    actorName,
                    action: 'ASSIGNED',
                    to: assignedUser.name,
                });
            }
        }
        // Broadcast via socket
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            io.to(`project_${projectId}`).emit('task_created', populatedTask);
        }
        res.status(201).json({ task: populatedTask });
    }
    catch (err) {
        next(err);
    }
};
exports.createTask = createTask;
const getProjectTasks = async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const organizationId = req.user?.organizationId;
        const query = {
            projectId,
            organizationId,
        };
        if (req.query.sprintId) {
            if (req.query.sprintId === 'backlog') {
                query.sprintId = { $exists: false };
            }
            else {
                query.sprintId = req.query.sprintId;
            }
        }
        const tasks = await Task_js_1.Task.find(query)
            .populate('assignedTo', 'fullName email department designation profileImage')
            .sort({ createdAt: -1 });
        res.json({ tasks });
    }
    catch (err) {
        next(err);
    }
};
exports.getProjectTasks = getProjectTasks;
const updateTaskStatus = async (req, res, next) => {
    try {
        const { projectId, taskId } = req.params;
        const { status } = req.body;
        const organizationId = req.user?.organizationId;
        const userRole = req.user?.role || '';
        if (!['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'].includes(status)) {
            res.status(400).json({ message: 'Invalid status' });
            return;
        }
        const task = await Task_js_1.Task.findOne({ _id: taskId, projectId, organizationId });
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }
        const fromStatus = task.status;
        // Role-based status transition restrictions
        const dbUser = await User_js_1.User.findById(req.user?.id);
        const actorName = dbUser ? dbUser.name : 'Unknown';
        if (userRole === 'ADMIN') {
            res.status(403).json({ message: 'Admins cannot modify task status' });
            return;
        }
        if (userRole === 'EMPLOYEE') {
            // Check assignment
            const isAssigned = task.assignedTo && dbUser?.employeeId && task.assignedTo.toString() === dbUser.employeeId.toString();
            if (!isAssigned) {
                res.status(403).json({ message: 'Employees can only drag their assigned tasks' });
                return;
            }
            // Allowed transitions: TODO -> IN_PROGRESS, IN_PROGRESS -> REVIEW, REVIEW -> TODO (back to rework)
            const allowed = (fromStatus === 'TODO' && status === 'IN_PROGRESS') ||
                (fromStatus === 'IN_PROGRESS' && status === 'REVIEW') ||
                (fromStatus === 'REVIEW' && status === 'TODO'); // Returning to todo is fine if employee restarts or rejects
            // Employees cannot move to COMPLETED directly
            if (status === 'COMPLETED') {
                res.status(403).json({ message: 'Employees cannot approve tasks to COMPLETED. Team Lead review is required.' });
                return;
            }
            if (!allowed) {
                res.status(403).json({ message: `Employees are not allowed to transition tasks from ${fromStatus} to ${status}.` });
                return;
            }
        }
        task.status = status;
        await task.save();
        const populatedTask = await Task_js_1.Task.findById(task._id).populate('assignedTo', 'fullName email profileImage');
        // Create Activity Log
        await TaskActivity_js_1.TaskActivity.create({
            organizationId,
            projectId,
            taskId: task._id,
            actorId: req.user?.id,
            actorName,
            action: 'STATUS_CHANGED',
            from: fromStatus,
            to: status,
        });
        // Broadcast update via socket
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            io.to(`project_${projectId}`).emit('task_updated', populatedTask);
        }
        res.json({ task: populatedTask });
    }
    catch (err) {
        next(err);
    }
};
exports.updateTaskStatus = updateTaskStatus;
const updateTask = async (req, res, next) => {
    try {
        const { projectId, taskId } = req.params;
        const organizationId = req.user?.organizationId;
        const task = await Task_js_1.Task.findOne({ _id: taskId, projectId, organizationId });
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }
        const previousAssignee = task.assignedTo?.toString();
        const previousDueDate = task.dueDate;
        const previousPriority = task.priority;
        if (!req.body.sprintId || req.body.sprintId === '' || req.body.sprintId === 'backlog') {
            req.body.sprintId = null;
            req.body.sprintName = null;
        }
        const updatedTask = await Task_js_1.Task.findOneAndUpdate({ _id: taskId, projectId, organizationId }, req.body, { new: true }).populate('assignedTo', 'fullName email profileImage');
        if (!updatedTask) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }
        const dbUser = await User_js_1.User.findById(req.user?.id);
        const actorName = dbUser ? dbUser.name : 'Unknown';
        // Activity Log & Notification for Assignment change
        if (req.body.assignedTo && req.body.assignedTo !== previousAssignee) {
            const assignedUser = await User_js_1.User.findOne({ employeeId: req.body.assignedTo, organizationId });
            if (assignedUser) {
                await notification_service_js_1.notificationService.dispatchNotification({
                    organizationId,
                    recipientId: assignedUser._id.toString(),
                    title: 'Task Assigned',
                    message: `Task "${updatedTask.title}" has been assigned to you.`,
                    channels: ['IN_APP', 'EMAIL'],
                    type: 'TASK_ASSIGNED',
                    payload: { taskId: updatedTask._id, projectId },
                });
                await TaskActivity_js_1.TaskActivity.create({
                    organizationId,
                    projectId,
                    taskId: updatedTask._id,
                    actorId: req.user?.id,
                    actorName,
                    action: 'ASSIGNED',
                    to: assignedUser.name,
                });
            }
        }
        // Activity Log & Notification for Due Date change
        if (req.body.dueDate && req.body.dueDate !== previousDueDate) {
            await TaskActivity_js_1.TaskActivity.create({
                organizationId,
                projectId,
                taskId: updatedTask._id,
                actorId: req.user?.id,
                actorName,
                action: 'DEADLINE_UPDATED',
                from: previousDueDate,
                to: req.body.dueDate,
            });
            if (updatedTask.assignedTo) {
                const assignedUser = await User_js_1.User.findOne({ employeeId: updatedTask.assignedTo, organizationId });
                if (assignedUser) {
                    await notification_service_js_1.notificationService.dispatchNotification({
                        organizationId,
                        recipientId: assignedUser._id.toString(),
                        title: 'Task Deadline Updated',
                        message: `The deadline for task "${updatedTask.title}" is now ${req.body.dueDate}.`,
                        channels: ['IN_APP'],
                        type: 'DEADLINE_UPDATED',
                        payload: { taskId: updatedTask._id, projectId },
                    });
                }
            }
        }
        // Activity Log for Priority change
        if (req.body.priority && req.body.priority !== previousPriority) {
            await TaskActivity_js_1.TaskActivity.create({
                organizationId,
                projectId,
                taskId: updatedTask._id,
                actorId: req.user?.id,
                actorName,
                action: 'PRIORITY_CHANGED',
                from: previousPriority,
                to: req.body.priority,
            });
        }
        // Generic Update Log
        await TaskActivity_js_1.TaskActivity.create({
            organizationId,
            projectId,
            taskId: updatedTask._id,
            actorId: req.user?.id,
            actorName,
            action: 'UPDATED',
        });
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            io.to(`project_${projectId}`).emit('task_updated', updatedTask);
        }
        res.json({ task: updatedTask });
    }
    catch (err) {
        next(err);
    }
};
exports.updateTask = updateTask;
const deleteTask = async (req, res, next) => {
    try {
        const { projectId, taskId } = req.params;
        const organizationId = req.user?.organizationId;
        const task = await Task_js_1.Task.findOneAndDelete({
            _id: taskId,
            projectId,
            organizationId,
        });
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }
        // Audit Log
        await (0, auditLog_service_js_1.createAuditLog)('TASK_DELETED', req.user?.email || 'unknown', 'PROJECTS', task._id.toString(), `Task "${task.title}" deleted.`, organizationId);
        // Delete associated comments and activities
        await TaskActivity_js_1.TaskActivity.deleteMany({ taskId, projectId, organizationId });
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            io.to(`project_${projectId}`).emit('task_deleted', { taskId });
        }
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
};
exports.deleteTask = deleteTask;
