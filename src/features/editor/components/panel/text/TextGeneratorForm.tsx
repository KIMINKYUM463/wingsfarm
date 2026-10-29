'use client';

import IconButton from '@/shared/ui/Button/IconButton';
import Input from '@/shared/ui/Input/Input';
import { useGenerateIndividualAIText } from '@/features/editor/hooks/useGenerateIndividualAIText';
import type { KonvaFrameElement } from '@/shared/types/konva';

interface TextGeneratorFormProps {
  elementId: string;
  frameData: KonvaFrameElement;
}

const TextGeneratorForm = ({ elementId, frameData }: TextGeneratorFormProps) => {
  const { register, isPending, onSubmit, isValid } = useGenerateIndividualAIText(
    elementId,
    frameData,
  );
  return (
    <form
      onSubmit={onSubmit}
      className="py-2 shadow-(--shadow) px-3 flex gap-2 w-131 bg-white rounded-lg relative"
    >
      <Input
        {...register('prompt')}
        placeholder="AI에게 요청 해보세요."
        className="form-single flex-1 border-0"
        style={{ outline: 'none' }}
        disabled={isPending}
      />
      {/* <Button type="button" className="btn-example">
        <span className="p">예시생성</span>
      </Button> */}
      <IconButton
        type="submit"
        className="btn-rounded-full bg-gray-900 hover:bg-[#3B3C3F] active:bg-[#63656B] text-white"
        icon="arrow_upward"
        disabled={!isValid}
        isLoading={isPending}
      />
    </form>
  );
};

export default TextGeneratorForm;
