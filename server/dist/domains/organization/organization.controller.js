"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveReportingHierarchy = exports.deleteCostCenter = exports.updateCostCenter = exports.createCostCenter = exports.deleteBusinessUnit = exports.updateBusinessUnit = exports.createBusinessUnit = exports.deleteDivision = exports.updateDivision = exports.createDivision = exports.deleteBranch = exports.updateBranch = exports.createBranch = exports.getOrgStructureData = void 0;
const OrganizationStructure_js_1 = require("../../models/OrganizationStructure.js");
const Employee_js_1 = require("../../models/Employee.js");
const getOrgStructureData = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(400).json({ message: 'Organization ID is required' });
            return;
        }
        const branches = await OrganizationStructure_js_1.Branch.find({ organizationId: orgId });
        const divisions = await OrganizationStructure_js_1.Division.find({ organizationId: orgId }).populate('branchId', 'name code');
        const businessUnits = await OrganizationStructure_js_1.BusinessUnit.find({ organizationId: orgId }).populate('divisionId', 'name code');
        const costCenters = await OrganizationStructure_js_1.CostCenter.find({ organizationId: orgId });
        const reporting = await OrganizationStructure_js_1.ReportingHierarchy.find({ organizationId: orgId })
            .populate('employeeId', 'firstName lastName email designation employeeId')
            .populate('primaryManagerId', 'firstName lastName designation')
            .populate('matrixManagers', 'firstName lastName designation')
            .populate('hrBPId', 'firstName lastName designation');
        const result = {
            branches,
            divisions,
            businessUnits,
            costCenters,
            reporting,
        };
        // Use our new premium sanitization function if available, otherwise fallback to standard json
        if (res.jsonSanitized) {
            res.jsonSanitized(result);
        }
        else {
            res.json(result);
        }
    }
    catch (err) {
        next(err);
    }
};
exports.getOrgStructureData = getOrgStructureData;
// --- BRANCH CRUD ---
const createBranch = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const branch = new OrganizationStructure_js_1.Branch({ ...req.body, organizationId: orgId });
        await branch.save();
        res.status(201).json(branch);
    }
    catch (err) {
        next(err);
    }
};
exports.createBranch = createBranch;
const updateBranch = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const branch = await OrganizationStructure_js_1.Branch.findOneAndUpdate({ _id: req.params.id, organizationId: orgId }, req.body, { new: true });
        if (!branch) {
            res.status(404).json({ message: 'Branch not found' });
            return;
        }
        res.json(branch);
    }
    catch (err) {
        next(err);
    }
};
exports.updateBranch = updateBranch;
const deleteBranch = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const branch = await OrganizationStructure_js_1.Branch.findOne({ _id: req.params.id, organizationId: orgId });
        if (!branch) {
            res.status(404).json({ message: 'Branch not found' });
            return;
        }
        // Leverage the softDelete custom method from softDeletePlugin
        if (typeof branch.softDelete === 'function') {
            await branch.softDelete();
        }
        else {
            await branch.deleteOne();
        }
        res.json({ message: 'Branch soft-deleted successfully' });
    }
    catch (err) {
        next(err);
    }
};
exports.deleteBranch = deleteBranch;
// --- DIVISION CRUD ---
const createDivision = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const division = new OrganizationStructure_js_1.Division({ ...req.body, organizationId: orgId });
        await division.save();
        res.status(201).json(division);
    }
    catch (err) {
        next(err);
    }
};
exports.createDivision = createDivision;
const updateDivision = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const division = await OrganizationStructure_js_1.Division.findOneAndUpdate({ _id: req.params.id, organizationId: orgId }, req.body, { new: true });
        if (!division) {
            res.status(404).json({ message: 'Division not found' });
            return;
        }
        res.json(division);
    }
    catch (err) {
        next(err);
    }
};
exports.updateDivision = updateDivision;
const deleteDivision = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const division = await OrganizationStructure_js_1.Division.findOne({ _id: req.params.id, organizationId: orgId });
        if (!division) {
            res.status(404).json({ message: 'Division not found' });
            return;
        }
        if (typeof division.softDelete === 'function') {
            await division.softDelete();
        }
        else {
            await division.deleteOne();
        }
        res.json({ message: 'Division soft-deleted successfully' });
    }
    catch (err) {
        next(err);
    }
};
exports.deleteDivision = deleteDivision;
// --- BUSINESS UNIT CRUD ---
const createBusinessUnit = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const bu = new OrganizationStructure_js_1.BusinessUnit({ ...req.body, organizationId: orgId });
        await bu.save();
        res.status(201).json(bu);
    }
    catch (err) {
        next(err);
    }
};
exports.createBusinessUnit = createBusinessUnit;
const updateBusinessUnit = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const bu = await OrganizationStructure_js_1.BusinessUnit.findOneAndUpdate({ _id: req.params.id, organizationId: orgId }, req.body, { new: true });
        if (!bu) {
            res.status(404).json({ message: 'Business Unit not found' });
            return;
        }
        res.json(bu);
    }
    catch (err) {
        next(err);
    }
};
exports.updateBusinessUnit = updateBusinessUnit;
const deleteBusinessUnit = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const bu = await OrganizationStructure_js_1.BusinessUnit.findOne({ _id: req.params.id, organizationId: orgId });
        if (!bu) {
            res.status(404).json({ message: 'Business Unit not found' });
            return;
        }
        if (typeof bu.softDelete === 'function') {
            await bu.softDelete();
        }
        else {
            await bu.deleteOne();
        }
        res.json({ message: 'Business Unit soft-deleted successfully' });
    }
    catch (err) {
        next(err);
    }
};
exports.deleteBusinessUnit = deleteBusinessUnit;
// --- COST CENTER CRUD ---
const createCostCenter = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const cc = new OrganizationStructure_js_1.CostCenter({ ...req.body, organizationId: orgId });
        await cc.save();
        res.status(201).json(cc);
    }
    catch (err) {
        next(err);
    }
};
exports.createCostCenter = createCostCenter;
const updateCostCenter = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const cc = await OrganizationStructure_js_1.CostCenter.findOneAndUpdate({ _id: req.params.id, organizationId: orgId }, req.body, { new: true });
        if (!cc) {
            res.status(404).json({ message: 'Cost Center not found' });
            return;
        }
        res.json(cc);
    }
    catch (err) {
        next(err);
    }
};
exports.updateCostCenter = updateCostCenter;
const deleteCostCenter = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const cc = await OrganizationStructure_js_1.CostCenter.findOne({ _id: req.params.id, organizationId: orgId });
        if (!cc) {
            res.status(404).json({ message: 'Cost Center not found' });
            return;
        }
        if (typeof cc.softDelete === 'function') {
            await cc.softDelete();
        }
        else {
            await cc.deleteOne();
        }
        res.json({ message: 'Cost Center soft-deleted successfully' });
    }
    catch (err) {
        next(err);
    }
};
exports.deleteCostCenter = deleteCostCenter;
// Recursive cycle detection helper
const wouldCreateCycle = async (employeeId, proposedManagerId, orgId, visited = new Set()) => {
    if (employeeId === proposedManagerId)
        return true;
    if (visited.has(proposedManagerId))
        return true;
    visited.add(proposedManagerId);
    const managerHierarchy = await OrganizationStructure_js_1.ReportingHierarchy.findOne({
        employeeId: proposedManagerId,
        organizationId: orgId,
    });
    if (!managerHierarchy)
        return false;
    if (managerHierarchy.primaryManagerId) {
        const parentId = managerHierarchy.primaryManagerId.toString();
        if (parentId === employeeId || await wouldCreateCycle(employeeId, parentId, orgId, visited)) {
            return true;
        }
    }
    if (managerHierarchy.matrixManagers && managerHierarchy.matrixManagers.length > 0) {
        for (const matrixManagerId of managerHierarchy.matrixManagers) {
            const parentId = matrixManagerId.toString();
            if (parentId === employeeId || await wouldCreateCycle(employeeId, parentId, orgId, visited)) {
                return true;
            }
        }
    }
    return false;
};
// --- REPORTING HIERARCHY ---
const saveReportingHierarchy = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const { employeeId, primaryManagerId, matrixManagers, hrBPId } = req.body;
        if (!orgId) {
            res.status(400).json({ message: 'Organization ID is required' });
            return;
        }
        // 1. Verify target employee exists and belongs to this organization
        const targetEmployee = await Employee_js_1.Employee.findOne({ _id: employeeId, organizationId: orgId });
        if (!targetEmployee) {
            res.status(400).json({ message: 'Target employee not found in this organization.' });
            return;
        }
        // 2. Validate Primary Manager (existence, org match, cycle check)
        if (primaryManagerId) {
            if (primaryManagerId === employeeId) {
                res.status(400).json({ message: 'An employee cannot be their own primary manager.' });
                return;
            }
            const pManager = await Employee_js_1.Employee.findOne({ _id: primaryManagerId, organizationId: orgId });
            if (!pManager) {
                res.status(400).json({ message: 'Primary manager not found in this organization.' });
                return;
            }
            if (await wouldCreateCycle(employeeId, primaryManagerId, orgId)) {
                res.status(400).json({ message: 'Updating this manager would create a circular reporting cycle.' });
                return;
            }
        }
        // 3. Validate Matrix Managers
        if (matrixManagers && matrixManagers.length > 0) {
            for (const mId of matrixManagers) {
                if (mId === employeeId) {
                    res.status(400).json({ message: 'An employee cannot be their own matrix manager.' });
                    return;
                }
                const mManager = await Employee_js_1.Employee.findOne({ _id: mId, organizationId: orgId });
                if (!mManager) {
                    res.status(400).json({ message: `Matrix manager with ID ${mId} not found in this organization.` });
                    return;
                }
                if (await wouldCreateCycle(employeeId, mId, orgId)) {
                    res.status(400).json({ message: `Adding matrix manager ${mManager.fullName} would create a circular reporting cycle.` });
                    return;
                }
            }
        }
        // 4. Validate HR BP
        if (hrBPId) {
            const hrBP = await Employee_js_1.Employee.findOne({ _id: hrBPId, organizationId: orgId });
            if (!hrBP) {
                res.status(400).json({ message: 'HR Business Partner not found in this organization.' });
                return;
            }
        }
        let hierarchy = await OrganizationStructure_js_1.ReportingHierarchy.findOne({ employeeId, organizationId: orgId });
        if (hierarchy) {
            hierarchy.primaryManagerId = primaryManagerId || null;
            hierarchy.matrixManagers = matrixManagers || [];
            hierarchy.hrBPId = hrBPId || null;
            await hierarchy.save();
        }
        else {
            hierarchy = new OrganizationStructure_js_1.ReportingHierarchy({
                organizationId: orgId,
                employeeId,
                primaryManagerId: primaryManagerId || null,
                matrixManagers: matrixManagers || [],
                hrBPId: hrBPId || null,
            });
            await hierarchy.save();
        }
        const populated = await hierarchy.populate([
            { path: 'employeeId', select: 'firstName lastName designation' },
            { path: 'primaryManagerId', select: 'firstName lastName designation' },
            { path: 'matrixManagers', select: 'firstName lastName designation' },
            { path: 'hrBPId', select: 'firstName lastName designation' },
        ]);
        res.json(populated);
    }
    catch (err) {
        next(err);
    }
};
exports.saveReportingHierarchy = saveReportingHierarchy;
