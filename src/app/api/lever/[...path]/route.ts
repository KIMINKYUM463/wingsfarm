import type { NextRequest } from 'next/server';
import { handleLeverRequest } from '@/server/lever/router';

/**
 * 상세페이지 제작(레버페이지) 로컬 백엔드 진입점
 * `/api/lever/functions/v1/...`, `/api/lever/storage/...`, `/api/lever/realtime/...`
 */
/** AI 생성은 응답 뒤 after()로 이어서 돌기 때문에 Vercel 함수 시간을 넉넉히 준다 (Fluid compute 기준 최대 300초) */
export const maxDuration = 300;

const handle = async (req: NextRequest, ctx: RouteContext<'/api/lever/[...path]'>) =>
  handleLeverRequest(req, (await ctx.params).path);

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
