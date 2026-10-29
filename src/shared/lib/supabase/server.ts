import { getLocalSupabaseClient } from './local';

/** 서버용 클라이언트 (로컬 대체 — `./local.ts` 참고) */
export async function createServerSupabaseClient() {
  return getLocalSupabaseClient();
}
