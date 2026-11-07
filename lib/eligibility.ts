// A recorded adult acknowledgement, not identity verification or a date of birth.
export const eligibilityVersion = "2026-11-07";
export function adultEligibilityChoice() {
  return {
    adult_eligibility: true,
    adult_eligibility_version: eligibilityVersion,
    adult_eligibility_at: new Date().toISOString(),
  };
}
export function hasAdultEligibility(metadata: Record<string, unknown>) {
  const time = Date.parse(String(metadata.adult_eligibility_at || ""));
  return metadata.adult_eligibility === true &&
    metadata.adult_eligibility_version === eligibilityVersion &&
    Number.isFinite(time) && time <= Date.now() + 60_000;
}
