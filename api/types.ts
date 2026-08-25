export interface ApiValidationErrors {
  [field: string]: string[] | string | undefined;
}

export interface ApiErrorBody {
  /** Human-readable error message. */
  error: string;
  /** Present when error is "validation failed" (422). */
  errors?: ApiValidationErrors;
}

// =============================================================================
// POST /auth/password, DELETE /auth/logout
// =============================================================================

export type UserRole = 'admin' | 'volunteer';

export interface AppUser {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: UserRole;
  /** Always a usable image URL — the backend falls back to a default when none is uploaded. */
  avatar_url: string;
}

export interface PasswordSessionResponse {
  token: string;
  user: AppUser;
}

// =============================================================================
// GET /events — same shape the property-kiosk app's mobile API returns.
// =============================================================================

export interface EventPricingInfo {
  display_text: string;
  has_free_tiers: boolean;
  lowest_price: string | null;
}

export interface EventTicketTier {
  id: string;
  name: string;
  description: string | null;
  type: string;
  price: string | null;
  quantity: number | null;
  tickets_sold: number;
  /** Remaining quantity (quantity - tickets_sold); null when quantity is unlimited/unset. */
  available: number | null;
  requires_registration: boolean;
  start_date: string | null;
  end_date: string | null;
}

export interface EventCoverImage {
  id: string;
  optimized_path: string | null;
  thumbnail_path: string | null;
  blur_hash: string | null;
  width: number | null;
  height: number | null;
  alt_text: string | null;
}

export interface Event {
  id: string | null;
  reference_id: string | null;
  state: string | null;
  title: string;
  description: string | null;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  location_name: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  age_restriction: string | null;
  max_attendees: number | null;
  tickets_tbd: boolean | null;
  partiful_link: string | null;
  selling_fast: boolean | null;
  recent_tickets_count: number | null;
  ticket_count: number | null;
  pricing_info: EventPricingInfo | null;
  ticket_tiers: readonly EventTicketTier[] | null;
  cover_image: EventCoverImage | null;
}

export interface EventsMeta {
  page: number;
  page_size: number;
  total_count: number;
  total_pages: number;
  has_next_page: boolean;
  has_prev_page: boolean;
}

export interface EventsResponse {
  data: readonly Event[];
  meta: EventsMeta;
}

export interface EventsListParams {
  page?: number;
  page_size?: number;
}

// =============================================================================
// GET /memberships/plans, POST /memberships/subscribe
// =============================================================================

export interface MembershipPlan {
  id: string;
  name: string;
  interval: string;
  amount: number;
  currency: string;
  description: string;
}

export interface MembershipPlansResponse {
  data: readonly MembershipPlan[];
}

export interface SubscribeRequest {
  member_id: string;
  plan: string;
  payment_method_id: string;
}

export interface SubscribeResponse {
  id: string;
  status: string;
}

export interface MembershipSetupIntentRequest {
  member_id: string;
}

export interface MembershipSetupIntentResponse {
  client_secret: string;
}

// =============================================================================
// GET /memberships/status
// =============================================================================

export type MembershipStatusResponse =
  | { has_active_membership: false }
  | {
      has_active_membership: true;
      plan_type: string | null;
      plan_name: string;
      renewal_date: string | null;
      cancel_at_period_end: boolean;
    };

// =============================================================================
// GET /members/search
// =============================================================================

export interface Member {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  has_active_membership: boolean;
  /** Always a usable image URL — the backend falls back to a default when none is uploaded. */
  avatar_url: string;
}

export interface MembersSearchResponse {
  data: readonly Member[];
}

// =============================================================================
// POST /payments/connection_token — Stripe Terminal SDK initialization
// =============================================================================

export interface ConnectionTokenResponse {
  secret: string;
  location_id: string;
}

// =============================================================================
// POST /events/:event_id/tickets/payment_intent
// =============================================================================

export interface TicketPaymentIntentRequest {
  member_id: string;
  /** Map of ticket_tier_id -> quantity, e.g. { [tierId]: 2 } — one order can span multiple tiers. */
  tiers: Record<string, number>;
}

export interface TicketPaymentIntentResponse {
  ticket_order_id: string;
  ticket_order_reference: string;
  payment_intent_id: string;
  client_secret: string;
  amount: number;
  currency: string;
}
