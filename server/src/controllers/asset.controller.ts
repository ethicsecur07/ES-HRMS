import { Response } from 'express';
import { Asset } from '../models/Asset.js';
import { createAuditLog } from '../services/auditLog.service.js';
import { AuthRequest } from '../types/index.js';
import mongoose from 'mongoose';

export const getAssets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const { status, type, employeeId } = req.query;
    const query: any = { organizationId: orgId };
    
    if (status) query.status = status;
    if (type) query.type = type;
    if (employeeId) query.assignedTo = employeeId;

    const assets = await Asset.find(query).populate('assignedTo', 'fullName email employeeCode');
    res.status(200).json({ success: true, data: assets });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const getEmployeeAssets = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { employeeId } = req.params;
    if (!orgId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const assets = await Asset.find({ organizationId: orgId, assignedTo: employeeId });
    res.status(200).json({ success: true, data: assets });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const createAsset = async (req: AuthRequest, res: Response): Promise<void> => {
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
    const existing = await Asset.findOne({ organizationId: orgId, serialNumber });
    if (existing) {
      res.status(400).json({ success: false, message: `Asset with serial number '${serialNumber}' already exists.` });
      return;
    }

    const asset = new Asset({
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

    await createAuditLog(
      'ASSET_CREATE',
      req.user?.email || 'System',
      'ASSET',
      asset.id,
      `Created asset: ${name} (S/N: ${serialNumber})`,
      orgId
    );

    res.status(201).json({ success: true, data: asset });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateAsset = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;
    if (!orgId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const asset = await Asset.findOne({ _id: id, organizationId: orgId });
    if (!asset) {
      res.status(404).json({ success: false, message: 'Asset not found' });
      return;
    }

    const { name, serialNumber, type, assignedTo, status, purchaseDate, cost, notes } = req.body;

    if (serialNumber && serialNumber !== asset.serialNumber) {
      const duplicate = await Asset.findOne({ organizationId: orgId, serialNumber, _id: { $ne: id } });
      if (duplicate) {
        res.status(400).json({ success: false, message: `Another asset with serial number '${serialNumber}' already exists.` });
        return;
      }
      asset.serialNumber = serialNumber;
    }

    if (name) asset.name = name;
    if (type) asset.type = type;
    if (purchaseDate !== undefined) asset.purchaseDate = purchaseDate;
    if (cost !== undefined) asset.cost = cost;
    if (notes !== undefined) asset.notes = notes;

    // Handle assignment change
    if (assignedTo !== undefined) {
      asset.assignedTo = assignedTo ? new mongoose.Types.ObjectId(assignedTo) : undefined;
      asset.status = assignedTo ? 'ASSIGNED' : 'AVAILABLE';
    }
    if (status && assignedTo === undefined) {
      asset.status = status;
    }

    await asset.save();

    await createAuditLog(
      'ASSET_UPDATE',
      req.user?.email || 'System',
      'ASSET',
      asset.id,
      `Updated asset details: ${asset.name}`,
      orgId
    );

    res.status(200).json({ success: true, data: asset });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const deleteAsset = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;
    if (!orgId) {
      res.status(401).json({ success: false, message: 'Unauthorized' });
      return;
    }

    const result = await Asset.deleteOne({ _id: id, organizationId: orgId });
    if (result.deletedCount === 0) {
      res.status(404).json({ success: false, message: 'Asset not found' });
      return;
    }

    await createAuditLog(
      'ASSET_DELETE',
      req.user?.email || 'System',
      'ASSET',
      id,
      `Deleted asset record ${id}`,
      orgId
    );

    res.status(200).json({ success: true, message: 'Asset deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};
