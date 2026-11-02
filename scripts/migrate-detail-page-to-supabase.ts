/**
 * 내 PC의 상세페이지 데이터(.data/detail-page)를 Supabase Storage 버킷으로 복사한다.
 * 사용법: .env.local에 SUPABASE_URL·SUPABASE_SERVICE_ROLE_KEY를 넣은 뒤 `npm run migrate:supabase`
 *
 * - 같은 경로의 파일은 덮어쓴다 (여러 번 실행해도 안전).
 * - settings.json(업로드 서명 비밀값·화면에서 등록한 Gemini 키)은 옮기지 않는다 → 배포 사이트는 GEMINI_API_KEY 환경변수를 쓴다.
 */
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { createSupabaseStorage, supabaseConfig } from '../src/server/lever/supabaseStorage.ts';

const ROOT = path.resolve(process.env.LEVER_DATA_DIR || path.join(process.cwd(), '.data', 'detail-page'));
const SKIP = new Set(['settings.json']);
const CONCURRENCY = 6;

const config = supabaseConfig();
if (!config) {
  console.error('SUPABASE_URL과 SUPABASE_SERVICE_ROLE_KEY를 .env.local에 넣어 주세요.');
  process.exit(1);
}
const storage = createSupabaseStorage(config);

const entries = await readdir(ROOT, { recursive: true, withFileTypes: true });
const files = entries
  .filter((e) => e.isFile() && !e.name.endsWith('.tmp'))
  .map((e) => path.relative(ROOT, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
  .filter((rel) => !SKIP.has(rel));

console.log(`${files.length}개 파일을 버킷 "${config.bucket}"으로 옮깁니다.`);
let done = 0;
const failed: string[] = [];

async function worker() {
  for (let rel = files.shift(); rel; rel = files.shift()) {
    try {
      await storage.write(rel, await readFile(path.join(ROOT, rel)));
    } catch (err) {
      failed.push(`${rel}: ${(err as Error).message}`);
    }
    if (++done % 50 === 0) console.log(`  ${done}개 완료`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log(`끝: ${done - failed.length}개 성공, ${failed.length}개 실패`);
failed.forEach((line) => console.log(`  실패 ${line}`));
process.exitCode = failed.length ? 1 : 0;
