import { CustomError } from '@/shared/lib/CustomError';
import { buildFetchOptions, buildUrl, getUnknownErrorMessage, parseResponse } from './utils';
import type { RequestConfig } from '@/shared/types/api';

const DEFAULT_TIMEOUT = 180000; // 3분

async function request<T>({ method, endpoint, data, options = {} }: RequestConfig): Promise<T> {
  const {
    baseURL = '/api/lever',
    timeout = DEFAULT_TIMEOUT,
    queryParams,
    responseType,
    signal: externalSignal,
    cache,
    next,
  } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort(new Error(`요청 시간 초과 (${timeout}ms)`));
  }, timeout);
  const signal = externalSignal ?? controller.signal;

  const fetchOptions = await buildFetchOptions({ method, data, options });

  try {
    const url = buildUrl(baseURL, endpoint, queryParams);

    const res = await fetch(url, {
      ...fetchOptions,
      signal,
      ...(cache && { cache }),
      ...(next && { next }),
    });

    // 개발 환경에서 응답 정보 로그 출력
    if (process.env.NODE_ENV === 'development') {
      const isServer = typeof window === 'undefined';
      console.log(
        `✅ [request] ${isServer ? '[서버]' : '[클라이언트]'} ${method} ${url} - ${res.status} ${res.statusText}`,
      );
    }
    if (!res.ok) {
      const errorBody = await res.json().catch(() => ({}));
      console.error(errorBody);
      const rawMessage = errorBody.message;
      throw new CustomError(res.status, rawMessage);
    }

    return (await parseResponse(res, responseType)) as T;
  } catch (err: unknown) {
    if (err instanceof CustomError) throw err;

    // AbortError 체크 (timeout)
    if (err instanceof Error && err.name === 'AbortError') {
      throw new CustomError(408, `요청 시간 초과 (${timeout}ms)`);
    }

    const rawMessage = getUnknownErrorMessage(err);

    throw new CustomError(500, rawMessage);
  } finally {
    clearTimeout(timeoutId);
  }
}

export default request;
