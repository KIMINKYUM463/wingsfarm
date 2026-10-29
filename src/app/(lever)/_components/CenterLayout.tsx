import clsx from 'clsx';

interface CenterLayoutProps {
  children: React.ReactNode;
  maxWClassName?: string;
  bgClassName?: string;
  className?: string;
}

export default function CenterLayout({
  children,
  maxWClassName = 'max-w-80',
  bgClassName = 'bg-white',
  className,
}: CenterLayoutProps) {
  return (
    <main
      className={clsx(
        'flex-column p-content min-h-screen items-center justify-center',
        bgClassName,
        className,
      )}
    >
      <div className={clsx('w-full', maxWClassName)}>{children}</div>
    </main>
  );
}
