import { useState } from 'react';
import { Cpu } from 'lucide-react';

interface EquipmentImageProps {
  src: string;
  alt: string;
  label?: string;
  className?: string;
  priority?: boolean;
}

export function EquipmentImage({
  src,
  alt,
  label,
  className = '',
  priority = false,
}: EquipmentImageProps) {
  const [failed, setFailed] = useState(false);

  const resolvedSrc = src.startsWith('/src/') ? `.${src}` : src;

  if (failed || !resolvedSrc) {
    return (
      <div
        className={`bg-slate-100 border border-slate-200 flex flex-col items-center justify-center p-4 text-center ${className}`}
        role="img"
        aria-label={alt}
      >
        <Cpu className="w-7 h-7 text-slate-400 mb-2" strokeWidth={1.5} aria-hidden="true" />
        <span className="text-xs font-medium text-slate-600 line-clamp-2 max-w-[18ch]">
          {label || alt}
        </span>
      </div>
    );
  }

  return (
    <img
      src={resolvedSrc}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
