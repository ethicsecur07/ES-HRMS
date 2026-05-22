import { Response, NextFunction } from 'express';
import { RBACRequest } from '../../middlewares/rbacGuard.js';
import { Branch, Division, BusinessUnit, CostCenter, ReportingHierarchy } from '../../models/OrganizationStructure.js';
import { Employee } from '../../models/Employee.js';

export const getOrgStructureData = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    if (!orgId) {
      res.status(400).json({ message: 'Organization ID is required' });
      return;
    }

    const branches = await Branch.find({ organizationId: orgId });
    const divisions = await Division.find({ organizationId: orgId }).populate('branchId', 'name code');
    const businessUnits = await BusinessUnit.find({ organizationId: orgId }).populate('divisionId', 'name code');
    const costCenters = await CostCenter.find({ organizationId: orgId });
    const reporting = await ReportingHierarchy.find({ organizationId: orgId })
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
    if ((res as any).jsonSanitized) {
      (res as any).jsonSanitized(result);
    } else {
      res.json(result);
    }
  } catch (err) {
    next(err);
  }
};

// --- BRANCH CRUD ---
export const createBranch = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const branch = new Branch({ ...req.body, organizationId: orgId });
    await branch.save();
    res.status(201).json(branch);
  } catch (err) {
    next(err);
  }
};

export const updateBranch = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const branch = await Branch.findOneAndUpdate(
      { _id: req.params.id, organizationId: orgId },
      req.body,
      { new: true }
    );
    if (!branch) {
      res.status(404).json({ message: 'Branch not found' });
      return;
    }
    res.json(branch);
  } catch (err) {
    next(err);
  }
};

export const deleteBranch = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const branch = await Branch.findOne({ _id: req.params.id, organizationId: orgId });
    if (!branch) {
      res.status(404).json({ message: 'Branch not found' });
      return;
    }
    // Leverage the softDelete custom method from softDeletePlugin
    if (typeof (branch as any).softDelete === 'function') {
      await (branch as any).softDelete();
    } else {
      await branch.deleteOne();
    }
    res.json({ message: 'Branch soft-deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// --- DIVISION CRUD ---
export const createDivision = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const division = new Division({ ...req.body, organizationId: orgId });
    await division.save();
    res.status(201).json(division);
  } catch (err) {
    next(err);
  }
};

export const updateDivision = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const division = await Division.findOneAndUpdate(
      { _id: req.params.id, organizationId: orgId },
      req.body,
      { new: true }
    );
    if (!division) {
      res.status(404).json({ message: 'Division not found' });
      return;
    }
    res.json(division);
  } catch (err) {
    next(err);
  }
};

export const deleteDivision = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const division = await Division.findOne({ _id: req.params.id, organizationId: orgId });
    if (!division) {
      res.status(404).json({ message: 'Division not found' });
      return;
    }
    if (typeof (division as any).softDelete === 'function') {
      await (division as any).softDelete();
    } else {
      await division.deleteOne();
    }
    res.json({ message: 'Division soft-deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// --- BUSINESS UNIT CRUD ---
export const createBusinessUnit = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const bu = new BusinessUnit({ ...req.body, organizationId: orgId });
    await bu.save();
    res.status(201).json(bu);
  } catch (err) {
    next(err);
  }
};

export const updateBusinessUnit = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const bu = await BusinessUnit.findOneAndUpdate(
      { _id: req.params.id, organizationId: orgId },
      req.body,
      { new: true }
    );
    if (!bu) {
      res.status(404).json({ message: 'Business Unit not found' });
      return;
    }
    res.json(bu);
  } catch (err) {
    next(err);
  }
};

export const deleteBusinessUnit = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const bu = await BusinessUnit.findOne({ _id: req.params.id, organizationId: orgId });
    if (!bu) {
      res.status(404).json({ message: 'Business Unit not found' });
      return;
    }
    if (typeof (bu as any).softDelete === 'function') {
      await (bu as any).softDelete();
    } else {
      await bu.deleteOne();
    }
    res.json({ message: 'Business Unit soft-deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// --- COST CENTER CRUD ---
export const createCostCenter = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const cc = new CostCenter({ ...req.body, organizationId: orgId });
    await cc.save();
    res.status(201).json(cc);
  } catch (err) {
    next(err);
  }
};

export const updateCostCenter = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const cc = await CostCenter.findOneAndUpdate(
      { _id: req.params.id, organizationId: orgId },
      req.body,
      { new: true }
    );
    if (!cc) {
      res.status(404).json({ message: 'Cost Center not found' });
      return;
    }
    res.json(cc);
  } catch (err) {
    next(err);
  }
};

export const deleteCostCenter = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const cc = await CostCenter.findOne({ _id: req.params.id, organizationId: orgId });
    if (!cc) {
      res.status(404).json({ message: 'Cost Center not found' });
      return;
    }
    if (typeof (cc as any).softDelete === 'function') {
      await (cc as any).softDelete();
    } else {
      await cc.deleteOne();
    }
    res.json({ message: 'Cost Center soft-deleted successfully' });
  } catch (err) {
    next(err);
  }
};

// Recursive cycle detection helper
const wouldCreateCycle = async (
  employeeId: string,
  proposedManagerId: string,
  orgId: any,
  visited: Set<string> = new Set()
): Promise<boolean> => {
  if (employeeId === proposedManagerId) return true;
  if (visited.has(proposedManagerId)) return true;
  visited.add(proposedManagerId);

  const managerHierarchy = await ReportingHierarchy.findOne({
    employeeId: proposedManagerId,
    organizationId: orgId,
  });

  if (!managerHierarchy) return false;

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
export const saveReportingHierarchy = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const orgId = req.user?.organizationId;
    const { employeeId, primaryManagerId, matrixManagers, hrBPId } = req.body;

    if (!orgId) {
      res.status(400).json({ message: 'Organization ID is required' });
      return;
    }

    // 1. Verify target employee exists and belongs to this organization
    const targetEmployee = await Employee.findOne({ _id: employeeId, organizationId: orgId });
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
      const pManager = await Employee.findOne({ _id: primaryManagerId, organizationId: orgId });
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
        const mManager = await Employee.findOne({ _id: mId, organizationId: orgId });
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
      const hrBP = await Employee.findOne({ _id: hrBPId, organizationId: orgId });
      if (!hrBP) {
        res.status(400).json({ message: 'HR Business Partner not found in this organization.' });
        return;
      }
    }

    let hierarchy = await ReportingHierarchy.findOne({ employeeId, organizationId: orgId });

    if (hierarchy) {
      hierarchy.primaryManagerId = primaryManagerId || null;
      hierarchy.matrixManagers = matrixManagers || [];
      hierarchy.hrBPId = hrBPId || null;
      await hierarchy.save();
    } else {
      hierarchy = new ReportingHierarchy({
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
  } catch (err) {
    next(err);
  }
};
