import { forwardRef } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size    = 'xs' | 'sm' | 'md';

interface Props extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?:    Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:   'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500 disabled:bg-blue-300',
  secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-700',
  ghost:     'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100',
  danger:    'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
};

const sizes: Record<Size, string> = {
  xs: 'h-7  px-2.5 text-xs  gap-1',
  sm: 'h-8  px-3   text-sm  gap-1.5',
  md: 'h-9  px-4   text-sm  gap-2',
};

export const Button = forwardRef<HTMLButtonElement, Props>(({
  variant = 'secondary', size = 'md', loading = false, disabled, className = '', children, ...rest
}, ref) => (
  <button
    ref={ref}
    disabled={disabled || loading}
    className={[
      'inline-flex items-center justify-center rounded-md font-medium transition-colors',
      'focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-white dark:focus:ring-offset-slate-900',
      'disabled:pointer-events-none disabled:opacity-50',
      variants[variant], sizes[size], className,
    ].join(' ')}
    {...rest}
  >
    {loading && (
      <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
    )}
    {children}
  </button>
));
Button.displayName = 'Button';
