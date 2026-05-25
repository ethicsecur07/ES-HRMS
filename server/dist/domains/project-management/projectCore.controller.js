"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateSprint = exports.getProjectSprints = exports.createSprint = exports.deleteProject = exports.updateProject = exports.getProjectDetails = exports.getProjects = exports.createProject = void 0;
const Project_js_1 = require("../../models/Project.js");
const Sprint_js_1 = require("../../models/project-management/Sprint.js");
const createProject = async (req, res, next) => {
    try {
        const project = await Project_js_1.Project.create({
            ...req.body,
            organizationId: req.user?.organizationId,
        });
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
            .populate('teamMemberIds', 'fullName email');
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
        const project = await Project_js_1.Project.findOneAndUpdate({ _id: req.params.projectId, organizationId: req.user?.organizationId }, req.body, { new: true });
        res.json({ project });
    }
    catch (err) {
        next(err);
    }
};
exports.updateProject = updateProject;
const deleteProject = async (req, res, next) => {
    try {
        await Project_js_1.Project.findOneAndDelete({ _id: req.params.projectId, organizationId: req.user?.organizationId });
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
