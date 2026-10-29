import { requireAuth } from '@/server/data/auth';
import { getApiKey } from '@/server/data/settings';
import CenterLayout from '@/app/(lever)/_components/CenterLayout';
import SettingsHeader from './_components/SettingsHeader';
import ApiKeyForm from './_components/ApiKeyForm';

export default async function ApiKeySettingsPage() {
  await requireAuth();
  const apiKey = await getApiKey();

  return (
    <>
      <SettingsHeader />
      <CenterLayout maxWClassName="max-w-lg">
        <ApiKeyForm initialData={apiKey} />
      </CenterLayout>
    </>
  );
}
