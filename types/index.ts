/**
 * 바이마 시스템 v3.1 — 공통 타입 정의
 * Supabase 스키마와 1:1 대응
 */

export type UserRole = 'operator' | 'owner';
export type Device = 'pc' | 'mobile' | 'tablet';

export interface User {
  id: string;
  auth_id: string | null;
  name: string;
  role: UserRole;
  avatar_emoji: string;
  is_active: boolean;
  push_endpoint: string | null;
  push_keys: { p256dh: string; auth: string } | null;
  created_at: string;
  updated_at: string;
}

export type ProductStatus =
  | 'sourcing'
  | 'pending_approval'
  | 'ready_to_list'
  | 'listed'
  | 'paused'
  | 'stopped';

export interface Product {
  id: string;
  name_kr: string;
  name_jp: string | null;
  brand: string | null;
  source_url: string | null;
  source_mall: string | null;
  cost_krw: number;
  ship_krw: number;
  list_price_jpy: number | null;
  margin_pct: number | null;
  status: ProductStatus;
  thumbnail_url: string | null;
  ai_score: number | null;
  created_at: string;
  updated_at: string;
}

export type ResourceType = 'product' | 'order' | 'cs_thread' | 'sourcing_card';

export interface WorkLock {
  id: string;
  resource_type: ResourceType;
  resource_id: string;
  user_id: string;
  current_step: number | null;
  step_data: Record<string, unknown>;
  acquired_at: string;
  expires_at: string;
}

export interface ActivityFeedItem {
  id: string;
  user_id: string | null;
  actor_label: string;
  action_type: string;
  target_type: string | null;
  target_id: string | null;
  target_label: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export type ApprovalRequestType =
  | 'price_below_margin'
  | 'price_high_unit'
  | 'new_category'
  | 'refund'
  | 'large_price_drop'
  | 'owner_to_operator';

export type ApprovalStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'modified'
  | 'expired';

export interface Approval {
  id: string;
  requested_by: string | null;
  request_type: ApprovalRequestType;
  target_type: string | null;
  target_id: string | null;
  target_label: string;
  details: Record<string, unknown>;
  proposed_value: Record<string, unknown> | null;
  rule_violated: string | null;
  note: string | null;
  status: ApprovalStatus;
  decided_by: string | null;
  decided_at: string | null;
  decided_value: Record<string, unknown> | null;
  decision_note: string | null;
  pushed_at: string | null;
  expires_at: string;
  created_at: string;
}

export interface UserSession {
  user_id: string;
  current_screen: string | null;
  current_resource_id: string | null;
  device: Device;
  last_seen: string;
}

/** UI에서 사용하는 확장 타입 — 조인 데이터 포함 */
export interface ApprovalWithUser extends Approval {
  requester?: Pick<User, 'name' | 'avatar_emoji' | 'role'>;
  decider?: Pick<User, 'name' | 'avatar_emoji' | 'role'>;
}

export interface PresenceUser extends UserSession {
  user: Pick<User, 'id' | 'name' | 'role' | 'avatar_emoji'>;
}
