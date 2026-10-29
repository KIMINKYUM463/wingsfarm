'use client';

import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import { TextAreaProps } from '@/shared/types/ui';

const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={clsx('resize-none outline-none border-none focus:outline-none', className)}
      {...props}
    />
  );
});

TextArea.displayName = 'TextArea';

export default TextArea;
