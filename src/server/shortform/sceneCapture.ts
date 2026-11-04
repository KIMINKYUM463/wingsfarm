/**
 * 레퍼런스 장면 전환 캡처 — Python scene_capture.py 를 호출한다.
 * (yt-dlp + ffmpeg scene detect → scene_NN.jpg + 실측 초)
 */
import 'server-only';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

export type CapturedScene = {
  index: number;
  t0: number;
  t1: number;
  seconds: number;
  file: string;
  keyframe: string;
};

function pythonBin() {
  const local = process.env.LOCALAPPDATA
    ? path.join(process.env.LOCALAPPDATA, 'Programs', 'Python', 'Python312', 'python.exe')
    : '';
  if (local && existsSync(local)) return local;
  return process.platform === 'win32' ? 'python' : 'python3';
}

function studioRoot() {
  return path.join(process.cwd(), 'shortform', 'studio');
}

export function loadCapturedScenes(vid: string): CapturedScene[] | null {
  const file = path.join(studioRoot(), 'data', 'frames', vid, 'scenes.json');
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as CapturedScene[];
  } catch {
    return null;
  }
}

export function keyframeAbsPath(keyframe: string): string | null {
  if (!keyframe) return null;
  const abs = path.join(studioRoot(), 'data', 'frames', ...keyframe.split('/'));
  return existsSync(abs) ? abs : null;
}

/** scene_capture.py 실행. 이미 캐시가 있으면 그걸 읽는다. */
export function captureScenes(vid: string, force = false): Promise<CapturedScene[]> {
  const cached = force ? null : loadCapturedScenes(vid);
  if (cached?.length) return Promise.resolve(cached);

  const script = path.join(studioRoot(), 'scene_capture.py');
  if (!existsSync(script)) {
    return Promise.reject(new Error('scene_capture.py 를 찾지 못했어요'));
  }

  return new Promise((resolve, reject) => {
    const args = [script, vid];
    if (force) args.push('--force');
    const child = spawn(pythonBin(), args, {
      cwd: path.join(process.cwd(), 'shortform'),
      windowsHide: true,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUNBUFFERED: '1' },
    });
    let out = '';
    let err = '';
    child.stdout.on('data', (b: Buffer) => {
      out += b.toString('utf8');
    });
    child.stderr.on('data', (b: Buffer) => {
      err += b.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(err.trim().slice(-400) || `장면 캡처 실패 (code ${code})`));
        return;
      }
      try {
        const data = JSON.parse(out.trim()) as CapturedScene[];
        resolve(data);
      } catch {
        const again = loadCapturedScenes(vid);
        if (again?.length) resolve(again);
        else reject(new Error('장면 캡처 결과를 읽지 못했어요'));
      }
    });
  });
}

/** 분석 JSON scenes 에 실측 초·키프레임을 심는다. */
export function mergeCaptureIntoAnalysis(
  analysis: Record<string, unknown>,
  captured: CapturedScene[],
): Record<string, unknown> {
  const old = Array.isArray(analysis.scenes) ? (analysis.scenes as Array<Record<string, unknown>>) : [];
  const n = captured.length;
  const scenes = captured.map((sc, i) => {
    let src: Record<string, unknown> = {};
    if (old.length === n) src = old[i] ?? {};
    else if (old.length && n > 1) src = old[Math.min(old.length - 1, Math.round((i / (n - 1)) * (old.length - 1)))] ?? {};
    else if (old[0]) src = old[0];
    return {
      ...src,
      seconds: sc.seconds,
      t0: sc.t0,
      t1: sc.t1,
      keyframe: sc.keyframe,
      file: sc.file,
      measured: true,
      role: String(src.role || (i === 0 ? 'HOOK' : i === n - 1 ? 'CTA' : 'STEP')),
      label: String(src.label || ''),
      shot: String(src.shot || 'photo'),
      purpose: String(src.purpose || src.note || ''),
      text: String(src.text || ''),
      note: String(src.note || ''),
    };
  });
  return {
    ...analysis,
    scenes,
    capture: {
      mode: 'scene_detect',
      count: n,
      total: Math.round(captured.reduce((s, c) => s + c.seconds, 0) * 100) / 100,
    },
    frames: captured.map((s) => `${s.t0.toFixed(1)}–${s.t1.toFixed(1)}s`),
  };
}
