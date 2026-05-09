/**
 * Web Push 발송 헬퍼
 * VAPID 키 환경변수: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
 */

import webpush from 'web-push';

let configured = false;

function configure() {
  if (configured) return true;
  const pub = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:wlvus2531@gmail.com';
  if (!pub || !priv) {
    console.warn('[web-push] VAPID 키 미설정 (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)');
    return false;
  }
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: Record<string, unknown>;
  actions?: { action: string; title: string }[];
  requireInteraction?: boolean;
}

export interface PushSubscriptionTarget {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function sendPush(target: PushSubscriptionTarget, payload: PushPayload): Promise<{ ok: boolean; error?: string; statusCode?: number }> {
  if (!configure()) return { ok: false, error: 'VAPID 미설정' };
  try {
    await webpush.sendNotification(target, JSON.stringify(payload));
    return { ok: true };
  } catch (e: unknown) {
    const err = e as { statusCode?: number; message?: string };
    return { ok: false, error: err.message ?? String(e), statusCode: err.statusCode };
  }
}
