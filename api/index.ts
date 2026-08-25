import { getApiConfig } from './config';
import {
  createMembershipSetupIntent as _createMembershipSetupIntent,
  createTerminalConnectionToken as _createTerminalConnectionToken,
  createTicketPaymentIntent as _createTicketPaymentIntent,
  eventsList as _eventsList,
  membershipPlans as _membershipPlans,
  membershipStatus as _membershipStatus,
  searchMembers as _searchMembers,
  signOut as _signOut,
  subscribeMembership as _subscribeMembership,
} from './endpoints';
import type {
  EventsListParams,
  MembershipSetupIntentRequest,
  SubscribeRequest,
  TicketPaymentIntentRequest,
} from './types';

export { request, ApiClientError } from './client';
export type { RequestOptions } from './client';
export {
  API_BASE_URLS,
  DEFAULT_ENVIRONMENT,
  getApiConfig,
  getBaseUrlForEnvironment,
  getDefaultEnvironment,
  getEnvironment,
  getToken,
  isValidEnvironment,
  resetConfigForTesting,
  setEnvironment,
  setToken,
} from './config';
export type { ApiClientConfig, ApiEnvironment } from './config';

/**
 * Default API instance — always reads the current environment/token via
 * getApiConfig(), so callers never juggle config themselves. Auth endpoints
 * that need a raw config (sign-in, before a token exists) are exported
 * separately from ./endpoints.
 */
export const api = {
  eventsList: (params: EventsListParams = {}) => _eventsList(getApiConfig(), params),
  membershipPlans: () => _membershipPlans(getApiConfig()),
  membershipStatus: (memberId: string) => _membershipStatus(getApiConfig(), memberId),
  subscribeMembership: (body: SubscribeRequest) => _subscribeMembership(getApiConfig(), body),
  createMembershipSetupIntent: (body: MembershipSetupIntentRequest) =>
    _createMembershipSetupIntent(getApiConfig(), body),
  createTerminalConnectionToken: () => _createTerminalConnectionToken(getApiConfig()),
  createTicketPaymentIntent: (eventId: string, body: TicketPaymentIntentRequest) =>
    _createTicketPaymentIntent(getApiConfig(), eventId, body),
  searchMembers: (query: string) => _searchMembers(getApiConfig(), query),
  signOut: () => _signOut(getApiConfig()),
};

export { exchangeCode, signInWithPassword } from './endpoints';

export type {
  ApiErrorBody,
  ApiValidationErrors,
  AppUser,
  ConnectionTokenResponse,
  Event,
  EventCoverImage,
  EventPricingInfo,
  EventsListParams,
  EventsMeta,
  EventsResponse,
  EventTicketTier,
  Member,
  MembershipPlan,
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
  UserRole,
} from './types';
