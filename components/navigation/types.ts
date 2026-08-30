export type MemberSearchPurpose =
  { purpose: 'membership' } | { purpose: 'ticket'; eventId: string; eventTitle: string };

/** Where to send the volunteer after a membership sign-up completes, when the
 *  sign-up was only a detour on the way to buying event tickets (see
 *  MemberSearchScreen's "no active membership" branch). */
export interface ResumeTicket {
  eventId: string;
  eventTitle: string;
}

export interface TicketSelectionItem {
  ticketTierId: string;
  name: string;
  quantity: number;
  unitPriceLabel: string;
  /** Set for `donation` tiers: the volunteer-entered donation amount in cents.
   *  The backend's ticket-selection map reads a donation tier's value as cents
   *  rather than a quantity, so this (not `quantity`) is what gets sent. */
  donationAmountCents?: number;
}

/** Skip the card reader on arrival and open the cash / check form straight
 *  away. Set when the seller long-presses "Continue" (or a membership plan
 *  row) — a deliberate gesture for the cash-only door, since the reader
 *  otherwise auto-starts and buries the on-screen offline button. */
type StartOfflineFlag = { startOffline?: boolean };

export type CollectPaymentParams =
  | ({
      kind: 'membership';
      memberId: string;
      memberName: string;
      planId: string;
      planName: string;
      amountLabel: string;
      resumeTicket?: ResumeTicket;
    } & StartOfflineFlag)
  | ({
      kind: 'ticket';
      memberId: string;
      memberName: string;
      eventId: string;
      eventTitle: string;
      items: readonly TicketSelectionItem[];
      totalLabel: string;
    } & StartOfflineFlag);

export type RootStackParamList = {
  SignIn: undefined;
  Home: undefined;
  MemberSearch: MemberSearchPurpose;
  MembershipDetails: { memberId: string; memberName: string };
  MembershipPlans: { memberId: string; memberName: string; resumeTicket?: ResumeTicket };
  EventTicketQuantities: {
    eventId: string;
    eventTitle: string;
    memberId: string;
    memberName: string;
  };
  CollectPayment: CollectPaymentParams;
};
