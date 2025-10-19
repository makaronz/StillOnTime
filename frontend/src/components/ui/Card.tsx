import React from 'react';
import { clsx } from 'clsx';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({ className, children, ...props }) => {
  return (
    <div
      className={clsx(
        'bg-white rounded-lg shadow-md overflow-hidden',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader: React.FC<CardProps> = ({ className, children, ...props }) => {
  return (
    <div
      className={clsx(
        'px-6 py-4 border-b border-gray-200',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardTitle: React.FC<CardProps> = ({ className, children, ...props }) => {
  return (
    <h3
      className={clsx(
        'text-lg font-semibold text-gray-900',
        className
      )}
      {...props}
    >
      {children}
    </h3>
  );
};

export const CardContent: React.FC<CardProps> = ({ className, children, ...props }) => {
  return (
    <div
      className={clsx(
        'px-6 py-4',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardFooter: React.FC<CardProps> = ({ className, children, ...props }) => {
  return (
    <div
      className={clsx(
        'px-6 py-4 bg-gray-50 border-t border-gray-200',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};