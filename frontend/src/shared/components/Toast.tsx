import { useEffect, useState } from 'react';
import { cn } from '@/shared/lib/cn';

type ToastType = 'success' | 'error' | 'info';

interface ToastMessage { id: number; type: ToastType; message: string }

let toastId = 0;
const listeners: Set<(msg: ToastMessage) => void> = new Set();

export function toast(type: ToastType, message: string) {
  const msg: ToastMessage = { id: ++toastId, type, message };
  listeners.forEach((fn) => fn(msg));
}

const icons: Record<ToastType, string> = { success: '✅', error: '❌', info: 'ℹ️' };
const colors: Record<ToastType, string> = { success: 'border-l-success bg-success-bg', error: 'border-l-critical bg-critical-bg', info: 'border-l-info bg-info-bg' };
const textColors: Record<ToastType, string> = { success: 'text-success', error: 'text-critical', info: 'text-info-bright' };

export function ToastContainer() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const handler = (msg: ToastMessage) => {
      setMessages((prev) => [...prev, msg]);
      setTimeout(() => setMessages((prev) => prev.filter((m) => m.id !== msg.id)), 3500);
    };
    listeners.add(handler);
    return () => { listeners.delete(handler); };
  }, []);

  if (messages.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 z-[9999] space-y-2 max-w-sm">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={cn('flex items-start gap-2 p-3 rounded-lg border border-border-default border-l-[3px] shadow-elevated bg-surface-card animate-slide-up', colors[msg.type])}
        >
          <span>{icons[msg.type]}</span>
          <span className={cn('text-sm font-medium', textColors[msg.type])}>{msg.message}</span>
          <button onClick={() => setMessages((prev) => prev.filter((m) => m.id !== msg.id))} className="ml-auto text-text-muted hover:text-text-primary min-h-[32px] min-w-[32px] flex items-center justify-center">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
      ))}
    </div>
  );
}
