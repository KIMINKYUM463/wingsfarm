import { NextResponse } from 'next/server';
import { shortformCall } from '@/server/shortform/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const GET_MAP: Record<string, string> = {
  bootstrap: 'bootstrap',
  products: 'products',
  jobs: 'jobs',
};

async function run(method: string, params: Record<string, unknown> = {}) {
  const res = await shortformCall(method, params);
  if (!res.ok) {
    return NextResponse.json({ error: res.error }, { status: res.status || 400 });
  }
  return NextResponse.json(res.result);
}

export async function GET(_req: Request, ctx: RouteContext<'/api/shortform/[...path]'>) {
  const parts = (await ctx.params).path;
  const head = parts[0] ?? '';
  try {
    if (head === 'analysis' && parts[1]) {
      return run('analysis', { id: decodeURIComponent(parts[1]) });
    }
    if (head === 'jobs' && parts[1]) {
      return run('job', { id: decodeURIComponent(parts[1]) });
    }
    if (GET_MAP[head] && parts.length === 1) {
      return run(GET_MAP[head]);
    }
    return NextResponse.json({ error: '없는 API예요' }, { status: 404 });
  } catch (err) {
    console.error('[shortform] GET', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '숏폼 엔진 오류' },
      { status: 500 },
    );
  }
}

const POST_MAP: Record<string, string> = {
  product: 'product',
  draft: 'draft',
  render: 'render',
  analyze: 'analyze',
  chat: 'chat',
  post: 'post',
  hooks: 'hooks',
  plan: 'plan',
  lint: 'lint',
  reshoot: 'reshoot',
};

export async function POST(req: Request, ctx: RouteContext<'/api/shortform/[...path]'>) {
  const parts = (await ctx.params).path;
  const head = parts[0] ?? '';
  const sub = parts[1];
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    if (head === 'clone' && sub === 'draft') return run('clone_draft', body);
    if (head === 'plan' && sub === 'run') return run('plan_run', body);
    if (head === 'jobs' && sub === 'hide') return run('jobs_hide', body);
    if (POST_MAP[head] && !sub) return run(POST_MAP[head], body);
    return NextResponse.json({ error: '없는 API예요' }, { status: 404 });
  } catch (err) {
    console.error('[shortform] POST', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '숏폼 엔진 오류' },
      { status: 500 },
    );
  }
}
