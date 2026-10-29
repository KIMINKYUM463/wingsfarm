import clsx from 'clsx';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/server/data/auth';
import { getApiKey } from '@/server/data/settings';
import { ROUTES } from '@/shared/constants/routes';

/**
 * 프로젝트 레이아웃 (인증 필수 + API 키 필수)
 *
 * - 비로그인 → /login 리다이렉트
 * - API 키 미등록 → /settings/api-key 리다이렉트
 */
export default async function ProjectsLayout({ children }: { children: React.ReactNode }) {
  await requireAuth();

  const apiKey = await getApiKey();
  if (!apiKey) redirect(ROUTES.SETTINGS_API_KEY);

  return (
    <div className={clsx('min-h-screen flex flex-col pt-(--header-h) bg-white')}>{children}</div>
  );
}
