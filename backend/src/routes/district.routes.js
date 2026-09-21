import { Router } from 'express';
import {
  getDistricts, getDistrict, getDistrictRequests, getDistrictInfrastructure,
} from '../controllers/district.controller.js';
import { validateDistrictId } from '../validators/district.validator.js';

const router = Router();

router.get('/', getDistricts);
router.get('/:id', validateDistrictId, getDistrict);
router.get('/:id/requests', validateDistrictId, getDistrictRequests);
router.get('/:id/infrastructure', validateDistrictId, getDistrictInfrastructure);

export default router;
