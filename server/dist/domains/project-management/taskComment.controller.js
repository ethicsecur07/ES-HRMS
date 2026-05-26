"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteComment = exports.updateComment = exports.createComment = exports.getTaskComments = void 0;
const TaskComment_js_1 = require("../../models/TaskComment.js");
const User_js_1 = require("../../models/User.js");
const TaskActivity_js_1 = require("../../models/TaskActivity.js");
const socketHandler_js_1 = require("../../sockets/socketHandler.js");
const getTaskComments = async (req, res, next) => {
    try {
        const { projectId, taskId } = req.params;
        const comments = await TaskComment_js_1.TaskComment.find({
            projectId,
            taskId,
            organizationId: req.user?.organizationId,
        }).sort({ createdAt: 1 }); // Chronological order
        res.json({ comments });
    }
    catch (err) {
        next(err);
    }
};
exports.getTaskComments = getTaskComments;
const createComment = async (req, res, next) => {
    try {
        const { projectId, taskId } = req.params;
        const { content, attachments } = req.body;
        const organizationId = req.user?.organizationId;
        if (!content || content.trim() === '') {
            res.status(400).json({ message: 'Comment content is required' });
            return;
        }
        const user = await User_js_1.User.findById(req.user?.id);
        const authorName = user ? user.name : 'Unknown User';
        const comment = await TaskComment_js_1.TaskComment.create({
            organizationId,
            projectId,
            taskId,
            authorId: req.user?.id,
            authorName,
            content,
            attachments,
        });
        // Create TaskActivity Log
        await TaskActivity_js_1.TaskActivity.create({
            organizationId,
            projectId,
            taskId,
            actorId: req.user?.id,
            actorName: authorName,
            action: 'COMMENTED',
            comment: content,
        });
        // Optional: Realtime Socket Broadcast
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            io.to(`project_${projectId}`).emit('task_comment_created', { taskId, comment });
        }
        res.status(201).json({ comment });
    }
    catch (err) {
        next(err);
    }
};
exports.createComment = createComment;
const updateComment = async (req, res, next) => {
    try {
        const { projectId, taskId, commentId } = req.params;
        const { content } = req.body;
        const comment = await TaskComment_js_1.TaskComment.findOneAndUpdate({
            _id: commentId,
            taskId,
            projectId,
            organizationId: req.user?.organizationId,
            authorId: req.user?.id, // Only author can edit
        }, { content }, { new: true });
        if (!comment) {
            res.status(404).json({ message: 'Comment not found or unauthorized' });
            return;
        }
        res.json({ comment });
    }
    catch (err) {
        next(err);
    }
};
exports.updateComment = updateComment;
const deleteComment = async (req, res, next) => {
    try {
        const { projectId, taskId, commentId } = req.params;
        const comment = await TaskComment_js_1.TaskComment.findOneAndDelete({
            _id: commentId,
            taskId,
            projectId,
            organizationId: req.user?.organizationId,
            authorId: req.user?.id, // Only author can delete
        });
        if (!comment) {
            res.status(404).json({ message: 'Comment not found or unauthorized' });
            return;
        }
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
};
exports.deleteComment = deleteComment;
