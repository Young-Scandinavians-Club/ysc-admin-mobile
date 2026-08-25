export type MemberSearchPurpose =
  { purpose: 'membership' } | { purpose: 'ticket'; eventId: string; eventTitle: string };

export interface TicketSelectionItem {
  ticketTierId: string;
  name: string;
  quantity: number;
  unitPriceLabel: string;
}

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
      items: readonly TicketSelectionItem[];
      totalLabel: string;
    };

export type RootStackParamList = {
  SignIn: undefined;
  Home: undefined;
  MemberSearch: MemberSearchPurpose;
  MembershipDetails: { memberId: string; memberName: string };
  MembershipPlans: { memberId: string; memberName: string };
  EventTicketQuantities: {
    eventId: string;
    eventTitle: string;
    memberId: string;
    memberName: string;
  };
  CollectPayment: CollectPaymentParams;
};
