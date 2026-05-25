"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteTask = exports.updateTask = exports.updateTaskStatus = exports.getProjectTasks = exports.createTask = void 0;
const Task_js_1 = require("../../models/Task.js");
const socketHandler_js_1 = require("../../sockets/socketHandler.js");
const createTask = async (req, res, next) => {
    try {
        if (!req.body.sprintId || req.body.sprintId === '' || req.body.sprintId === 'backlog') {
            delete req.body.sprintId;
        }
        const task = await Task_js_1.Task.create({
            ...req.body,
            projectId: req.params.projectId,
            organizationId: req.user?.organizationId,
        });
        // Broadcast via socket
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            io.to(`project_${req.params.projectId}`).emit('task_created', task);
        }
        res.status(201).json({ task });
    }
    catch (err) {
        next(err);
    }
};
exports.createTask = createTask;
const getProjectTasks = async (req, res, next) => {
    try {
        const query = {
            projectId: req.params.projectId,
            organizationId: req.user?.organizationId
        };
        if (req.query.sprintId) {
            query.sprintId = req.query.sprintId;
        }
        const tasks = await Task_js_1.Task.find(query)
            .populate('assignedTo', 'fullName email profileImage')
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
        const { status } = req.body;
        if (!['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED'].includes(status)) {
            res.status(400).json({ message: 'Invalid status' });
            return;
        }
        const task = await Task_js_1.Task.findOneAndUpdate({ _id: req.params.taskId, projectId: req.params.projectId, organizationId: req.user?.organizationId }, { status }, { new: true }).populate('assignedTo', 'fullName email profileImage');
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }
        // Broadcast update via socket
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            io.to(`project_${req.params.projectId}`).emit('task_updated', task);
        }
        res.json({ task });
    }
    catch (err) {
        next(err);
    }
};
exports.updateTaskStatus = updateTaskStatus;
const updateTask = async (req, res, next) => {
    try {
        if (!req.body.sprintId || req.body.sprintId === '' || req.body.sprintId === 'backlog') {
            req.body.sprintId = null;
        }
        const task = await Task_js_1.Task.findOneAndUpdate({ _id: req.params.taskId, projectId: req.params.projectId, organizationId: req.user?.organizationId }, req.body, { new: true }).populate('assignedTo', 'fullName email profileImage');
        if (!task) {
            res.status(404).json({ message: 'Task not found' });
            return;
        }
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            io.to(`project_${req.params.projectId}`).emit('task_updated', task);
        }
        res.json({ task });
    }
    catch (err) {
        next(err);
    }
};
exports.updateTask = updateTask;
const deleteTask = async (req, res, next) => {
    try {
        await Task_js_1.Task.findOneAndDelete({
            _id: req.params.taskId,
            projectId: req.params.projectId,
            organizationId: req.user?.organizationId
        });
        const io = (0, socketHandler_js_1.getIO)();
        if (io) {
            io.to(`project_${req.params.projectId}`).emit('task_deleted', { taskId: req.params.taskId });
        }
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
};
exports.deleteTask = deleteTask;
