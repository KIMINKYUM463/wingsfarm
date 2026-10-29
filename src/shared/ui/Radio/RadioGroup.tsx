import React, { ReactNode } from 'react';

type RadioGroupProps = {
  label: string;
  children: ReactNode;
  className?: string;
};

const RadioGroup = React.memo<RadioGroupProps>(({ label, children, className }) => {
  return (
    <fieldset className={className}>
      <legend className="sr-only">{label}</legend>
      {children}
    </fieldset>
  );
});

RadioGroup.displayName = 'RadioGroup';

export default RadioGroup;