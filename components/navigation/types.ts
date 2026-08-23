export type MemberSearchPurpose =
  | { purpose: 'membership' }
  | {
      purpose: 'ticket';
      eventId: string;
      eventTitle: string;
      ticketTierId: string;
      ticketTierName: string;
      priceLabel: string;
    };

export type CollectPaymentParams =
  | {
      kind: 'membership';
      memberId: string;
      memberName: string;
      planId: string;
      planName: string;
      amountLabel: string;
    }
  | {
      kind: 'ticket';
      memberId: string;
      memberName: string;
      eventId: string;
      eventTitle: string;
      ticketTierId: string;
      ticketTierName: string;
      priceLabel: string;
    };

export type RootStackParamList = {
  SignIn: undefined;
  Home: undefined;
  MemberSearch: MemberSearchPurpose;
  MembershipPlans: { memberId: string; memberName: string };
  EventTicketTiers: { eventId: string; eventTitle: string };
  CollectPayment: CollectPaymentParams;
};
