import 'server-only';
import { randomUUID } from 'node:crypto';

/** 레버페이지 API 공통 응답 형식 (ExternalApiResponse) */
const envelope = <T,>(isSuccess: boolean, code: string, message: string, data: T) => ({
  isSuccess,
  code,
  message,
  errors: null,
  requestId: randomUUID(),
  data,
});

/** 서버 컴포넌트에서 API와 같은 응답 모양이 필요할 때 */
export const successEnvelope = <T,>(data: T, message = '요청이 성공했습니다.') =>
  envelope(true, 'COMMON_200', message, data);

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, message: string, code = `COMMON_${status}`) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message: string) => new ApiError(400, message);
export const notFound = (message = '대상을 찾을 수 없습니다.') => new ApiError(404, message);

export const ok = (data: unknown, status = 200, message?: string) =>
  Response.json(successEnvelope(data, message), { status });

export const noContent = () => new Response(null, { status: 204 });

export const fail = (status: number, message: string, code = `COMMON_${status}`) =>
  Response.json(envelope(false, code, message, null), { status });

export interface RouteContext {
  req: Request;
  params: Record<string, string>;
  query: URLSearchParams;
  /** JSON 본문 (없거나 깨졌으면 빈 객체) */
  body: <T = Record<string, unknown>>() => Promise<T>;
}

export type RouteHandler = (ctx: RouteContext) => Promise<unknown>;

export const createContext = (
  req: Request,
  params: Record<string, string>,
  query: URLSearchParams,
): RouteContext => {
  let cached: Promise<unknown> | null = null;
  return {
    req,
    params,
    query,
    body: <T,>() => {
      cached ??= req.text().then((text) => (text ? JSON.parse(text) : {})).catch(() => ({}));
      return cached as Promise<T>;
    },
  };
};

/** 핸들러가 Response를 직접 반환하지 않으면 성공 envelope로 감싼다 */
export const toResponse = (result: unknown) => (result instanceof Response ? result : ok(result));
