import { useEffect, useState } from 'react';

interface Props {
  message: string | null;
  onDismiss?: () => void;
}

export default function Toast({ message, onDismiss }: Props) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (message) {
      setVisible(true);
      const t = setTimeout(() => {
        setVisible(false);
        onDismiss?.();
      }, 2500);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [message, onDismiss]);

  if (!visible || !message) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 bg-[#0A0A0A] text-white rounded-lg text-sm shadow-lg max-w-[320px] text-center"
    >
      {message}
    </div>
  );
}
