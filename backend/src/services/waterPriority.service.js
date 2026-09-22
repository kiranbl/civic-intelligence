import prisma from '../config/prisma.js';
import {
  WATER_PRIORITY_WEIGHTS, WATER_PRIORITY_LEVELS, EQUAL_DEMAND_INDEX,
  RURAL_FHTC_METRIC_TYPE, WATER_PRIORITY_METHODOLOGY,
} from '../config/waterPriority.js';

function roundForDisplay(value) {
  return value === null ? null : Number(value.toFixed(2));
}

export function getWaterPriorityLevel(score) {
  if (!Number.isFinite(score) || score < 0 || score > 100) return null;
  return WATER_PRIORITY_LEVELS.find(({ minimumScore }) => score >= minimumScore).level;
}

// Pure calculation kept separate from data loading for focused business tests.
export function calculateWaterPriority(districts) {
  const inputs = districts.map((district) => {
    const populationIsValid = Number.isInteger(district.ruralPopulation) && district.ruralPopulation > 0;
    const rate = populationIsValid ? (district._count.requests / district.ruralPopulation) * 100000 : null;
    const coverage = district.infrastructure[0]?.value;
    const coverageIsValid = Number.isFinite(coverage) && coverage >= 0 && coverage <= 100;
    return { district, rate, coverage: coverageIsValid ? coverage : null };
  });

  // Avoid spreading a potentially large district collection into Math.min/max.
  let minimumRate = Infinity;
  let maximumRate = -Infinity;
  for (const { rate } of inputs) {
    if (rate !== null) {
      minimumRate = Math.min(minimumRate, rate);
      maximumRate = Math.max(maximumRate, rate);
    }
  }

  const data = inputs.map(({ district, rate, coverage }) => {
    let demandIndex = null;
    if (rate !== null) {
      demandIndex = maximumRate === minimumRate
        ? EQUAL_DEMAND_INDEX
        : ((rate - minimumRate) / (maximumRate - minimumRate)) * 100;
    }
    const infrastructureGap = coverage === null ? null : 100 - coverage;
    const complete = demandIndex !== null && infrastructureGap !== null;
    const priorityScore = complete
      ? roundForDisplay(demandIndex * WATER_PRIORITY_WEIGHTS.demand
        + infrastructureGap * WATER_PRIORITY_WEIGHTS.infrastructureGap)
      : null;

    return {
      districtId: district.id,
      districtName: district.name,
      state: district.state,
      ruralPopulation: district.ruralPopulation ?? null,
      ruralWaterRequestCount: district._count.requests,
      ruralWaterRequestsPer100k: roundForDisplay(rate),
      ruralFhtcCoverage: roundForDisplay(coverage),
      demandIndex: roundForDisplay(demandIndex),
      infrastructureGap: roundForDisplay(infrastructureGap),
      priorityScore,
      priorityLevel: getWaterPriorityLevel(priorityScore),
      dataCompleteness: complete ? 'COMPLETE' : 'INCOMPLETE',
    };
  });

  data.sort((a, b) => {
    if (a.dataCompleteness !== b.dataCompleteness) {
      return a.dataCompleteness === 'COMPLETE' ? -1 : 1;
    }
    return (b.priorityScore ?? 0) - (a.priorityScore ?? 0) || a.districtId - b.districtId;
  });

  return data;
}

export async function getWaterPriority() {
  const districts = await prisma.district.findMany({
    select: {
      id: true,
      name: true,
      state: true,
      ruralPopulation: true,
      _count: { select: { requests: { where: { category: 'WATER', areaType: 'RURAL' } } } },
      infrastructure: {
        where: { metricType: RURAL_FHTC_METRIC_TYPE },
        orderBy: [{ sourceYear: 'desc' }, { createdAt: 'desc' }, { id: 'desc' }],
        take: 1,
        select: { value: true },
      },
    },
  });

  return { data: calculateWaterPriority(districts), methodology: WATER_PRIORITY_METHODOLOGY };
}
