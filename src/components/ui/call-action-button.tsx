import { Button } from '@/components/ui/button';
import { Loader2, Check, Phone, PhoneMissed, PhoneOff, X, PhoneIncoming } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ButtonHTMLAttributes } from 'react';
import { getCallActionButton, type CallActionType } from '@/lib/button-variants';

const ICON_MAP = {
  check: Check,
  phone: Phone,
  'phone-missed': PhoneMissed,
  'phone-off': PhoneOff,
  'phone-callback': PhoneIncoming,
  x: X,
} as const;

interface CallActionButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'aria-label'> {
  action: CallActionType;
  isLoading?: boolean;
  size?: 'sm' | 'default' | 'lg';
  fullWidth?: boolean;
}

export function CallActionButton({
  action,
  isLoading = false,
  size = 'default',
  fullWidth = false,
  className,
  onClick,
  ...props
}: CallActionButtonProps) {
  const config = getCallActionButton(action);
  const Icon = ICON_MAP[config.icon];

  // Determine variant styling
  const variantStyles = {
    primary: 'bg-green-600 hover:bg-green-700 text-white',
    secondary: 'bg-white hover:bg-gray-50 text-gray-900 border-2 border-gray-300',
    danger: 'bg-red-600 hover:bg-red-700 text-white',
    warning: 'bg-orange-500 hover:bg-orange-600 text-white',
    neutral: 'bg-white hover:bg-gray-50 text-gray-700 border-2 border-gray-400',
  };

  return (
    <Button
      size={size}
      disabled={isLoading}
      onClick={onClick}
      aria-label={config.ariaLabel}
      className={cn(
        variantStyles[config.variant],
        'font-semibold',
        'transition-all duration-200',
        'focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
        'shadow-sm hover:shadow-md',
        'active:scale-[0.98]',
        isLoading && 'opacity-70 cursor-wait',
        fullWidth && 'w-full',
        className
      )}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="h-4 w-4 mr-2 animate-spin" aria-hidden="true" />
          Chargement...
        </>
      ) : (
        <>
          <Icon className="h-4 w-4 mr-2" aria-hidden="true" />
          {config.text}
        </>
      )}
    </Button>
  );
}
