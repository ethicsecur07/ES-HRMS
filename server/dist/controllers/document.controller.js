"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadDocument = exports.addDocumentVersion = exports.uploadDocument = exports.getDocuments = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const HRDocument_js_1 = require("../models/HRDocument.js");
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
        const documents = await HRDocument_js_1.HRDocument.find(query)
            .populate('employeeId', 'fullName employeeCode email department')
            .populate('versions.uploadedBy', 'name email')
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
        const { employeeId: targetEmpId, name, category, fileUrl, expiresAt, signatureStatus } = req.body;
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
        const document = new HRDocument_js_1.HRDocument({
            organizationId: orgId,
            employeeId: finalTargetEmpId,
            name,
            category,
            fileUrl,
            version: 1,
            expiresAt,
            signatureStatus: signatureStatus || 'NOT_REQUIRED',
            versions: [{
                    version: 1,
                    fileUrl,
                    uploadedAt: new Date(),
                    uploadedBy: userId,
                }],
            isActive: true,
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
    try {
        const orgId = req.user?.organizationId;
        const { employeeId, role, id: userId } = req.user || {};
        const { id } = req.params;
        const { fileUrl } = req.body;
        if (!mongoose_1.default.Types.ObjectId.isValid(id)) {
            res.status(400).json({ message: 'Invalid document ID format.' });
            return;
        }
        if (!fileUrl) {
            res.status(400).json({ message: 'File URL is required.' });
            return;
        }
        const document = await HRDocument_js_1.HRDocument.findOne({ _id: id, organizationId: orgId });
        if (!document) {
            res.status(404).json({ message: 'Document not found.' });
            return;
        }
        // If standard employee, check that they own this document
        if (role === 'EMPLOYEE' && document.employeeId.toString() !== employeeId) {
            res.status(403).json({ message: 'Forbidden. You do not own this document.' });
            return;
        }
        const nextVersion = document.version + 1;
        document.version = nextVersion;
        document.fileUrl = fileUrl;
        document.versions.push({
            version: nextVersion,
            fileUrl,
            uploadedAt: new Date(),
            uploadedBy: userId,
        });
        await document.save();
        res.json(document);
    }
    catch (err) {
        next(err);
    }
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
        const document = await HRDocument_js_1.HRDocument.findOne({ _id: id, organizationId: orgId });
        if (!document) {
            res.status(404).json({ message: 'Document not found.' });
            return;
        }
        // If standard employee, check that they own this document
        if (role === 'EMPLOYEE' && document.employeeId.toString() !== employeeId) {
            res.status(403).json({ message: 'Forbidden. You do not have access to this document.' });
            return;
        }
        // Return direct download url or secure access payload
        res.json({
            name: document.name,
            fileUrl: document.fileUrl,
            category: document.category,
            version: document.version,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.downloadDocument = downloadDocument;
