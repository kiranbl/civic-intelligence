import * as districtService from '../services/district.service.js';

export async function getDistricts(req, res) {
  const data = await districtService.getDistricts();
  res.json({ success: true, data });
}

export async function getDistrict(req, res) {
  const data = await districtService.getDistrictById(res.locals.districtId);
  res.json({ success: true, data });
}

export async function getDistrictRequests(req, res) {
  const data = await districtService.getDistrictRequests(res.locals.districtId);
  res.json({ success: true, data });
}

export async function getDistrictInfrastructure(req, res) {
  const data = await districtService.getDistrictInfrastructure(res.locals.districtId);
  res.json({ success: true, data });
}
