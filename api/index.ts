import { getApiConfig } from './config';
import {
  createTerminalConnectionToken as _createTerminalConnectionToken,
  createTicketPaymentIntent as _createTicketPaymentIntent,
  eventsList as _eventsList,
  membershipPlans as _membershipPlans,
  signOut as _signOut,
  subscribeMembership as _subscribeMembership,
} from './endpoints';
import type { EventsListParams, SubscribeRequest, TicketPaymentIntentRequest } from './types';

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
  subscribeMembership: (body: SubscribeRequest) => _subscribeMembership(getApiConfig(), body),
  createTerminalConnectionToken: () => _createTerminalConnectionToken(getApiConfig()),
  createTicketPaymentIntent: (ticketTierId: string, body: TicketPaymentIntentRequest) =>
    _createTicketPaymentIntent(getApiConfig(), ticketTierId, body),
  signOut: () => _signOut(getApiConfig()),
};

export { signInWithPassword } from './endpoints';

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
  MembershipPlan,
  MembershipPlansResponse,
  PasswordSessionResponse,
  SubscribeRequest,
  SubscribeResponse,
  TicketPaymentIntentRequest,
  TicketPaymentIntentResponse,
  UserRole,
} from './types';
