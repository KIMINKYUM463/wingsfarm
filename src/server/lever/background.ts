import 'server-only';
import { after } from 'next/server';

/**
 * 응답을 먼저 돌려주고 이어서 돌릴 작업 (AI 생성 등).
 * Vercel은 응답을 보내면 함수를 멈출 수 있으므로 after()로 작업이 끝날 때까지 살려 둔다.
 * 요청 밖(다른 백그라운드 작업 안 등)이라 after를 못 쓰면 그냥 바로 실행한다.
 */
export function runInBackground(label: string, task: () => Promise<unknown>) {
  const run = () => task().catch((err) => console.error(`[lever] ${label} 실패`, err));
  try {
    after(run);
  } catch {
    void run();
  }
}
