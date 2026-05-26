"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEligibleEmployees = exports.isDeptEligible = void 0;
const Project_js_1 = require("../../models/Project.js");
const Employee_js_1 = require("../../models/Employee.js");
const isDeptEligible = (projectType, deptName) => {
    if (!projectType || ['general', 'other', 'all'].includes(projectType.toLowerCase().trim())) {
        return true;
    }
    const pType = projectType.toLowerCase().trim();
    const dName = deptName.toLowerCase().trim();
    if (pType === 'software development') {
        return (dName.includes('dev') ||
            dName.includes('software') ||
            dName.includes('development') ||
            dName.includes('engineering'));
    }
    if (pType === 'ui/ux') {
        return (dName.includes('design') ||
            dName.includes('ui') ||
            dName.includes('ux') ||
            dName.includes('creative'));
    }
    if (pType === 'qa') {
        return (dName.includes('qa') ||
            dName.includes('testing') ||
            dName.includes('quality assurance') ||
            dName.includes('quality'));
    }
    if (pType === 'devops') {
        return (dName.includes('devops') ||
            dName.includes('infrastructure') ||
            dName.includes('ops'));
    }
    if (pType === 'marketing') {
        return dName.includes('marketing') || dName.includes('digital marketing');
    }
    return true; // Default fallback
};
exports.isDeptEligible = isDeptEligible;
const getEligibleEmployees = async (req, res, next) => {
    try {
        const { projectId } = req.params;
        const project = await Project_js_1.Project.findOne({ _id: projectId, organizationId: req.user?.organizationId });
        if (!project) {
            res.status(404).json({ message: 'Project not found' });
            return;
        }
        const allEmployees = await Employee_js_1.Employee.find({
            organizationId: req.user?.organizationId,
            isActive: true,
            isDeleted: { $ne: true }, // Mongoose soft delete check
        });
        const eligible = allEmployees.filter((emp) => (0, exports.isDeptEligible)(project.projectType, emp.department));
        res.json({ employees: eligible });
    }
    catch (err) {
        next(err);
    }
};
exports.getEligibleEmployees = getEligibleEmployees;
