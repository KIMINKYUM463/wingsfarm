'use client';

import { useRouter } from 'next/navigation';
import Input from '@/shared/ui/Input/Input';
import Button from '@/shared/ui/Button/Button';
import { useApiKeySettings } from '@/features/auth/hooks/useApiKeySettings';
import { ROUTES } from '@/shared/constants/routes';

interface ApiKeyFormProps {
  initialData: { id: string; maskedKey: string; isActive: boolean } | null;
}

const BTN_SECONDARY =
  'h-(--btn-h) shrink-0 rounded-lg bg-gray-50 px-4 hover:bg-[#E4E4E7] active:bg-[#D4D4D8] disabled:bg-[#D4D4D8] disabled:[&>span]:text-white';

const ApiKeyForm = ({ initialData }: ApiKeyFormProps) => {
  const router = useRouter();
  const {
    register,
    isPending,
    isLoading,
    onSubmit,
    errors,
    savedKey,
    justSaved,
    isSaveError,
    isInputMode,
    isEditMode,
    onEdit,
    onCancel,
    onDelete,
    isDeleting,
  } = useApiKeySettings(initialData);

  const errorMessage = isInputMode && (isSaveError ? '유효하지 않은 API 키입니다.' : errors.apiKey?.message);
  const successMessage = !isInputMode && justSaved;

  return (
    <div className="flex flex-col gap-6">
      {/* 제목 + 설명 */}
      <div className="flex flex-col gap-3">
        <h2 className="h2-bold">Gemini API 설정</h2>
        <p className="title-1 text-gray-500">
          Gemini API 키를 등록하면 서비스를 이용할 수 있습니다. API 키는 Google AI Studio에서 무료로
          발급받을 수 있습니다.
        </p>
      </div>

      {/* 입력 필드 + 버튼 */}
      <form onSubmit={isInputMode ? onSubmit : undefined} className="flex items-start gap-3">
        <div className="w-full">
          <Input
            key={isInputMode ? 'edit' : 'view'}
            type="password"
            {...(isInputMode
              ? register('apiKey')
              : { value: savedKey?.maskedKey ?? '' })}
            readOnly={!isInputMode || isLoading || isPending}
            placeholder="Gemini API 입력"
            className="input-single w-full"
            autoFocus={isInputMode}
          />
          {errorMessage && <p className="description mt-1.5 text-[#F2860A]">{errorMessage}</p>}
          {successMessage && (
            <p className="description mt-1.5 text-(--color-success)">
              성공적으로 저장되었습니다.
            </p>
          )}
        </div>

        {isInputMode ? (
          <div className="flex shrink-0 gap-2">
            {isEditMode && (
              <Button className={BTN_SECONDARY} onClick={onCancel}>
                <span className="p text-gray-600">취소</span>
              </Button>
            )}
            <Button
              type="submit"
              className={BTN_SECONDARY}
              isLoading={isPending}
              disabled={isLoading}
            >
              <span className="p text-(--color-success)">저장</span>
            </Button>
          </div>
        ) : (
          <div className="flex shrink-0 gap-2">
            <Button className={BTN_SECONDARY} onClick={onEdit}>
              <span className="p text-gray-600">수정</span>
            </Button>
            <Button className={BTN_SECONDARY} onClick={() => onDelete()} isLoading={isDeleting} disabled={isDeleting}>
              <span className="p text-[#E65050]">삭제</span>
            </Button>
          </div>
        )}
      </form>

      {/* 프로젝트로 이동 */}
      <div className="flex justify-end">
        <Button
          className="btn-primary"
          onClick={() => router.push(ROUTES.PROJECTS)}
        >
          <span className="p">프로젝트로 이동</span>
        </Button>
      </div>
    </div>
  );
};

export default ApiKeyForm;
