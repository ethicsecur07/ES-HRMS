"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteDocument = exports.downloadDocument = exports.addDocumentVersion = exports.uploadDocument = exports.getDocuments = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const EmployeeDocument_js_1 = require("../models/EmployeeDocument.js");
const Employee_js_1 = require("../models/Employee.js");
const getDocuments = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const { employeeId, role } = req.user || {};
        const query = { organizationId: orgId };
        if (role === 'EMPLOYEE') {
            if (employeeId && mongoose_1.default.Types.ObjectId.isValid(employeeId)) {
                query.employeeId = employeeId;
            }
            else {
                res.status(400).json({ message: 'Invalid or missing employee context in session.' });
                return;
            }
        }
        else if (req.query.employeeId && mongoose_1.default.Types.ObjectId.isValid(req.query.employeeId)) {
            query.employeeId = req.query.employeeId;
        }
        if (req.query.category) {
            query.category = req.query.category;
        }
        const documents = await EmployeeDocument_js_1.EmployeeDocument.find(query)
            .populate('employeeId', 'fullName employeeCode email department')
            .populate('uploadedBy', 'name email')
            .sort({ createdAt: -1 });
        res.json(documents);
    }
    catch (err) {
        next(err);
    }
};
exports.getDocuments = getDocuments;
const uploadDocument = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const { employeeId: userEmpId, role, id: userId } = req.user || {};
        const { employeeId: targetEmpId, name, category, fileUrl } = req.body;
        const finalTargetEmpId = role === 'EMPLOYEE' ? userEmpId : targetEmpId;
        if (!finalTargetEmpId) {
            res.status(400).json({ message: 'Employee ID is required.' });
            return;
        }
        if (!mongoose_1.default.Types.ObjectId.isValid(finalTargetEmpId)) {
            res.status(400).json({ message: 'Invalid employee ID format.' });
            return;
        }
        // Enforce that target employee belongs to the same organization
        const targetEmployee = await Employee_js_1.Employee.findOne({ _id: finalTargetEmpId, organizationId: orgId });
        if (!targetEmployee) {
            res.status(400).json({ message: 'Target employee not found in this organization.' });
            return;
        }
        const document = new EmployeeDocument_js_1.EmployeeDocument({
            organizationId: orgId,
            employeeId: finalTargetEmpId,
            name,
            category,
            fileUrl,
            uploadedBy: userId,
        });
        await document.save();
        res.status(201).json(document);
    }
    catch (err) {
        next(err);
    }
};
exports.uploadDocument = uploadDocument;
const addDocumentVersion = async (req, res, next) => {
    // Bypassed for EmployeeDocument flat structure, keeping signature compatibility
    res.status(200).json({ message: 'Versioning is not supported for flat employee documents.' });
};
exports.addDocumentVersion = addDocumentVersion;
const downloadDocument = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const { employeeId, role } = req.user || {};
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid document ID format.' });
            return;
        }
        const document = await EmployeeDocument_js_1.EmployeeDocument.findOne({ _id: id, organizationId: orgId });
        if (!document) {
            res.status(404).json({ message: 'Document not found.' });
            return;
        }
        // If standard employee, check that they own this document
        if (role === 'EMPLOYEE' && document.employeeId.toString() !== employeeId) {
            res.status(403).json({ message: 'Forbidden. You do not have access to this document.' });
            return;
        }
        res.json({
            name: document.name,
            fileUrl: document.fileUrl,
            category: document.category,
            version: 1,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.downloadDocument = downloadDocument;
const deleteDocument = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const { id } = req.params;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid document ID format.' });
            return;
        }
        const result = await EmployeeDocument_js_1.EmployeeDocument.deleteOne({ _id: id, organizationId: orgId });
        if (result.deletedCount === 0) {
            res.status(404).json({ message: 'Document not found.' });
            return;
        }
        res.json({ success: true, message: 'Document deleted successfully.' });
    }
    catch (err) {
        next(err);
    }
};
exports.deleteDocument = deleteDocument;
