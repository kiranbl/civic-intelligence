import prisma from '../config/prisma.js';

export function getDistricts() {
  return prisma.district.findMany({ orderBy: [{ name: 'asc' }, { state: 'asc' }] });
}

export async function getDistrictById(id) {
  const district = await prisma.district.findUnique({ where: { id } });

  if (!district) {
    const error = new Error('District not found');
    error.status = 404;
    throw error;
  }

  return district;
}

export async function getDistrictRequests(id) {
  await getDistrictById(id);
  return prisma.citizenRequest.findMany({
    where: { districtId: id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  });
}

export async function getDistrictInfrastructure(id) {
  await getDistrictById(id);
  return prisma.infrastructureMetric.findMany({
    where: { districtId: id },
    orderBy: [{ metricType: 'asc' }, { id: 'asc' }],
  });
}
