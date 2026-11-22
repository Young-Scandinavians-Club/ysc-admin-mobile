import type { EventTicketTier } from '@/api/types';
import type { TicketBuyer } from '@/components/navigation/types';
import {
  buyerName,
  buyerRequestFields,
  canBuyTier,
  hasPublicPayableTier,
  isValidEmail,
} from '@/lib/ticketBuyer';

function tier(overrides: Partial<EventTicketTier> = {}): EventTicketTier {
  return {
    id: 't1',
    name: 'General',
    description: null,
    type: 'paid',
    price: '$20.00',
    quantity: null,
    tickets_sold: 0,
    available: null,
    requires_registration: false,
    start_date: null,
    end_date: null,
    ...overrides,
  };
}

const activeMember: TicketBuyer = {
  kind: 'member',
  memberId: 'm1',
  memberName: 'Ada Lovelace',
  hasActiveMembership: true,
};
const lapsedMember: TicketBuyer = { ...activeMember, hasActiveMembership: false };
const guest: TicketBuyer = {
  kind: 'guest',
  firstName: 'Gus',
  lastName: '',
  email: 'gus@example.com',
};

describe('canBuyTier', () => {
  it('lets an active member buy any tier', () => {
    expect(canBuyTier(activeMember, tier())).toBe(true);
    expect(canBuyTier(activeMember, tier({ sale_audience: 'members_only' }))).toBe(true);
  });

  it('limits guests and lapsed members to public tiers', () => {
    for (const buyer of [guest, lapsedMember]) {
      expect(canBuyTier(buyer, tier({ sale_audience: 'public' }))).toBe(true);
      expect(canBuyTier(buyer, tier({ sale_audience: 'member_guests' }))).toBe(false);
      expect(canBuyTier(buyer, tier({ sale_audience: 'members_only' }))).toBe(false);
      // A backend without sale_audience must never expose tiers to non-members.
      expect(canBuyTier(buyer, tier())).toBe(false);
    }
  });
});

describe('hasPublicPayableTier', () => {
  it('needs a public tier that is paid or a donation', () => {
    expect(hasPublicPayableTier(null)).toBe(false);
    expect(hasPublicPayableTier([tier()])).toBe(false);
    expect(hasPublicPayableTier([tier({ sale_audience: 'public', type: 'free' })])).toBe(false);
    expect(hasPublicPayableTier([tier({ sale_audience: 'public' })])).toBe(true);
    expect(hasPublicPayableTier([tier({ sale_audience: 'public', type: 'donation' })])).toBe(true);
  });
});

describe('buyerRequestFields', () => {
  it('sends member_id for a member', () => {
    expect(buyerRequestFields(activeMember)).toEqual({ member_id: 'm1' });
  });

  it('sends guest fields, omitting an empty last name', () => {
    expect(buyerRequestFields(guest)).toEqual({
      guest_first_name: 'Gus',
      guest_email: 'gus@example.com',
    });
    expect(buyerRequestFields({ ...guest, lastName: 'Gustafsson' })).toEqual({
      guest_first_name: 'Gus',
      guest_last_name: 'Gustafsson',
      guest_email: 'gus@example.com',
    });
  });
});

describe('buyerName / isValidEmail', () => {
  it('names a guest by first and last name', () => {
    expect(buyerName(guest)).toBe('Gus');
    expect(buyerName({ ...guest, lastName: 'Gustafsson' })).toBe('Gus Gustafsson');
  });

  it('validates emails loosely', () => {
    expect(isValidEmail(' a@b.co ')).toBe(true);
    expect(isValidEmail('a@b')).toBe(false);
    expect(isValidEmail('')).toBe(false);
  });
});
