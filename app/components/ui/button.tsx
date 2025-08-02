import { clsx } from 'clsx';
import Link from 'next/link';
import React, { type ButtonHTMLAttributes } from 'react';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  href?: string;
  dimension?: 'xs' | 'sm' | 'midi' | 'md' | 'lg';
  variant?: 'primary' | 'outline';
  isLoading?: boolean;
  children?: React.ReactNode;
}

export default function Button(props: ButtonProps) {
  const {
    className,
    href,
    dimension = 'md',
    variant = 'primary',
    isLoading,
    children,
    ...rest
  } = props;

  const baseClasses =
    'outline-none focus:outline-none hover:outline-none transition-all cursor-pointer inline-flex items-center justify-center font-medium rounded-md';

  const dimensionClasses = {
    xs: 'px-2 py-1 text-xs',
    sm: 'px-3 py-1.5 text-sm',
    midi: 'px-4 py-2 text-sm',
    md: 'px-4 py-2 text-base',
    lg: 'px-6 py-3 text-lg',
  };

  const variantClasses = {
    primary: 'bg-white text-black border border-gray-300 hover:bg-gray-100',
    outline: 'bg-transparent text-white border border-gray-400 hover:bg-gray-900 hover:text-white',
  };

  const classes = clsx(
    baseClasses,
    dimensionClasses[dimension],
    variantClasses[variant],
    {
      'opacity-50 cursor-not-allowed': isLoading,
    },
    className
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {isLoading ? 'Loading...' : children}
      </Link>
    );
  }

  return (
    <button className={classes} disabled={isLoading} {...rest}>
      {isLoading ? 'Loading...' : children}
    </button>
  );
}
