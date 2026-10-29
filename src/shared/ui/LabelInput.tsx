import clsx from 'clsx';

interface LabelInputProps {
  title: string;
  children?: React.ReactNode;
  className?: string;
  isEssential?: boolean;
  hint?: string;
}
const LabelInput = ({ title, children, className, isEssential = false, hint }: LabelInputProps) => {
  return (
    <div className={clsx('space-y-4', className)}>
      <p>
        {title} {isEssential && <span>*</span>}{' '}
        <span className="text-[.75rem] text-gray-300">{hint}</span>
      </p>
      {children}
    </div>
  );
};
export default LabelInput;
