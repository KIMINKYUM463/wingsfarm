import Input from '@/shared/ui/Input/Input';
import type { StepComponentProps } from '../types';

const Step1CompanyName = ({ form }: StepComponentProps) => {
  const { register } = form;

  return (
    <Input
      className="input-single w-full"
      placeholder="예: ○○농원 / ○○전자 / ○○코스메틱"
      {...register('companyName')}
    />
  );
};

export default Step1CompanyName;
