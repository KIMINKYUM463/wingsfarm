import { ERROR_MESSAGES, DEFAULT_ERROR_MESSAGE } from '@/shared/constants/messages';
import { CustomError } from '@/shared/lib/CustomError';
import type { ResponseType } from '@/shared/types/api';
import type { ErrorStatusCode } from '@/shared/types/error';
import type { CustomErrorType, RequestConfig } from './../types/api';
import { getBrowserSupabaseClient } from '@/shared/lib/supabase/client';

type FetchOptionsConfig = Omit<RequestConfig, 'endpoint' | 'signal'>;

export const createCustomError = (
  status: ErrorStatusCode,
  rawMessage?: string,
): CustomErrorType => {
  return {
    status,
    message: ERROR_MESSAGES[status] || DEFAULT_ERROR_MESSAGE,
    rawMessage,
  };
};

export const buildUrl = (
  baseURL: string | undefined,
  endpoint: string,
  queryParams?: Record<string, string | number | boolean | undefined>,
) => {
  let url = `${baseURL}${endpoint}`;
  if (queryParams && Object.keys(queryParams).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined) searchParams.append(key, String(value));
    });
    url += `?${searchParams.toString()}`;
  }
  return url;
};

/**
 * 요청 바디 생성 (File/Blob은 그대로, 일반 데이터는 JSON.stringify)
 */
const buildRequestBody = (
  method: string,
  data: unknown,
): { body?: string | File | Blob | FormData } => {
  // GET 요청이거나 데이터가 없으면 빈 객체
  if (method === 'GET' || data === undefined) {
    return {};
  }

  // File/Blob/FormData는 그대로, 일반 데이터는 JSON.stringify
  const isRawBody = data instanceof File || data instanceof Blob || data instanceof FormData;
  return { body: isRawBody ? data : JSON.stringify(data) };
};

/**
 * fetch API 요청에 필요한 옵션을 구성합니다.
 *
 * ## 주요 기능
 * - withAuth: true 설정 시 환경에 따라 자동으로 액세스 토큰 가져오기
 *   - 서버 환경: createServerSupabaseClient() 사용 (동적 import)
 *   - 브라우저 환경: getBrowserSupabaseClient() 사용
 * - Content-Type 자동 설정 (GET 요청 제외)
 * - 커스텀 헤더 병합
 *
 * @param method - HTTP 메서드 (GET, POST, PUT, PATCH, DELETE)
 * @param data - 요청 바디 데이터
 * @param options - 추가 옵션 (withAuth, headers 등)
 * @returns fetch API에 전달할 RequestInit 객체
 */
/**
 * 브라우저 환경에서 헤더 가져오기
 */
const getBrowserAuthHeaders = async (): Promise<Record<string, string>> => {
  const supabase = getBrowserSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const buildFetchOptions = async ({
  method,
  data,
  options = {},
}: FetchOptionsConfig): Promise<RequestInit> => {
  const { withAuth, withApikey, ...rest } = options;

  // withAuth가 true일 경우 환경에 따라 액세스 토큰 가져오기
  let authHeaders: Record<string, string> = {};
  const isServer = typeof window === 'undefined';

  if (withAuth && isServer) {
    const { getServerAuthHeaders } = await import('@/shared/lib/server-auth');
    authHeaders = await getServerAuthHeaders();
  }

  // 브라우저 환경: 직접 세션 가져오기
  if (withAuth && !isServer) {
    authHeaders = await getBrowserAuthHeaders();
  }

  // File/Blob/FormData는 Content-Type 자동 설정
  const isRawBody = data instanceof File || data instanceof Blob || data instanceof FormData;
  const needsJsonContentType = method !== 'GET' && !isRawBody;

  // File일 때 MIME 타입 자동 설정 (예: image/png, image/jpeg)
  const fileContentType = data instanceof File ? { 'Content-Type': data.type } : {};

  const mergedHeaders: HeadersInit = {
    ...(needsJsonContentType && { 'Content-Type': 'application/json' }),
    ...fileContentType, // File일 때 자동 설정
    ...authHeaders, // Authorization: Bearer <token>
    ...(options.headers ?? {}), // 커스텀 헤더로 오버라이드 가능
  };

  // Body 처리
  const body = buildRequestBody(method, data);

  return {
    method,
    headers: mergedHeaders,
    ...body,
    ...rest,
  };
};

/**
 * Response 타입별 파싱 함수 매핑
 */
const RESPONSE_PARSERS: Record<ResponseType, (res: Response) => Promise<unknown>> = {
  blob: (res) => res.blob(),
  text: (res) => res.text(),
  json: (res) => res.json(),
};

export const parseResponse = async (res: Response, responseType: ResponseType = 'json') => {
  // 204 No Content: body가 없으므로 파싱 스킵
  if (res.status === 204) {
    return null;
  }

  try {
    const parser = RESPONSE_PARSERS[responseType];
    return await parser(res);
  } catch (err) {
    throw new CustomError(res.status, getUnknownErrorMessage(err));
  }
};

export const getUnknownErrorMessage = (err: unknown) => (err as Error)?.message ?? '알 수 없음';
