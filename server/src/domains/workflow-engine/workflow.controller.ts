import { Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { RBACRequest } from '../../middlewares/rbacGuard.js';
import { WorkflowTemplate } from '../../models/WorkflowTemplate.js';
import { WorkflowInstance } from '../../models/WorkflowInstance.js';
import { WorkflowRunner } from './WorkflowRunner.js';
import { GraphValidator } from './GraphValidator.js';
import { TemplateMarketplace } from './TemplateMarketplace.js';
import { SlaMonitorService } from './SlaMonitorService.js';
import { logger } from '../../utils/logger.js';

/**
 * Create a new workflow template (Draft by default)
 */
export async function createTemplate(req: RBACRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ message: 'Organization context is required.' });
    }

    const { name, nodes, triggerEvent } = req.body;

    // Enforce Graph Structure Integrity Check
    const validationErrors = GraphValidator.validate(nodes || []);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: 'Invalid workflow graph structure.',
        errors: validationErrors
      });
    }

    const template = await WorkflowTemplate.create({
      organizationId: orgId,
      name,
      triggerEvent: triggerEvent || 'MANUAL',
      nodes: nodes || [],
      version: 1,
      isPublished: false,
      isActive: false
    });

    res.status(201).json(template);
  } catch (err) {
    next(err);
  }
}

/**
 * Get all workflow templates for an organization
 */
export async function getTemplates(req: RBACRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user?.organizationId;
    const query: any = { organizationId: orgId };
    
    if (req.query.triggerEvent) {
      query.triggerEvent = req.query.triggerEvent;
    }
    if (req.query.isActive !== undefined) {
      query.isActive = req.query.isActive === 'true';
    }

    const templates = await WorkflowTemplate.find(query).sort({ triggerEvent: 1, version: -1 });
    res.json(templates);
  } catch (err) {
    next(err);
  }
}
export const listTemplates = getTemplates;

/**
 * Update template (Supports Draft in-place editing or creating new version if published)
 */
export async function updateTemplate(req: RBACRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;
    const { name, nodes, triggerEvent } = req.body;

    const existingTemplate = await WorkflowTemplate.findOne({ _id: id, organizationId: orgId });
    if (!existingTemplate) {
      return res.status(404).json({ message: 'Workflow template not found.' });
    }

    // Graph validation
    const validationErrors = GraphValidator.validate(nodes || []);
    if (validationErrors.length > 0) {
      return res.status(400).json({
        message: 'Invalid workflow graph structure.',
        errors: validationErrors
      });
    }

    if (existingTemplate.isPublished) {
      // If template is already published, save changes as a new inactive version
      const latestVersion = await WorkflowTemplate.findOne({
        organizationId: orgId,
        triggerEvent: existingTemplate.triggerEvent
      }).sort({ version: -1 });

      const newVersionNum = (latestVersion?.version || existingTemplate.version) + 1;

      const newVersion = await WorkflowTemplate.create({
        organizationId: orgId,
        name: name || existingTemplate.name,
        triggerEvent: triggerEvent || existingTemplate.triggerEvent,
        nodes: nodes || existingTemplate.nodes,
        version: newVersionNum,
        isPublished: false,
        isActive: false
      });

      return res.status(201).json({
        message: 'Saved changes as a new version draft.',
        template: newVersion
      });
    } else {
      // In-place draft modification
      existingTemplate.name = name || existingTemplate.name;
      existingTemplate.nodes = nodes || existingTemplate.nodes;
      existingTemplate.triggerEvent = triggerEvent || existingTemplate.triggerEvent;
      await existingTemplate.save();

      return res.json({
        message: 'Draft template updated successfully.',
        template: existingTemplate
      });
    }
  } catch (err) {
    next(err);
  }
}

/**
 * Duplicate a template as a new draft
 */
export async function duplicateTemplate(req: RBACRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;

    const source = await WorkflowTemplate.findOne({ _id: id, organizationId: orgId });
    if (!source) {
      return res.status(404).json({ message: 'Source template not found.' });
    }

    const copy = await WorkflowTemplate.create({
      organizationId: orgId,
      name: `${source.name} (Copy)`,
      triggerEvent: source.triggerEvent,
      nodes: source.nodes,
      version: 1,
      isPublished: false,
      isActive: false
    });

    res.status(201).json(copy);
  } catch (err) {
    next(err);
  }
}

/**
 * Publish a draft template and deactivate old versions
 */
export async function publishTemplate(req: RBACRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;

    const template = await WorkflowTemplate.findOne({ _id: id, organizationId: orgId });
    if (!template) {
      return res.status(404).json({ message: 'Template not found.' });
    }

    // Set other versions of this triggerEvent to inactive
    await WorkflowTemplate.updateMany(
      { organizationId: orgId, triggerEvent: template.triggerEvent, _id: { $ne: template._id } },
      { $set: { isActive: false } }
    );

    template.isPublished = true;
    template.isActive = true;
    await template.save();

    res.json({ message: 'Template published successfully.', template });
  } catch (err) {
    next(err);
  }
}

/**
 * Toggle template active status
 */
export async function toggleTemplate(req: RBACRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user?.organizationId;
    const { id } = req.params;
    const { isActive } = req.body;

    const template = await WorkflowTemplate.findOne({ _id: id, organizationId: orgId });
    if (!template) {
      return res.status(404).json({ message: 'Template not found.' });
    }

    if (isActive && template.isPublished) {
      // Deactivate other active templates for this event first
      await WorkflowTemplate.updateMany(
        { organizationId: orgId, triggerEvent: template.triggerEvent, _id: { $ne: template._id } },
        { $set: { isActive: false } }
      );
    }

    template.isActive = !!isActive;
    await template.save();

    res.json({ message: `Template ${isActive ? 'activated' : 'deactivated'} successfully.`, template });
  } catch (err) {
    next(err);
  }
}

/**
 * Start a new workflow instance from a template
 */
export async function startInstance(req: RBACRequest, res: Response, next: NextFunction) {
  try {
    const { workflowTemplateId, refModel, refId, context } = req.body;
    const orgId = req.user?.organizationId;

    const template = await WorkflowTemplate.findOne({ _id: workflowTemplateId, organizationId: orgId });
    if (!template) return res.status(404).json({ message: 'Template not found' });

    const startNode = template.nodes.find(n => n.type === 'START');
    if (!startNode) return res.status(400).json({ message: 'Workflow template does not have a START node.' });

    const instance = await WorkflowInstance.create({
      organizationId: orgId,
      workflowTemplateId,
      refModel,
      refId,
      currentNodeId: startNode.id,
      status: 'ACTIVE',
      history: [{
        nodeId: startNode.id,
        nodeName: startNode.name,
        status: 'APPROVED',
        actionTakenAt: new Date(),
        comments: 'Workflow initialized'
      }]
    });

    // Advance runner to process initial conditions
    await WorkflowRunner.advance(instance.id, context || {});
    const updated = await WorkflowInstance.findById(instance._id);

    res.status(201).json(updated);
  } catch (err) {
    next(err);
  }
}
export const createInstance = startInstance;

/**
 * Approve or reject the current node of a workflow instance
 */
export async function actOnNode(req: RBACRequest, res: Response, next: NextFunction) {
  try {
    const { instanceId } = req.params;
    const { action, comments } = req.body;
    const orgId = req.user?.organizationId;

    if (!['APPROVE', 'REJECT'].includes(action)) {
      return res.status(400).json({ message: 'Action must be APPROVE or REJECT.' });
    }

    const instance = await WorkflowInstance.findOne({ _id: instanceId, organizationId: orgId });
    if (!instance) {
      return res.status(404).json({ message: 'Workflow instance not found in this organization.' });
    }

    if (instance.status !== 'ACTIVE') {
      return res.status(400).json({ message: `Workflow is already ${instance.status}. No further actions allowed.` });
    }

    const actingUser = {
      id: req.user!.id,
      role: req.user!.role,
      email: req.user!.email
    };

    const updated = await WorkflowRunner.advance(
      instance.id, 
      {}, 
      action === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      actingUser,
      comments
    );

    res.json({ message: 'Action processed successfully.', instance: updated });
  } catch (err: any) {
    logger.error(`[workflow.controller] actOnNode error: ${err.message}`);
    res.status(400).json({ message: err.message });
  }
}

/**
 * Get details of a workflow instance
 */
export async function getInstance(req: RBACRequest, res: Response, next: NextFunction) {
  try {
    const { instanceId } = req.params;
    const orgId = req.user?.organizationId;

    const instance = await WorkflowInstance.findOne({ _id: instanceId, organizationId: orgId })
      .populate('workflowTemplateId', 'name triggerEvent version');

    if (!instance) {
      return res.status(404).json({ message: 'Workflow instance not found in this organization.' });
    }

    res.json(instance);
  } catch (err) {
    next(err);
  }
}

/**
 * List all workflow instances for an organization (with filtering & pagination)
 */
export async function listInstances(req: RBACRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user?.organizationId;
    const { templateId, status, refModel, page = 1, limit = 20 } = req.query;

    const query: any = { organizationId: orgId };
    if (templateId) query.workflowTemplateId = templateId;
    if (status) query.status = status;
    if (refModel) query.refModel = refModel;

    const skipNum = (Number(page) - 1) * Number(limit);

    const instances = await WorkflowInstance.find(query)
      .populate('workflowTemplateId', 'name triggerEvent version')
      .sort({ createdAt: -1 })
      .skip(skipNum)
      .limit(Number(limit));

    const total = await WorkflowInstance.countDocuments(query);

    res.json({
      instances,
      total,
      page: Number(page),
      limit: Number(limit),
      pages: Math.ceil(total / Number(limit))
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get templates from the Marketplace
 */
export function getMarketplace(req: RBACRequest, res: Response) {
  try {
    const templates = TemplateMarketplace.getMarketplaceTemplates();
    res.json(templates);
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

/**
 * Install a template from the Marketplace
 */
export async function installFromMarketplace(req: RBACRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user?.organizationId;
    const { code } = req.body;

    if (!orgId) {
      return res.status(401).json({ message: 'Organization context is required.' });
    }
    if (!code) {
      return res.status(400).json({ message: 'Template code is required.' });
    }

    const installed = await TemplateMarketplace.installTemplate(orgId.toString(), code);
    res.status(201).json({ message: 'Marketplace template installed successfully.', template: installed });
  } catch (err: any) {
    logger.error('[workflow.controller] Marketplace install error:', err.message);
    res.status(400).json({ message: err.message });
  }
}

/**
 * Trigger SLA sweep manually
 */
export async function triggerSlaSweep(req: RBACRequest, res: Response) {
  try {
    const breachCount = await SlaMonitorService.sweep();
    res.json({ message: 'Workflow SLA sweep execution completed.', breachesFound: breachCount });
  } catch (err: any) {
    res.status(500).json({ message: err.message });
  }
}

/**
 * Get tenant-safe workflow analytics
 */
export async function getWorkflowAnalytics(req: RBACRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ message: 'Organization context is required.' });
    }

    const orgObjectId = new mongoose.Types.ObjectId(orgId.toString());

    // 1. Completion/Status counts
    const statusCounts = await WorkflowInstance.aggregate([
      { $match: { organizationId: orgObjectId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // 2. Average approval duration (for completed workflows)
    const avgDuration = await WorkflowInstance.aggregate([
      { $match: { organizationId: orgObjectId, status: { $in: ['APPROVED', 'REJECTED'] } } },
      {
        $project: {
          durationMs: { $subtract: ['$updatedAt', '$createdAt'] }
        }
      },
      {
        $group: {
          _id: null,
          avgHours: { $avg: { $divide: ['$durationMs', 1000 * 60 * 60] } },
          totalProcessed: { $sum: 1 }
        }
      }
    ]);

    // 3. Pending approvals counts by role
    const pendingByRole = await WorkflowInstance.aggregate([
      { $match: { organizationId: orgObjectId, status: 'ACTIVE' } },
      { $unwind: '$history' },
      { $match: { 'history.status': 'PENDING' } },
      { $group: { _id: '$history.approverRole', count: { $sum: 1 } } }
    ]);

    // 4. SLA breaches count (instances with SKIPPED history comment containing SLA)
    const slaBreaches = await WorkflowInstance.countDocuments({
      organizationId: orgObjectId,
      'history.comments': { $regex: /SLA/i }
    });

    res.json({
      statusCounts: statusCounts.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {
        ACTIVE: 0,
        APPROVED: 0,
        REJECTED: 0,
        TERMINATED: 0
      }),
      averageDurationHours: avgDuration[0]?.avgHours || 0,
      totalProcessed: avgDuration[0]?.totalProcessed || 0,
      pendingByRole: pendingByRole.reduce((acc, curr) => ({ ...acc, [curr._id || 'UNASSIGNED']: curr.count }), {}),
      slaBreaches
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Export workflow instances to CSV format
 */
export async function exportInstances(req: RBACRequest, res: Response, next: NextFunction) {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      return res.status(401).json({ message: 'Organization context is required.' });
    }

    const instances = await WorkflowInstance.find({ organizationId: orgId })
      .populate('workflowTemplateId', 'name triggerEvent')
      .sort({ createdAt: -1 })
      .limit(1000); // Guard to prevent memory overload

    let csvContent = 'Instance ID,Template Name,Trigger Event,Reference Model,Reference ID,Current Node ID,Status,Created At,Updated At\n';

    for (const inst of instances) {
      const template = inst.workflowTemplateId as any;
      csvContent += `"${inst._id}","${template?.name || 'Unknown'}","${template?.triggerEvent || 'Unknown'}","${inst.refModel}","${inst.refId}","${inst.currentNodeId}","${inst.status}","${inst.createdAt.toISOString()}","${inst.updatedAt.toISOString()}"\n`;
    }

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=workflow-export-${Date.now()}.csv`);
    res.status(200).send(csvContent);
  } catch (err) {
    next(err);
  }
}
