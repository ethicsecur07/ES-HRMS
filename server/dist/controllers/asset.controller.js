"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteAsset = exports.updateAsset = exports.createAsset = exports.getEmployeeAssets = exports.getAssets = void 0;
const Asset_js_1 = require("../models/Asset.js");
const auditLog_service_js_1 = require("../services/auditLog.service.js");
const mongoose_1 = __importDefault(require("mongoose"));
const getAssets = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { status, type, employeeId } = req.query;
        const query = { organizationId: orgId };
        if (status)
            query.status = status;
        if (type)
            query.type = type;
        if (employeeId)
            query.assignedTo = employeeId;
        const assets = await Asset_js_1.Asset.find(query).populate('assignedTo', 'fullName email employeeCode');
        res.status(200).json({ success: true, data: assets });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getAssets = getAssets;
const getEmployeeAssets = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        const { employeeId } = req.params;
        if (!orgId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const assets = await Asset_js_1.Asset.find({ organizationId: orgId, assignedTo: employeeId });
        res.status(200).json({ success: true, data: assets });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.getEmployeeAssets = getEmployeeAssets;
const createAsset = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        if (!orgId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const { name, serialNumber, type, assignedTo, status, purchaseDate, cost, notes } = req.body;
        if (!name || !serialNumber) {
            res.status(400).json({ success: false, message: 'Name and serial number are required' });
            return;
        }
        // Check duplicate serial number within organization
        const existing = await Asset_js_1.Asset.findOne({ organizationId: orgId, serialNumber });
        if (existing) {
            res.status(400).json({ success: false, message: `Asset with serial number '${serialNumber}' already exists.` });
            return;
        }
        const asset = new Asset_js_1.Asset({
            organizationId: orgId,
            name,
            serialNumber,
            type,
            assignedTo: assignedTo || undefined,
            status: status || 'AVAILABLE',
            purchaseDate,
            cost,
            notes
        });
        await asset.save();
        await (0, auditLog_service_js_1.createAuditLog)('ASSET_CREATE', req.user?.email || 'System', 'ASSET', asset.id, `Created asset: ${name} (S/N: ${serialNumber})`, orgId);
        res.status(201).json({ success: true, data: asset });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.createAsset = createAsset;
const updateAsset = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        const { id } = req.params;
        if (!orgId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const asset = await Asset_js_1.Asset.findOne({ _id: id, organizationId: orgId });
        if (!asset) {
            res.status(404).json({ success: false, message: 'Asset not found' });
            return;
        }
        const { name, serialNumber, type, assignedTo, status, purchaseDate, cost, notes } = req.body;
        if (serialNumber && serialNumber !== asset.serialNumber) {
            const duplicate = await Asset_js_1.Asset.findOne({ organizationId: orgId, serialNumber, _id: { $ne: id } });
            if (duplicate) {
                res.status(400).json({ success: false, message: `Another asset with serial number '${serialNumber}' already exists.` });
                return;
            }
            asset.serialNumber = serialNumber;
        }
        if (name)
            asset.name = name;
        if (type)
            asset.type = type;
        if (purchaseDate !== undefined)
            asset.purchaseDate = purchaseDate;
        if (cost !== undefined)
            asset.cost = cost;
        if (notes !== undefined)
            asset.notes = notes;
        // Handle assignment change
        if (assignedTo !== undefined) {
            asset.assignedTo = assignedTo ? new mongoose_1.default.Types.ObjectId(assignedTo) : undefined;
            asset.status = assignedTo ? 'ASSIGNED' : 'AVAILABLE';
        }
        if (status && assignedTo === undefined) {
            asset.status = status;
        }
        await asset.save();
        await (0, auditLog_service_js_1.createAuditLog)('ASSET_UPDATE', req.user?.email || 'System', 'ASSET', asset.id, `Updated asset details: ${asset.name}`, orgId);
        res.status(200).json({ success: true, data: asset });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.updateAsset = updateAsset;
const deleteAsset = async (req, res) => {
    try {
        const orgId = req.user?.organizationId;
        const { id } = req.params;
        if (!orgId) {
            res.status(401).json({ success: false, message: 'Unauthorized' });
            return;
        }
        const result = await Asset_js_1.Asset.deleteOne({ _id: id, organizationId: orgId });
        if (result.deletedCount === 0) {
            res.status(404).json({ success: false, message: 'Asset not found' });
            return;
        }
        await (0, auditLog_service_js_1.createAuditLog)('ASSET_DELETE', req.user?.email || 'System', 'ASSET', id, `Deleted asset record ${id}`, orgId);
        res.status(200).json({ success: true, message: 'Asset deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
exports.deleteAsset = deleteAsset;
