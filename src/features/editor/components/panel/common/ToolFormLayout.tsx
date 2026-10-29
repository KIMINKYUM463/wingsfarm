'use client';

import React from 'react';

interface ToolFormLayoutProps {
  title: string;
  subTitle?: string;
  children: React.ReactNode;
  figure?: number;
  suffix?: string;
}

const ToolFormLayout: React.FC<ToolFormLayoutProps> = ({
  title,
  children,
  suffix,
  figure,
  subTitle,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between">
        <div>
          <p>{title}</p>
          {subTitle && <p className="mt-1 text-gray-300 break-keep">{subTitle}</p>}
        </div>
        <p>
          {figure}
          {suffix}
        </p>
      </div>
      {children}
    </div>
  );
};

export default ToolFormLayout;
