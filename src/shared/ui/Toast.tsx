/**
 * @file Toast notification system using Sonner with ShadCN UI integration
 */
import { CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastOptions {
  title: string;
  message?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Enhanced toast functions with ShadCN styling
 */
export const showToast = {
  success: ({ title, message, duration = 5000, action }: ToastOptions): string | number => {
    return toast.success(title, {
      description: message,
      duration,
      action: action ? {
        label: action.label,
        onClick: action.onClick,
      } : undefined,
      icon: <CheckCircle size={20} />,
    });
  },

  error: ({ title, message, duration = 5000, action }: ToastOptions): string | number => {
    return toast.error(title, {
      description: message,
      duration,
      action: action ? {
        label: action.label,
        onClick: action.onClick,
      } : undefined,
      icon: <AlertCircle size={20} />,
    });
  },

  info: ({ title, message, duration = 5000, action }: ToastOptions): string | number => {
    return toast.info(title, {
      description: message,
      duration,
      action: action ? {
        label: action.label,
        onClick: action.onClick,
      } : undefined,
      icon: <Info size={20} />,
    });
  },

  warning: ({ title, message, duration = 5000, action }: ToastOptions): string | number => {
    return toast.warning(title, {
      description: message,
      duration,
      action: action ? {
        label: action.label,
        onClick: action.onClick,
      } : undefined,
      icon: <AlertTriangle size={20} />,
    });
  },
};

// Export Toaster component from Sonner
export { Toaster as ToastContainer } from 'sonner';
