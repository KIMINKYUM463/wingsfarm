'use client';

import clsx from 'clsx';
import { Skeleton, SkeletonGroup } from '@/shared/ui/Skeleton';
import { PROJECTS_PAGE_SIZE } from '../constants';

const gridClassName = clsx(
  'grid gap-x-6 gap-y-9',
  'tablet:grid-cols-2',
  'desktop:grid-cols-3',
  'wide:grid-cols-5',
);

const ProjectListSkeleton = () => {
  return (
    <SkeletonGroup count={PROJECTS_PAGE_SIZE} className={gridClassName}>
      <Skeleton className="w-full aspect-154/206" />
      <Skeleton variant="text" className="h-5 mt-2 w-3/4" />
      <Skeleton bg="gray-100" variant="text" className="h-4 mt-1 w-1/4" />
    </SkeletonGroup>
  );
};

export default ProjectListSkeleton;
