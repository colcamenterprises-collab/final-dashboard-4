import { X, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';

type ConfirmDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'success' | 'warning';
};

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger'
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const variants = {
    danger: {
      icon: <Trash2 className="w-12 h-12 text-red-500" />,
      iconBg: 'bg-red-50',
      confirmBtn: 'bg-red-600 hover:bg-red-700 active:bg-red-800 text-white'
    },
    success: {
      icon: <CheckCircle className="w-12 h-12 text-green-500" />,
      iconBg: 'bg-green-50',
      confirmBtn: 'bg-green-600 hover:bg-green-700 active:bg-green-800 text-white'
    },
    warning: {
      icon: <AlertCircle className="w-12 h-12 text-yellow-500" />,
      iconBg: 'bg-yellow-50',
      confirmBtn: 'bg-yellow-600 hover:bg-yellow-700 active:bg-yellow-800 text-white'
    }
  };

  const config = variants[variant];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[8px] max-w-md w-full shadow-2xl transform transition-all">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-[8px] hover:bg-gray-100 active:bg-gray-200 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 text-center">
          <div className={`mx-auto w-16 h-16 ${config.iconBg} rounded-full flex items-center justify-center mb-4`}>
            {config.icon}
          </div>
          <p className="text-base text-gray-600 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 p-4 bg-gray-50 rounded-b-[8px]">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 text-sm font-medium border-2 border-gray-300 rounded-[8px] bg-white hover:bg-gray-50 active:bg-gray-100 transition-all active:scale-98 min-h-[44px]"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`flex-1 px-6 py-3 text-sm font-semibold rounded-[8px] transition-all active:scale-98 min-h-[44px] ${config.confirmBtn}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}

type SuccessDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
  buttonText?: string;
};

export function SuccessDialog({
  isOpen,
  onClose,
  title,
  message,
  buttonText = 'OK'
}: SuccessDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-[8px] max-w-md w-full shadow-2xl transform transition-all">
        {/* Content */}
        <div className="p-6 text-center">
          <div className="mx-auto w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mb-4">
            <CheckCircle className="w-12 h-12 text-green-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
          <p className="text-base text-gray-600 leading-relaxed">
            {message}
          </p>
        </div>

        {/* Action */}
        <div className="p-4 bg-gray-50 rounded-b-[8px]">
          <button
            onClick={onClose}
            className="w-full px-6 py-3 text-sm font-semibold rounded-[8px] bg-green-600 hover:bg-green-700 active:bg-green-800 text-white transition-all active:scale-98 min-h-[44px]"
          >
            {buttonText}
          </button>
        </div>
      </div>
    </div>
  );
}
