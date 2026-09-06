const { requestStatusTransitions } = require('../../config/constants');

describe('requestStatusTransitions map', () => {
  test('defines the four allowed transitions from the spec', () => {
    expect(requestStatusTransitions).toEqual({
      pendingToContacted: { from: 'pending', to: 'contacted' },
      pendingToClosed: { from: 'pending', to: 'closed' },
      contactedToResolved: { from: 'contacted', to: 'resolved' },
      contactedToClosed: { from: 'contacted', to: 'closed' },
    });
  });

  test('every defined transition is valid from → to', () => {
    const valid = [
      ['pending', 'contacted'],
      ['pending', 'closed'],
      ['contacted', 'resolved'],
      ['contacted', 'closed'],
    ];
    const transitions = Object.values(requestStatusTransitions).map((t) => [t.from, t.to]);
    for (const pair of valid) {
      expect(transitions).toContainEqual(pair);
    }
  });

  test('rejects the invalid pending → resolved jump', () => {
    const transitions = Object.values(requestStatusTransitions);
    expect(transitions.some((t) => t.from === 'pending' && t.to === 'resolved')).toBe(false);
  });

  test('does not allow staying in place', () => {
    const transitions = Object.values(requestStatusTransitions);
    expect(transitions.some((t) => t.from === t.to)).toBe(false);
    expect(requestStatusTransitions.pendingToPending).toBeUndefined();
  });
});
