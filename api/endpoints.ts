import { request } from './client';
import type { ApiClientConfig } from './config';
import type {
  ConnectionTokenResponse,
  EventsListParams,
  EventsResponse,
  MembershipPlansResponse,
  MembershipSetupIntentRequest,
  MembershipSetupIntentResponse,
  MembershipStatusResponse,
  MembersSearchResponse,
  PasswordSessionResponse,
  SubscribeRequest,
  SubscribeResponse,
  TicketPaymentIntentRequest,
  TicketPaymentIntentResponse,
} from './types';

export function signInWithPassword(
  config: ApiClientConfig,
  email: string,
  password: string
): Promise<PasswordSessionResponse> {
  return request<PasswordSessionResponse>(config, '/api/v1/app/auth/password', {
    method: 'POST',
    body: { email, password },
    skipAuth: true,
  });
}

export function exchangeCode(
  config: ApiClientConfig,
  code: string
): Promise<PasswordSessionResponse> {
  return request<PasswordSessionResponse>(config, '/api/v1/app/auth/exchange', {
    method: 'POST',
    body: { code },
    skipAuth: true,
  });
}

export function signOut(config: ApiClientConfig): Promise<undefined> {
  return request<undefined>(config, '/api/v1/app/auth/logout', { method: 'DELETE' });
}

export function eventsList(
  config: ApiClientConfig,
  params: EventsListParams = {}
): Promise<EventsResponse> {
  const searchParams: Record<string, string> = {};
  if (params.page !== undefined) searchParams.page = String(params.page);
  if (params.page_size !== undefined) searchParams.page_size = String(params.page_size);
  return request<EventsResponse>(config, '/api/v1/app/events', { searchParams });
}

export function membershipPlans(config: ApiClientConfig): Promise<MembershipPlansResponse> {
  return request<MembershipPlansResponse>(config, '/api/v1/app/memberships/plans');
}

export function subscribeMembership(
  config: ApiClientConfig,
  body: SubscribeRequest
): Promise<SubscribeResponse> {
  return request<SubscribeResponse>(config, '/api/v1/app/memberships/subscribe', {
    method: 'POST',
    body,
  });
}

export function membershipStatus(
  config: ApiClientConfig,
  memberId: string
): Promise<MembershipStatusResponse> {
  return request<MembershipStatusResponse>(config, '/api/v1/app/memberships/status', {
    searchParams: { member_id: memberId },
  });
}

export function searchMembers(
  config: ApiClientConfig,
  query: string
): Promise<MembersSearchResponse> {
  return request<MembersSearchResponse>(config, '/api/v1/app/members/search', {
    searchParams: { q: query },
  });
}

export function createMembershipSetupIntent(
  config: ApiClientConfig,
  body: MembershipSetupIntentRequest
): Promise<MembershipSetupIntentResponse> {
  return request<MembershipSetupIntentResponse>(config, '/api/v1/app/memberships/setup_intent', {
    method: 'POST',
    body,
  });
}

export function createTerminalConnectionToken(
  config: ApiClientConfig
): Promise<ConnectionTokenResponse> {
  return request<ConnectionTokenResponse>(config, '/api/v1/app/payments/connection_token', {
    method: 'POST',
  });
}

export function createTicketPaymentIntent(
  config: ApiClientConfig,
  ticketTierId: string,
  body: TicketPaymentIntentRequest
): Promise<TicketPaymentIntentResponse> {
  return request<TicketPaymentIntentResponse>(
    config,
    `/api/v1/app/tickets/${ticketTierId}/payment_intent`,
    { method: 'POST', body }
  );
}
