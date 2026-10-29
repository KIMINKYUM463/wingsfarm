import { Suspense } from 'react';
import CreateDraftPage from '@/features/draft/components/CreateDraftPage';

export const metadata = { title: '상세페이지 만들기' };

export default function Page() {
  return (
    <Suspense>
      <CreateDraftPage />
    </Suspense>
  );
}
