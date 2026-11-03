import { requireAuth } from '@/server/data/auth';
import { getApiKey, getCopyModelSettings } from '@/server/data/settings';
import CenterLayout from '@/app/(lever)/_components/CenterLayout';
import SettingsHeader from './_components/SettingsHeader';
import ApiKeyForm from './_components/ApiKeyForm';
import CopyModelPicker from './_components/CopyModelPicker';

export default async function ApiKeySettingsPage() {
  await requireAuth();
  const [apiKey, copyModel] = await Promise.all([getApiKey(), getCopyModelSettings()]);

  return (
    <>
      <SettingsHeader />
      <CenterLayout maxWClassName="max-w-lg">
        <div className="flex flex-col gap-12">
          <ApiKeyForm initialData={apiKey} />
          <CopyModelPicker initialData={copyModel} />
        </div>
      </CenterLayout>
    </>
  );
}
