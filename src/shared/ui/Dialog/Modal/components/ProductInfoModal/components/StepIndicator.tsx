import clsx from 'clsx';

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
}

const StepIndicator = ({ currentStep, totalSteps }: StepIndicatorProps) => {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step, index) => (
        <div key={step} className="flex items-center gap-1.25">
          <div
            className={clsx(
              'flex items-center justify-center w-6 h-6 rounded-full title-1-bold',
              step === currentStep ? 'bg-(--color-point) text-white' : 'bg-gray-200 text-white',
            )}
          >
            {step}
          </div>
          {index < totalSteps - 1 && <span className="bg-gray-200 h-0.5 w-3 rounded-full" />}
        </div>
      ))}
    </div>
  );
};

export default StepIndicator;
