import { amountLabelToInput, dollarsToCents } from '@/lib/money';

describe('amountLabelToInput', () => {
  it('takes only the amount after the last "$", not the ticket count', () => {
    expect(amountLabelToInput('2 tickets · $40.00')).toBe('40.00');
    expect(amountLabelToInput('1 ticket + donation · $40.00')).toBe('40.00');
  });

  it('handles the unknown-price "($40.00+)" form', () => {
    expect(amountLabelToInput('2 tickets ($40.00+)')).toBe('40.00');
  });

  it('handles a bare amount / no decimals', () => {
    expect(amountLabelToInput('$90')).toBe('90');
    expect(amountLabelToInput('90.00')).toBe('90.00');
  });

  it('returns "" when there is no number', () => {
    expect(amountLabelToInput('nothing selected')).toBe('');
  });
});

describe('dollarsToCents', () => {
  it('converts dollars to integer cents', () => {
    expect(dollarsToCents('40')).toBe(4000);
    expect(dollarsToCents('40.5')).toBe(4050);
    expect(dollarsToCents('40.005')).toBe(4001);
  });

  it('rejects blank / negative / non-numeric', () => {
    expect(dollarsToCents('')).toBeNull();
    expect(dollarsToCents('-1')).toBeNull();
    expect(dollarsToCents('abc')).toBeNull();
  });
});
