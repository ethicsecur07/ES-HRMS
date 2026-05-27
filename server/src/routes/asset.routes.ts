import { Router } from 'express';
import { getAssets, getEmployeeAssets, createAsset, updateAsset, deleteAsset } from '../controllers/asset.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = Router();

router.use(authenticate as any);

router.get('/', getAssets as any);
router.get('/employee/:employeeId', getEmployeeAssets as any);
router.post('/', authorize(['ADMIN', 'HR']) as any, createAsset as any);
router.put('/:id', authorize(['ADMIN', 'HR']) as any, updateAsset as any);
router.delete('/:id', authorize(['ADMIN', 'HR']) as any, deleteAsset as any);

export default router;
