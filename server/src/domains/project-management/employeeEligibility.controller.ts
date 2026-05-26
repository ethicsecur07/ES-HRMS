import { Response, NextFunction } from 'express';
import { RBACRequest } from '../../middlewares/rbacGuard.js';
import { Project } from '../../models/Project.js';
import { Employee } from '../../models/Employee.js';

export const isDeptEligible = (projectType: string, deptName: string): boolean => {
  if (!projectType || ['general', 'other', 'all'].includes(projectType.toLowerCase().trim())) {
    return true;
  }

  const pType = projectType.toLowerCase().trim();
  const dName = deptName.toLowerCase().trim();

  if (pType === 'software development') {
    return (
      dName.includes('dev') ||
      dName.includes('software') ||
      dName.includes('development') ||
      dName.includes('engineering')
    );
  }

  if (pType === 'ui/ux') {
    return (
      dName.includes('design') ||
      dName.includes('ui') ||
      dName.includes('ux') ||
      dName.includes('creative')
    );
  }

  if (pType === 'qa') {
    return (
      dName.includes('qa') ||
      dName.includes('testing') ||
      dName.includes('quality assurance') ||
      dName.includes('quality')
    );
  }

  if (pType === 'devops') {
    return (
      dName.includes('devops') ||
      dName.includes('infrastructure') ||
      dName.includes('ops')
    );
  }

  if (pType === 'marketing') {
    return dName.includes('marketing') || dName.includes('digital marketing');
  }

  return true; // Default fallback
};

export const getEligibleEmployees = async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { projectId } = req.params;
    const project = await Project.findOne({ _id: projectId, organizationId: req.user?.organizationId });

    if (!project) {
      res.status(404).json({ message: 'Project not found' });
      return;
    }

    const allEmployees = await Employee.find({
      organizationId: req.user?.organizationId,
      isActive: true,
      isDeleted: { $ne: true } as any, // Mongoose soft delete check
    });

    const eligible = allEmployees.filter((emp) => isDeptEligible(project.projectType, emp.department));

    res.json({ employees: eligible });
  } catch (err) {
    next(err);
  }
};
