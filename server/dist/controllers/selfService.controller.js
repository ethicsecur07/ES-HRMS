"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveAttendanceCorrection = exports.createAttendanceCorrection = exports.getAttendanceCorrections = exports.approveTaxDeclaration = exports.createTaxDeclaration = exports.getTaxDeclarations = exports.approveReimbursement = exports.scanReceipt = exports.createReimbursement = exports.getReimbursements = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const SelfService_js_1 = require("../models/SelfService.js");
const Attendance_js_1 = require("../models/Attendance.js");
const OcrService_js_1 = require("../domains/reimbursement/OcrService.js");
const ReimbursementPolicy_js_1 = require("../models/payroll/ReimbursementPolicy.js");
const Role_js_1 = require("../models/Role.js");
// --- REIMBURSEMENT CLAIMS ---
const getReimbursements = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const { employeeId, role } = req.user || {};
        const query = { organizationId: orgId };
        if (role === 'EMPLOYEE') {
            query.employeeId = employeeId;
        }
        else if (req.query.employeeId) {
            query.employeeId = req.query.employeeId;
        }
        if (req.query.status) {
            query.status = req.query.status;
        }
        const claims = await SelfService_js_1.ReimbursementClaim.find(query)
            .populate('employeeId', 'fullName employeeCode email department')
            .populate('approvedBy', 'name email')
            .sort({ createdAt: -1 });
        res.json(claims);
    }
    catch (err) {
        next(err);
    }
};
exports.getReimbursements = getReimbursements;
const createReimbursement = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const { employeeId, role } = req.user || {};
        const { expenseDate, amount, category, description, receiptUrl } = req.body;
        const targetEmployeeId = role === 'EMPLOYEE' ? employeeId : req.body.employeeId;
        if (!targetEmployeeId) {
            res.status(400).json({ message: 'Employee ID is required.' });
            return;
        }
        // 1. Fetch active policy for this category
        const policy = await ReimbursementPolicy_js_1.ReimbursementPolicy.findOne({
            organizationId: orgId,
            category: { $regex: new RegExp(`^${category}$`, 'i') },
            isActive: true
        });
        if (policy) {
            // 2. Validate max claim amount
            if (amount > policy.maxClaimAmount) {
                res.status(400).json({ message: `Claim amount exceeds the policy limit of ${policy.maxClaimAmount} for ${category}.` });
                return;
            }
            // 3. Validate receipt requirement
            if (amount >= policy.requireReceiptAbove && !receiptUrl) {
                res.status(400).json({ message: `Receipt is required for claims above ${policy.requireReceiptAbove} in ${category}.` });
                return;
            }
            // 4. Validate eligible roles
            if (policy.eligibleRoles && policy.eligibleRoles.length > 0) {
                const userRoleDoc = await Role_js_1.Role.findOne({
                    organizationId: orgId,
                    code: req.user?.role
                });
                const isEligible = userRoleDoc && policy.eligibleRoles.some(roleId => roleId.toString() === userRoleDoc._id.toString());
                if (!isEligible) {
                    res.status(403).json({ message: `Your role is not eligible to claim reimbursement under ${category} policy.` });
                    return;
                }
            }
        }
        const claim = new SelfService_js_1.ReimbursementClaim({
            organizationId: orgId,
            employeeId: targetEmployeeId,
            expenseDate,
            amount,
            category,
            description,
            receiptUrl,
            status: 'PENDING',
        });
        await claim.save();
        res.status(201).json(claim);
    }
    catch (err) {
        next(err);
    }
};
exports.createReimbursement = createReimbursement;
const scanReceipt = async (req, res, next) => {
    try {
        const { receiptUrl } = req.body;
        if (!receiptUrl) {
            res.status(400).json({ message: 'Receipt URL is required.' });
            return;
        }
        const ocrData = await OcrService_js_1.OcrService.extractReceiptData(receiptUrl);
        res.json(ocrData);
    }
    catch (err) {
        next(err);
    }
};
exports.scanReceipt = scanReceipt;
const approveReimbursement = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const { id } = req.params;
        const { status, rejectionReason } = req.body;
        if (!['APPROVED', 'REJECTED'].includes(status)) {
            res.status(400).json({ message: 'Invalid status. Must be APPROVED or REJECTED.' });
            return;
        }
        const claim = await SelfService_js_1.ReimbursementClaim.findOne({ _id: id, organizationId: orgId });
        if (!claim) {
            res.status(404).json({ message: 'Reimbursement claim not found.' });
            return;
        }
        claim.status = status;
        claim.approvedBy = req.user?.id;
        if (status === 'REJECTED' && rejectionReason) {
            claim.rejectionReason = rejectionReason;
        }
        await claim.save();
        res.json(claim);
    }
    catch (err) {
        next(err);
    }
};
exports.approveReimbursement = approveReimbursement;
// --- TAX DECLARATIONS ---
const getTaxDeclarations = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const { employeeId, role } = req.user || {};
        const query = { organizationId: orgId };
        if (role === 'EMPLOYEE') {
            query.employeeId = employeeId;
        }
        else if (req.query.employeeId) {
            query.employeeId = req.query.employeeId;
        }
        if (req.query.financialYear) {
            query.financialYear = req.query.financialYear;
        }
        const declarations = await SelfService_js_1.TaxDeclaration.find(query)
            .populate('employeeId', 'fullName employeeCode email department')
            .populate('approvedBy', 'name email')
            .sort({ createdAt: -1 });
        res.json(declarations);
    }
    catch (err) {
        next(err);
    }
};
exports.getTaxDeclarations = getTaxDeclarations;
const createTaxDeclaration = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const { employeeId, role } = req.user || {};
        const { financialYear, declarationSection, declaredAmount, proofUrl } = req.body;
        const targetEmployeeId = role === 'EMPLOYEE' ? employeeId : req.body.employeeId;
        if (!targetEmployeeId) {
            res.status(400).json({ message: 'Employee ID is required.' });
            return;
        }
        const declaration = new SelfService_js_1.TaxDeclaration({
            organizationId: orgId,
            employeeId: targetEmployeeId,
            financialYear,
            declarationSection,
            declaredAmount,
            proofUrl,
            status: 'PENDING',
        });
        await declaration.save();
        res.status(201).json(declaration);
    }
    catch (err) {
        next(err);
    }
};
exports.createTaxDeclaration = createTaxDeclaration;
const approveTaxDeclaration = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const { id } = req.params;
        const { status, rejectionReason } = req.body;
        if (!['APPROVED', 'REJECTED'].includes(status)) {
            res.status(400).json({ message: 'Invalid status. Must be APPROVED or REJECTED.' });
            return;
        }
        const declaration = await SelfService_js_1.TaxDeclaration.findOne({ _id: id, organizationId: orgId });
        if (!declaration) {
            res.status(404).json({ message: 'Tax declaration not found.' });
            return;
        }
        declaration.status = status;
        declaration.approvedBy = req.user?.id;
        if (status === 'REJECTED' && rejectionReason) {
            declaration.rejectionReason = rejectionReason;
        }
        await declaration.save();
        res.json(declaration);
    }
    catch (err) {
        next(err);
    }
};
exports.approveTaxDeclaration = approveTaxDeclaration;
// --- ATTENDANCE CORRECTIONS ---
const getAttendanceCorrections = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const { employeeId, role } = req.user || {};
        const query = { organizationId: orgId };
        if (role === 'EMPLOYEE') {
            query.employeeId = employeeId;
        }
        else if (req.query.employeeId) {
            query.employeeId = req.query.employeeId;
        }
        if (req.query.status) {
            query.status = req.query.status;
        }
        const corrections = await SelfService_js_1.AttendanceCorrectionRequest.find(query)
            .populate('employeeId', 'fullName employeeCode email department')
            .populate('approvedBy', 'name email')
            .sort({ createdAt: -1 });
        res.json(corrections);
    }
    catch (err) {
        next(err);
    }
};
exports.getAttendanceCorrections = getAttendanceCorrections;
const createAttendanceCorrection = async (req, res, next) => {
    try {
        const orgId = req.user?.organizationId;
        const { employeeId, role } = req.user || {};
        const { attendanceDate, requestedLoginTime, requestedLogoutTime, reason } = req.body;
        const targetEmployeeId = role === 'EMPLOYEE' ? employeeId : req.body.employeeId;
        if (!targetEmployeeId) {
            res.status(400).json({ message: 'Employee ID is required.' });
            return;
        }
        const request = new SelfService_js_1.AttendanceCorrectionRequest({
            organizationId: orgId,
            employeeId: targetEmployeeId,
            attendanceDate,
            requestedLoginTime,
            requestedLogoutTime,
            reason,
            status: 'PENDING',
        });
        await request.save();
        res.status(201).json(request);
    }
    catch (err) {
        next(err);
    }
};
exports.createAttendanceCorrection = createAttendanceCorrection;
const approveAttendanceCorrection = async (req, res, next) => {
    const session = await mongoose_1.default.startSession();
    session.startTransaction();
    try {
        const orgId = req.user?.organizationId;
        const { id } = req.params;
        const { status, rejectionReason } = req.body;
        if (!['APPROVED', 'REJECTED'].includes(status)) {
            res.status(400).json({ message: 'Invalid status. Must be APPROVED or REJECTED.' });
            await session.abortTransaction();
            session.endSession();
            return;
        }
        const request = await SelfService_js_1.AttendanceCorrectionRequest.findOne({ _id: id, organizationId: orgId }).session(session);
        if (!request) {
            res.status(404).json({ message: 'Attendance correction request not found.' });
            await session.abortTransaction();
            session.endSession();
            return;
        }
        request.status = status;
        request.approvedBy = req.user?.id;
        if (status === 'REJECTED' && rejectionReason) {
            request.rejectionReason = rejectionReason;
        }
        // Apply corrected times to Attendance model transactionally on approval
        if (status === 'APPROVED') {
            const login = new Date(request.requestedLoginTime);
            const logout = new Date(request.requestedLogoutTime);
            const workingHours = parseFloat(((logout.getTime() - login.getTime()) / (1000 * 60 * 60)).toFixed(2));
            await Attendance_js_1.Attendance.findOneAndUpdate({ employeeId: request.employeeId, date: request.attendanceDate, organizationId: orgId }, {
                $setOnInsert: {
                    organizationId: orgId,
                    employeeId: request.employeeId,
                    date: request.attendanceDate,
                    ipAddress: 'CORRECTION',
                    deviceInfo: 'SYSTEM_CORRECTED',
                },
                $set: {
                    loginTime: login,
                    logoutTime: logout,
                    workingHours,
                    status: 'OFFICE',
                    isLate: false,
                    locationVerified: true,
                    overrideReason: `Time correction: ${request.reason}`,
                }
            }, { upsert: true, new: true, session });
        }
        await request.save({ session });
        await session.commitTransaction();
        res.json(request);
    }
    catch (err) {
        await session.abortTransaction();
        next(err);
    }
    finally {
        session.endSession();
    }
};
exports.approveAttendanceCorrection = approveAttendanceCorrection;
