const HousingNeedRequestService = require('../../Services/housingNeedRequestService');

const {
  COOLDOWN_DAYS,
  normalizeArea,
  buildFullName,
  canTransitionStatus,
} = HousingNeedRequestService.__testables;

describe('housingNeedRequestService helpers', () => {
  test('normalizeArea trims and lowercases text', () => {
    expect(normalizeArea('  Nasr City  ')).toBe('nasr city');
    expect(normalizeArea('DoKkI')).toBe('dokki');
  });

  test('buildFullName prefers profile names and falls back to username', () => {
    expect(buildFullName('Sara', 'Ali', 'sara_user')).toBe('Sara Ali');
    expect(buildFullName(null, null, 'fallback_user')).toBe('fallback_user');
  });

  test('status transitions only allow submitted->reviewed->closed', () => {
    expect(canTransitionStatus('submitted', 'reviewed')).toBe(true);
    expect(canTransitionStatus('reviewed', 'closed')).toBe(true);

    expect(canTransitionStatus('submitted', 'closed')).toBe(false);
    expect(canTransitionStatus('closed', 'reviewed')).toBe(false);
    expect(canTransitionStatus('reviewed', 'reviewed')).toBe(false);
  });

  test('cooldown constant is 7 days', () => {
    expect(COOLDOWN_DAYS).toBe(7);
  });
});
