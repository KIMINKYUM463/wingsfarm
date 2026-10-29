import React from 'react';
import clsx from 'clsx';

interface EmptyProps {
  texts: string[];
  className?: string;
  textClassName?: string;
}

const Empty = ({ texts, className, textClassName }: EmptyProps) => {
  return (
    <div className={clsx('w-full min-h-58.5 p-content content-center', className)}>
      {texts.map((line, index) => (
        <p key={index} className={clsx('text-center text-gray-300', textClassName)}>
          {line}
        </p>
      ))}
    </div>
  );
};

export default Empty;
