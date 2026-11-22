import type { EventTicketTier, TicketBuyerFields } from '@/api/types';
import type { TicketBuyer } from '@/components/navigation/types';

export function isPublicTier(tier: EventTicketTier): boolean {
  return tier.sale_audience === 'public';
}

export function isPayableTier(tier: EventTicketTier): boolean {
  return tier.type === 'paid' || tier.type === 'donation';
}

/** An event is worth offering to a non-member (or a guest) only if it has a
 *  public tier the app can actually sell. */
export function hasPublicPayableTier(
  tiers: readonly EventTicketTier[] | null | undefined
): boolean {
  return (tiers ?? []).some((tier) => isPublicTier(tier) && isPayableTier(tier));
}

/** Guests and members without an active membership can only buy public tiers;
 *  an active member can buy anything. Mirrors the backend, which skips the
 *  membership requirement only when every selected tier is public. */
export function canBuyTier(buyer: TicketBuyer, tier: EventTicketTier): boolean {
  if (buyer.kind === 'member' && buyer.hasActiveMembership) return true;
  return isPublicTier(tier);
}

export function buyerName(buyer: TicketBuyer): string {
  if (buyer.kind === 'member') return buyer.memberName;
  return [buyer.firstName, buyer.lastName].filter(Boolean).join(' ') || buyer.email;
}

/** The buyer part of a ticket payment-intent / offline-order request body. */
export function buyerRequestFields(buyer: TicketBuyer): TicketBuyerFields {
  if (buyer.kind === 'member') return { member_id: buyer.memberId };
  return {
    guest_first_name: buyer.firstName,
    ...(buyer.lastName ? { guest_last_name: buyer.lastName } : {}),
    guest_email: buyer.email,
  };
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: string): boolean {
  return EMAIL_PATTERN.test(email.trim());
}
