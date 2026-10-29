// components/EqualColumnsRow.tsx
import React from 'react';
import { clsx } from 'clsx';

interface EqualColumnsRowProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

const EqualColumnsRow: React.FC<EqualColumnsRowProps> = ({ children, className, ...props }) => {
  return (
    <div className={clsx('grid auto-cols-fr grid-flow-col gap-2 w-full', className)} {...props}>
      {children}
    </div>
  );
};

export default EqualColumnsRow;
