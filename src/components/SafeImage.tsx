import { useState } from 'react';
import { Utensils } from 'lucide-react';

interface SafeImageProps {
  src?: string;
  alt: string;
  className?: string;
  fallbackClassName?: string;
}

export function SafeImage({ src, alt, className = '', fallbackClassName = '' }: SafeImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`flex flex-col items-center justify-center bg-gradient-to-br from-zinc-800/80 to-zinc-900/90 text-zinc-400 select-none ${fallbackClassName || className}`}
        aria-label={alt}
      >
        <Utensils className="w-6 h-6 opacity-50 mb-1" />
        <span className="text-[11px] opacity-60 px-2 text-center line-clamp-1">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
