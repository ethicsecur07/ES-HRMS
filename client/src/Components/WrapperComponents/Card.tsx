import React from 'react';
import { twMerge } from 'tailwind-merge';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ className, children, ...props }) => {
  return (
    <div
      className={twMerge(
        'bg-card text-card-foreground rounded-xl border border-border shadow-sm p-6 backdrop-blur-sm bg-opacity-95 dark:bg-opacity-90',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};
