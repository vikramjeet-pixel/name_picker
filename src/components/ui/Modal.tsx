'use client';

import { motion, AnimatePresence } from 'framer-motion';
import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className = '' }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <dialog
          ref={dialogRef}
          className="bg-transparent p-0 m-auto max-w-none max-h-none overflow-visible"
          onClick={(e) => {
            if (e.target === dialogRef.current) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className={`bg-surface text-ink border border-line rounded-lg shadow-xl
              w-[min(28rem,calc(100vw-2rem))] ${className}`}
          >
            {title && (
              <div className="flex items-start justify-between gap-4 px-6 pt-5">
                <h3 className="font-display text-xl font-semibold tracking-tight">{title}</h3>
                <button
                  onClick={onClose}
                  aria-label="Close"
                  className="-mr-1 p-1 rounded-md text-muted hover:text-ink hover:bg-ink/5 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            )}
            <div className="px-6 pt-3 pb-6">{children}</div>
          </motion.div>
        </dialog>
      )}
    </AnimatePresence>
  );
}
