import { getWaterPriority } from './waterPriority.service.js';
import { WATER_PLANNING_THRESHOLDS, WATER_PLANNING_ACTIONS, WATER_PLANNING_LIMITATIONS } from '../config/waterPlanning.js';

export function addWaterPlanning(district) {
  const { demandIndex, infrastructureGap, ruralFhtcCoverage } = district;
  const validPercent = value => Number.isFinite(value) && value >= 0 && value <= 100;
  const complete = district.dataCompleteness === 'COMPLETE'
    && [demandIndex, infrastructureGap, ruralFhtcCoverage].every(validPercent);
  let planningProfile = 'INSUFFICIENT_DATA';
  let rationale = ['Required demand or infrastructure evidence is incomplete; review data before drawing a planning conclusion.'];
  if (complete) {
    const highDemand = demandIndex >= WATER_PLANNING_THRESHOLDS.highDemand;
    const highGap = infrastructureGap >= WATER_PLANNING_THRESHOLDS.highGap;
    planningProfile = `${highDemand ? 'HIGH' : 'LOW'}_DEMAND_${highGap ? 'HIGH' : 'LOW'}_GAP`;
    const implications = {
      HIGH_DEMAND_HIGH_GAP: 'Both relative demand and the reported connection gap suggest access constraints worth investigating; they do not establish a construction requirement.',
      HIGH_DEMAND_LOW_GAP: 'Consider investigating localized reliability or service issues before assuming a broad access deficit; these aggregate measures do not prove the cause.',
      LOW_DEMAND_HIGH_GAP: 'Low observed request demand must not automatically be interpreted as low need; investigate participation and potentially under-reported access gaps.',
      LOW_DEMAND_LOW_GAP: 'Monitoring and preventive maintenance may be worth considering before an expansion investigation; localized unmet needs may still exist.',
    };
    rationale = [
      `Citizen water demand index is ${demandIndex.toFixed(2)}, ${highDemand ? 'at or above' : 'below'} the prototype high-demand threshold of ${WATER_PLANNING_THRESHOLDS.highDemand}, relative to the analysed districts.`,
      `Reported rural tap-connection coverage is ${ruralFhtcCoverage.toFixed(2)}%; the gap is ${infrastructureGap.toFixed(2)} percentage points, ${highGap ? 'at or above' : 'below'} the prototype high-gap threshold of ${WATER_PLANNING_THRESHOLDS.highGap}.`,
      implications[planningProfile],
    ];
  }
  return {
    ...district,
    planningProfile,
    planningAction: { ...WATER_PLANNING_ACTIONS[planningProfile] },
    rationale,
    evidence: {
      ruralWaterRequestCount: district.ruralWaterRequestCount,
      ruralWaterRequestsPer100k: district.ruralWaterRequestsPer100k,
      demandIndex, ruralFhtcCoverage, infrastructureGap,
    },
    limitations: [...WATER_PLANNING_LIMITATIONS],
  };
}

export async function getWaterPlanning() {
  // Reuse the complete existing calculation and ordering; no Gemini or writes.
  const result = await getWaterPriority();
  return {
    ...result,
    data: result.data.map(addWaterPlanning),
    planningMethodology: {
      description: 'Deterministic prototype planning considerations; not official government recommendations.',
      thresholds: WATER_PLANNING_THRESHOLDS,
      inputPrecision: 'Uses the existing two-decimal water-priority output; thresholds are inclusive.',
    },
  };
}
