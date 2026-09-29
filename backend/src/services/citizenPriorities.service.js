import prisma from '../config/prisma.js';

const CATEGORIES = ['WATER', 'ROADS', 'HEALTHCARE', 'EDUCATION', 'SANITATION', 'TRANSPORT', 'ELECTRICITY', 'OTHER'];
const URGENCIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'UNSPECIFIED'];
const AREAS = ['RURAL', 'URBAN', 'UNKNOWN'];
const zeroCounts = values => Object.fromEntries(values.map(value => [value, 0]));

export function summarizeCitizenDemand(districts) {
  const categories = zeroCounts(CATEGORIES), urgencies = zeroCounts(URGENCIES), areas = zeroCounts(AREAS);
  let totalRequests = 0;
  const recent = [];
  const districtBreakdown = [...districts].sort((a, b) => a.id - b.id).map(district => {
    const categoryCounts = zeroCounts(CATEGORIES);
    for (const request of district.requests) {
      totalRequests++;
      categories[request.category]++; categoryCounts[request.category]++;
      urgencies[request.urgency ?? 'UNSPECIFIED']++; areas[request.areaType]++;
      // Metadata only: no original text, generated summaries, identities or coordinates.
      recent.push({ id: request.id, districtId: district.id, districtName: district.name,
        category: request.category, urgency: request.urgency, areaType: request.areaType, createdAt: request.createdAt });
    }
    return { districtId: district.id, districtName: district.name, totalRequests: district.requests.length, categoryCounts };
  });
  const breakdown = (counts, field) => Object.entries(counts).map(([value, count]) => ({
    [field]: value, count, percentage: totalRequests ? Math.round(count / totalRequests * 10000) / 100 : 0,
  }));
  return { totalRequests,
    categoryBreakdown: breakdown(categories, 'category'), urgencyBreakdown: breakdown(urgencies, 'urgency'),
    areaTypeBreakdown: breakdown(areas, 'areaType'), districtBreakdown,
    recentRequests: recent.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt) || b.id - a.id).slice(0, 5),
  };
}

export async function getCitizenPriorities() {
  // One read provides a consistent input for all counts, including districts with no requests.
  const districts = await prisma.district.findMany({ orderBy: { id: 'asc' }, select: {
    id: true, name: true, requests: { select: {
      id: true, category: true, urgency: true, areaType: true, createdAt: true,
    } },
  } });
  return summarizeCitizenDemand(districts);
}
