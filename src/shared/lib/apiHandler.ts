/**
 * src/lib/apiHandler.ts
 * API 요청 Promise를 받아 성공/실패를 처리하고 CustomError를 던지는 범용 핸들러
 */
import { CustomError } from '@/shared/lib/CustomError';
import type { AuthError, PostgrestError } from '@supabase/supabase-js';

type SupabaseResponse<T> = {
  data?: T | null;
  error: AuthError | PostgrestError | null;
};

/**
 * API 요청 Promise를 받아 성공 시 데이터를 반환하고, 실패 시 CustomError를 던지는 범용 핸들러
 */
export const handleApiResponse = async <T>(promise: Promise<SupabaseResponse<T>>): Promise<T> => {
  const { data, error } = await promise;

  if (error) {
    console.error('API Error:', error.message);
    // 에러 객체에 status가 있으면 사용하고, 없으면 500으로 처리
    const status = 'status' in error && typeof error.status === 'number' ? error.status : 500;
    throw new CustomError(status, error.message);
  }

  // data가 없는 성공 케이스(signOut 등)를 위해 data as T로 처리합니다.
  return data as T;
};
