import { existsSync } from 'node:fs';
import * as nodeModule from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Node 24의 module.registerHooks — 설치된 @types/node에는 아직 없어 필요한 모양만 적는다
interface ResolveContext {
  parentURL?: string;
}
interface Resolved {
  url: string;
  shortCircuit?: boolean;
}
type ResolveHook = (specifier: string, context: ResolveContext, next: (specifier: string, context: ResolveContext) => Resolved) => Resolved;
const { registerHooks } = nodeModule as unknown as { registerHooks: (hooks: { resolve: ResolveHook }) => void };

/**
 * 서버 코드는 Next 규칙(@/ 별칭·확장자 없는 경로·server-only)으로 쓰여 있어 node --test가 바로 못 읽는다.
 * 테스트 파일 맨 위에서 이 파일을 import한 뒤, 대상 모듈은 `await import()`로 불러온다.
 */
const SRC = fileURLToPath(new URL('../../', import.meta.url));
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'server-only') return { url: 'data:text/javascript,', shortCircuit: true };
    const base = specifier.startsWith('@/')
      ? SRC + specifier.slice(2)
      : specifier.startsWith('.') && context.parentURL?.startsWith('file:')
        ? fileURLToPath(new URL(specifier, context.parentURL))
        : null;
    if (base && !/\.[cm]?[jt]sx?$|\.json$/.test(base)) {
      const found = [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find(existsSync);
      if (found) return { url: pathToFileURL(found).href, shortCircuit: true };
    }
    if (base && specifier.startsWith('@/')) return { url: pathToFileURL(base).href, shortCircuit: true };
    return nextResolve(specifier, context);
  },
});
