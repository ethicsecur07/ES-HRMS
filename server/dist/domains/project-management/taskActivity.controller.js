"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjectActivity = exports.getTaskActivity = void 0;
const TaskActivity_js_1 = require("../../models/TaskActivity.js");
const getTaskActivity = async (req, res, next) => {
    try {
        const { taskId, projectId } = req.params;
        const activities = await TaskActivity_js_1.TaskActivity.find({
            taskId,
            projectId,
            organizationId: req.user?.organizationId,
        }).sort({ createdAt: -1 });
        res.json({ activities });
    }
    catch (err) {
        next(err);
    }
};
exports.getTaskActivity = getTaskActivity;
const getProjectActivity = async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const activities = await TaskActivity_js_1.TaskActivity.find({
            projectId,
            organizationId: req.user?.organizationId,
        })
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);
        const total = await TaskActivity_js_1.TaskActivity.countDocuments({
            projectId,
            organizationId: req.user?.organizationId,
        });
        res.json({
            activities,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        });
    }
    catch (err) {
        next(err);
    }
};
exports.getProjectActivity = getProjectActivity;
