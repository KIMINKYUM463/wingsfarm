import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { NextResponse } from 'next/server';
import { shortformRoots } from '@/server/shortform/engine';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PHOTO = new Set(['.jpg', '.jpeg', '.png', '.webp', '.mp4']);

function resolveSafe(base: string, rest: string[]) {
  const target = path.resolve(base, ...rest.map((p) => decodeURIComponent(p)));
  if (!target.startsWith(path.resolve(base) + path.sep) && target !== path.resolve(base)) return null;
  return target;
}

export async function GET(req: Request, ctx: RouteContext<'/api/shortform/media/[...path]'>) {
  const parts = (await ctx.params).path;
  const kind = parts[0];
  const rest = parts.slice(1);
  const roots = shortformRoots();
  const base =
    kind === 'output' ? roots.output : kind === 'products' ? roots.products : kind === 'frames' ? roots.frames : null;
  if (!base || !rest.length) return NextResponse.json({ error: 'not found' }, { status: 404 });

  const file = resolveSafe(base, rest);
  if (!file || !existsSync(file) || !statSync(file).isFile()) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }
  if (kind === 'products' && !PHOTO.has(path.extname(file).toLowerCase())) {
    return NextResponse.json({ error: 'not found' }, { status: 404 });
  }

  const stat = statSync(file);
  const range = req.headers.get('range');
  const type =
    path.extname(file).toLowerCase() === '.mp4'
      ? 'video/mp4'
      : path.extname(file).toLowerCase() === '.jpg' || path.extname(file).toLowerCase() === '.jpeg'
        ? 'image/jpeg'
        : path.extname(file).toLowerCase() === '.png'
          ? 'image/png'
          : path.extname(file).toLowerCase() === '.webp'
            ? 'image/webp'
            : 'application/octet-stream';

  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (m) {
      const start = m[1] ? Number(m[1]) : Math.max(0, stat.size - Number(m[2] || 0));
      const end = m[1] ? (m[2] ? Number(m[2]) : stat.size - 1) : stat.size - 1;
      const clippedEnd = Math.min(end, stat.size - 1);
      const stream = createReadStream(file, { start, end: clippedEnd });
      return new NextResponse(Readable.toWeb(stream) as unknown as BodyInit, {
        status: 206,
        headers: {
          'Content-Type': type,
          'Content-Length': String(clippedEnd - start + 1),
          'Content-Range': `bytes ${start}-${clippedEnd}/${stat.size}`,
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'no-cache',
        },
      });
    }
  }

  const stream = createReadStream(file);
  return new NextResponse(Readable.toWeb(stream) as unknown as BodyInit, {
    headers: {
      'Content-Type': type,
      'Content-Length': String(stat.size),
      'Accept-Ranges': 'bytes',
      'Cache-Control': kind === 'frames' ? 'public, max-age=86400' : 'no-cache',
    },
  });
}
