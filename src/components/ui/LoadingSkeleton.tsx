import React from 'react';

export const CredentialSkeleton = () => (
  <div className="animate-pulse space-y-4 p-6 border rounded-lg bg-white dark:bg-gray-800">
    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
    <div className="flex justify-between items-center pt-4">
      <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
      <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded-full w-8"></div>
    </div>
  </div>
);

export const CredentialsGridSkeleton = ({ count = 3 }: { count?: number }) => (
  <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
    {Array.from({ length: count }).map((_, i) => (
      <CredentialSkeleton key={i} />
    ))}
  </div>
);
