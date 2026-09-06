const { canMutate, canOversee } = require('../../utils/roleAccess');

describe('roleAccess', () => {
  describe('canMutate', () => {
    it('returns true for admin and super_admin', () => {
      expect(canMutate('admin')).toBe(true);
      expect(canMutate('super_admin')).toBe(true);
    });

    it('returns false for manager, student, and landlord', () => {
      expect(canMutate('manager')).toBe(false);
      expect(canMutate('student')).toBe(false);
      expect(canMutate('landlord')).toBe(false);
    });

    it('returns false for unknown roles', () => {
      expect(canMutate('bogus')).toBe(false);
    });
  });

  describe('canOversee', () => {
    it('returns true for admin, super_admin, and manager', () => {
      expect(canOversee('admin')).toBe(true);
      expect(canOversee('super_admin')).toBe(true);
      expect(canOversee('manager')).toBe(true);
    });

    it('returns false for student and landlord', () => {
      expect(canOversee('student')).toBe(false);
      expect(canOversee('landlord')).toBe(false);
    });

    it('returns false for unknown roles', () => {
      expect(canOversee('bogus')).toBe(false);
    });
  });
});
