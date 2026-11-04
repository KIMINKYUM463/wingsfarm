/**
 * 숏폼 디렉터리 경로만 — media 라우트가 engine(spawn)을 끌어오지 않게 분리.
 */
import path from 'node:path';

const ROOT = path.join(process.cwd(), 'shortform');

export function shortformRoots() {
  return {
    root: ROOT,
    products: path.join(ROOT, 'products'),
    output: path.join(ROOT, 'output'),
    frames: path.join(ROOT, 'studio', 'data', 'frames'),
    analysis: path.join(ROOT, 'studio', 'data', 'analysis'),
    static: path.join(ROOT, 'studio', 'static'),
  };
}
