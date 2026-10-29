import type { SupabaseClient, User } from '@supabase/supabase-js';

/**
 * Supabase 대체 (윙스팜AI 로컬 버전)
 *
 * 레버페이지 원본 코드는 Supabase 로그인·Realtime을 쓰지만, 윙스팜AI는 자체 비밀번호 잠금을 쓰는
 * 1인용 도구라 로그인이 없다. 원본 코드를 그대로 쓰기 위해 같은 모양의 가짜 클라이언트를 제공한다.
 * - auth: 항상 로컬 사용자 1명으로 로그인된 상태
 * - channel(): Realtime 대신 `/api/lever/realtime/{채널}` 을 폴링해 같은 형식(payload.record)으로 전달
 */
export const LOCAL_USER = {
  id: 'local-user',
  aud: 'authenticated',
  role: 'authenticated',
  email: 'owner@wingsfarm.local',
  app_metadata: {},
  user_metadata: { name: '윙스팜', full_name: '윙스팜' },
  created_at: '2026-01-01T00:00:00.000Z',
} as User;

const session = { access_token: 'local', token_type: 'bearer', user: LOCAL_USER };
const POLL_INTERVAL_MS = 1500;

type BroadcastHandler = (message: { payload: { record: unknown } }) => void;
type SubscribeCallback = (status: 'SUBSCRIBED' | 'CLOSED' | 'CHANNEL_ERROR', err?: Error) => void;

class PollingChannel {
  private handlers: BroadcastHandler[] = [];
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastSnapshot = '';
  private active = false;

  constructor(private name: string) {}

  on(_type: string, _filter: unknown, handler: BroadcastHandler) {
    this.handlers.push(handler);
    return this;
  }

  subscribe(callback?: SubscribeCallback) {
    this.active = true;
    queueMicrotask(() => {
      if (!this.active) return;
      callback?.('SUBSCRIBED');
      void this.poll();
    });
    return this;
  }

  private async poll() {
    if (!this.active) return;
    try {
      const res = await fetch(`/api/lever/realtime/${encodeURIComponent(this.name)}`, { cache: 'no-store' });
      const record = res.ok ? ((await res.json()) as { data?: { record?: unknown } }).data?.record : null;
      const snapshot = record ? JSON.stringify(record) : '';
      if (this.active && record && snapshot !== this.lastSnapshot) {
        this.lastSnapshot = snapshot;
        this.handlers.forEach((handler) => handler({ payload: { record } }));
      }
    } catch {
      // 일시적인 네트워크 오류는 다음 폴링에서 다시 시도
    }
    if (this.active) this.timer = setTimeout(() => void this.poll(), POLL_INTERVAL_MS);
  }

  async unsubscribe() {
    this.active = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    return 'ok' as const;
  }
}

const localClient = {
  auth: {
    getSession: async () => ({ data: { session }, error: null }),
    getUser: async () => ({ data: { user: LOCAL_USER }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    signInWithOAuth: async () => ({ data: { provider: 'local', url: null }, error: null }),
    signOut: async () => ({ error: null }),
  },
  realtime: { setAuth: async () => {} },
  channel: (name: string) => new PollingChannel(name),
  removeChannel: async (channel: PollingChannel) => channel.unsubscribe(),
};

export const getLocalSupabaseClient = () => localClient as unknown as SupabaseClient;
