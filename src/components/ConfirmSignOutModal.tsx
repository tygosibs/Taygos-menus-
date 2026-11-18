import { useEffect } from 'react';
import { LogOut, X } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface ConfirmSignOutModalProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmSignOutModal({
  open,
  onCancel,
  onConfirm,
}: ConfirmSignOutModalProps) {
  const { dir, t } = useLanguage();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      dir={dir}
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-signout-title"
      className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-2xl p-6 space-y-5 shadow-2xl text-white"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center shrink-0">
              <LogOut className="w-5 h-5" />
            </div>
            <div>
              <h2 id="confirm-signout-title" className="text-base font-extrabold text-white">
                {t.signOutConfirm.title}
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label={t.signOutConfirm.cancelBtn}
            className="w-9 h-9 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-zinc-300 leading-relaxed">{t.signOutConfirm.desc}</p>

        <div className="flex items-center gap-2.5 pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-white transition-colors cursor-pointer"
          >
            {t.signOutConfirm.cancelBtn}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 min-h-[44px] py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-extrabold text-white transition-colors cursor-pointer"
          >
            {t.signOutConfirm.confirmBtn}
          </button>
        </div>
      </div>
    </div>
  );
}
