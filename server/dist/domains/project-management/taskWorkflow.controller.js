"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rejectTask = exports.approveTask = exports.submitTaskForReview = void 0;
const Task_js_1 = require("../../models/Task.js");
const Project_js_1 = require("../../models/Project.js");
const User_js_1 = require("../../models/User.js");
const TaskActivity_js_1 = require("../../models/TaskActivity.js");
const notification_service_js_1 = require("../../services/notification.service.js");
const socketHandler_js_1 = require("../../sockets/socketHandler.js");
const submitTaskForReview = async (req, res, next) => {
    try {
        const { projectId, taskId } = req.params;
        const { completionNotes, progressSummary, checklistConfirmed } = req.body;
        const organizationId = req.user?.organizationId;
        if (!completionNotes || completionNotes.trim() === '') {
            res.status(400).json({ message: 'Completion notes are required' });
            return;
        }
        const project = await Project_js_1.Project.findOne({ _id: projectId, organizationId });
        if (!project) {
            res.status(404).json({ message: 'Project not found' });
            return;
        }
        const task = await Task_js_1.Task.findOne({ _id: taskId, projectId, organizationId }).populate('assignedTo', 'fullName email profileImage');
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }
        const user = await User_js_1.User.findById(req.user?.id);
        const authorName = user ? user.name : 'Unknown Employee';
        task.status = 'REVIEW';
        task.completionNotes = completionNotes;
        task.progressSummary = progressSummary || '';
        task.submittedAt = new Date().toISOString();
        await task.save();
        // Create TaskActivity Log
        await TaskActivity_js_1.TaskActivity.create({
            organizationId,
            projectId,
            taskId,
            actorId: req.user?.id,
            actorName: authorName,
            action: 'SUBMITTED_FOR_REVIEW',
            comment: completionNotes,
            metadata: { checklistConfirmed, progressSummary },
        });
        // Notify Team Lead or Allocated Manager
        const recipientId = project.teamLeadId ? project.teamLeadId.toString() : project.allocatedManagerId.toString();
        await notification_service_js_1.notificationService.dispatchNotification({
            organizationId,
            recipientId,
            title: 'Task Review Requested',
            message: `Employee ${authorName} submitted task "${task.title}" for review.`,
            channels: ['IN_APP', 'EMAIL'],
            type: 'REVIEW_REQUESTED',
            payload: { taskId: task._id, projectId },
        });
        // Realtime Socket update
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            io.to(`project_${projectId}`).emit('task_updated', task);
        }
        res.json({ task });
    }
    catch (err) {
        next(err);
    }
};
exports.submitTaskForReview = submitTaskForReview;
const approveTask = async (req, res, next) => {
    try {
        const { projectId, taskId } = req.params;
        const { reviewNotes } = req.body;
        const organizationId = req.user?.organizationId;
        const project = await Project_js_1.Project.findOne({ _id: projectId, organizationId });
        if (!project) {
            res.status(404).json({ message: 'Project not found' });
            return;
        }
        const task = await Task_js_1.Task.findOne({ _id: taskId, projectId, organizationId }).populate('assignedTo', 'fullName email profileImage');
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }
        const user = await User_js_1.User.findById(req.user?.id);
        const reviewerName = user ? user.name : 'Unknown Reviewer';
        task.status = 'COMPLETED';
        task.reviewNotes = reviewNotes || '';
        task.reviewedAt = new Date().toISOString();
        await task.save();
        // Create TaskActivity Log
        await TaskActivity_js_1.TaskActivity.create({
            organizationId,
            projectId,
            taskId,
            actorId: req.user?.id,
            actorName: reviewerName,
            action: 'REVIEW_APPROVED',
            comment: reviewNotes,
        });
        // Notify assigned employee
        if (task.assignedTo) {
            const employeeUser = await User_js_1.User.findOne({ employeeId: task.assignedTo._id });
            if (employeeUser) {
                await notification_service_js_1.notificationService.dispatchNotification({
                    organizationId,
                    recipientId: employeeUser._id.toString(),
                    title: 'Task Approved',
                    message: `Your task "${task.title}" has been approved by ${reviewerName}.`,
                    channels: ['IN_APP', 'EMAIL'],
                    type: 'REVIEW_APPROVED',
                    payload: { taskId: task._id, projectId },
                });
            }
        }
        // Realtime Socket update
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            io.to(`project_${projectId}`).emit('task_updated', task);
        }
        res.json({ task });
    }
    catch (err) {
        next(err);
    }
};
exports.approveTask = approveTask;
const rejectTask = async (req, res, next) => {
    try {
        const { projectId, taskId } = req.params;
        const { reworkComment } = req.body;
        const organizationId = req.user?.organizationId;
        if (!reworkComment || reworkComment.trim() === '') {
            res.status(400).json({ message: 'Rework comment is required' });
            return;
        }
        const project = await Project_js_1.Project.findOne({ _id: projectId, organizationId });
        if (!project) {
            res.status(404).json({ message: 'Project not found' });
            return;
        }
        const task = await Task_js_1.Task.findOne({ _id: taskId, projectId, organizationId }).populate('assignedTo', 'fullName email profileImage');
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }
        const user = await User_js_1.User.findById(req.user?.id);
        const reviewerName = user ? user.name : 'Unknown Reviewer';
        task.status = 'TODO';
        task.reworkCount = (task.reworkCount || 0) + 1;
        task.reworkComments = task.reworkComments || [];
        task.reworkComments.push({
            comment: reworkComment,
            by: req.user?.id || '',
            byName: reviewerName,
            at: new Date().toISOString(),
        });
        await task.save();
        // Create TaskActivity Log
        await TaskActivity_js_1.TaskActivity.create({
            organizationId,
            projectId,
            taskId,
            actorId: req.user?.id,
            actorName: reviewerName,
            action: 'REWORK_REQUESTED',
            comment: reworkComment,
        });
        // Notify assigned employee
        if (task.assignedTo) {
            const employeeUser = await User_js_1.User.findOne({ employeeId: task.assignedTo._id });
            if (employeeUser) {
                await notification_service_js_1.notificationService.dispatchNotification({
                    organizationId,
                    recipientId: employeeUser._id.toString(),
                    title: 'Rework Requested',
                    message: `Your task "${task.title}" requires rework: "${reworkComment}".`,
                    channels: ['IN_APP', 'EMAIL'],
                    type: 'REWORK_REQUESTED',
                    payload: { taskId: task._id, projectId },
                });
            }
        }
        // Realtime Socket update
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            io.to(`project_${projectId}`).emit('task_updated', task);
        }
        res.json({ task });
    }
    catch (err) {
        next(err);
    }
};
exports.rejectTask = rejectTask;
