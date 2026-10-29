import CreationMethodController from '@/features/detail-page/components/CreationMethodController';
import type { Step2Props } from '../types';

const Step2GenerationMethod = ({ form, onMethodChange }: Step2Props) => {
  const { control, setValue } = form;

  return (
    <div data-field="generationMethod">
      <CreationMethodController
        control={control}
        setValue={setValue}
        onMethodChange={onMethodChange}
      />
    </div>
  );
};

export default Step2GenerationMethod;

