import type { NextRequest } from 'next/server';
import { handleLeverRequest } from '@/server/lever/router';

/**
 * 상세페이지 제작(레버페이지) 로컬 백엔드 진입점
 * `/api/lever/functions/v1/...`, `/api/lever/storage/...`, `/api/lever/realtime/...`
 */
const handle = async (req: NextRequest, ctx: RouteContext<'/api/lever/[...path]'>) =>
  handleLeverRequest(req, (await ctx.params).path);

export { handle as GET, handle as POST, handle as PUT, handle as PATCH, handle as DELETE };
