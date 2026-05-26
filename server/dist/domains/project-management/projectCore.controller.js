"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSprint = exports.getProjectSprints = exports.createSprint = exports.deleteProject = exports.updateProject = exports.getProjectDetails = exports.getProjects = exports.createProject = void 0;
const Project_js_1 = require("../../models/Project.js");
const Sprint_js_1 = require("../../models/project-management/Sprint.js");
const Employee_js_1 = require("../../models/Employee.js");
const employeeEligibility_controller_js_1 = require("./employeeEligibility.controller.js");
const auditLog_service_js_1 = require("../../services/auditLog.service.js");
const notification_service_js_1 = require("../../services/notification.service.js");
const Task_js_1 = require("../../models/Task.js");
const createProject = async (req, res, next) => {
    try {
        const organizationId = req.user?.organizationId;
        const { name, teamMemberIds, projectType } = req.body;
        // Department-Role Mapping Validation
        if (teamMemberIds && teamMemberIds.length > 0 && projectType) {
            const employees = await Employee_js_1.Employee.find({ _id: { $in: teamMemberIds }, organizationId });
            for (const emp of employees) {
                if (!(0, employeeEligibility_controller_js_1.isDeptEligible)(projectType, emp.department)) {
                    res.status(400).json({
                        message: `Employee ${emp.fullName} from department "${emp.department}" is not eligible for a "${projectType}" project.`,
                    });
                    return;
                }
            }
        }
        const project = await Project_js_1.Project.create({
            ...req.body,
            organizationId,
        });
        // Audit Log
        await (0, auditLog_service_js_1.createAuditLog)('PROJECT_CREATED', req.user?.email || 'unknown', 'PROJECTS', project._id.toString(), `Project "${name}" created.`, organizationId);
        // Notify Allocated Manager
        if (project.allocatedManagerId) {
            await notification_service_js_1.notificationService.dispatchNotification({
                organizationId,
                recipientId: project.allocatedManagerId.toString(),
                title: 'Project Assigned',
                message: `You have been allocated as Manager for project "${project.name}".`,
                channels: ['IN_APP', 'EMAIL'],
                type: 'PROJECT_CREATED',
                payload: { projectId: project._id },
            });
        }
        res.status(201).json({ project });
    }
    catch (err) {
        next(err);
    }
};
exports.createProject = createProject;
const getProjects = async (req, res, next) => {
    try {
        const projects = await Project_js_1.Project.find({ organizationId: req.user?.organizationId })
            .populate('allocatedManagerId', 'name email')
            .sort({ createdAt: -1 });
        res.json({ projects });
    }
    catch (err) {
        next(err);
    }
};
exports.getProjects = getProjects;
const getProjectDetails = async (req, res, next) => {
    try {
        const project = await Project_js_1.Project.findOne({ _id: req.params.projectId, organizationId: req.user?.organizationId })
            .populate('allocatedManagerId', 'name email')
            .populate('teamMemberIds', 'fullName email department designation');
        if (!project) {
            res.status(404).json({ message: 'Project not found' });
            return;
        }
        res.json({ project });
    }
    catch (err) {
        next(err);
    }
};
exports.getProjectDetails = getProjectDetails;
const updateProject = async (req, res, next) => {
    try {
        const organizationId = req.user?.organizationId;
        const { teamMemberIds, projectType, name } = req.body;
        // Department-Role Mapping Validation
        if (teamMemberIds && teamMemberIds.length > 0) {
            // Find current or new project type
            const currentProj = await Project_js_1.Project.findOne({ _id: req.params.projectId, organizationId });
            const pType = projectType || currentProj?.projectType;
            if (pType) {
                const employees = await Employee_js_1.Employee.find({ _id: { $in: teamMemberIds }, organizationId });
                for (const emp of employees) {
                    if (!(0, employeeEligibility_controller_js_1.isDeptEligible)(pType, emp.department)) {
                        res.status(400).json({
                            message: `Employee ${emp.fullName} from department "${emp.department}" is not eligible for a "${pType}" project.`,
                        });
                        return;
                    }
                }
            }
        }
        const project = await Project_js_1.Project.findOneAndUpdate({ _id: req.params.projectId, organizationId }, req.body, { new: true });
        if (!project) {
            res.status(404).json({ message: 'Project not found' });
            return;
        }
        // Audit Log
        await (0, auditLog_service_js_1.createAuditLog)('PROJECT_UPDATED', req.user?.email || 'unknown', 'PROJECTS', project._id.toString(), `Project "${project.name}" updated.`, organizationId);
        res.json({ project });
    }
    catch (err) {
        next(err);
    }
};
exports.updateProject = updateProject;
const deleteProject = async (req, res, next) => {
    try {
        const organizationId = req.user?.organizationId;
        const project = await Project_js_1.Project.findOneAndDelete({ _id: req.params.projectId, organizationId });
        if (!project) {
            res.status(404).json({ message: 'Project not found' });
            return;
        }
        // Audit Log
        await (0, auditLog_service_js_1.createAuditLog)('PROJECT_DELETED', req.user?.email || 'unknown', 'PROJECTS', project._id.toString(), `Project "${project.name}" deleted.`, organizationId);
        // Cascade delete sprints and tasks
        await Sprint_js_1.Sprint.deleteMany({ projectId: req.params.projectId, organizationId });
        await Task_js_1.Task.deleteMany({ projectId: req.params.projectId, organizationId });
        res.status(204).send();
    }
    catch (err) {
        next(err);
    }
};
exports.deleteProject = deleteProject;
// Sprints
const createSprint = async (req, res, next) => {
    try {
        const sprint = await Sprint_js_1.Sprint.create({
            ...req.body,
            projectId: req.params.projectId,
            organizationId: req.user?.organizationId,
        });
        res.status(201).json({ sprint });
    }
    catch (err) {
        next(err);
    }
};
exports.createSprint = createSprint;
const getProjectSprints = async (req, res, next) => {
    try {
        const sprints = await Sprint_js_1.Sprint.find({
            projectId: req.params.projectId,
            organizationId: req.user?.organizationId,
        }).sort({ startDate: 1 });
        res.json({ sprints });
    }
    catch (err) {
        next(err);
    }
};
exports.getProjectSprints = getProjectSprints;
const updateSprint = async (req, res, next) => {
    try {
        const sprint = await Sprint_js_1.Sprint.findOneAndUpdate({ _id: req.params.sprintId, projectId: req.params.projectId, organizationId: req.user?.organizationId }, req.body, { new: true });
        res.json({ sprint });
    }
    catch (err) {
        next(err);
    }
};
exports.updateSprint = updateSprint;
