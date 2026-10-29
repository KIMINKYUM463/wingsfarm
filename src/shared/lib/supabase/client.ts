import { getLocalSupabaseClient } from './local';

/** 브라우저용 클라이언트 (로컬 대체 — `./local.ts` 참고) */
export const getBrowserSupabaseClient = getLocalSupabaseClient;
