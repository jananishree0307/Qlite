import { useState } from 'react';
import { VENUE_IMAGES } from '../data/seedLocations';
import { ServiceCategory } from '../types/qlite';
import { CategoryIcon } from './CategoryIcon';

interface VenueImageProps {
  photoUrl?: string;
  imageKey?: string;
  category: ServiceCategory;
  name: string;
  className?: string;
}

export function VenueImage({
  photoUrl,
  imageKey,
  category,
  name,
  className = 'h-40 w-full',
}: VenueImageProps) {
  const [failed, setFailed] = useState(false);
  const src = photoUrl || (imageKey ? VENUE_IMAGES[imageKey] : VENUE_IMAGES[category]);

  if (!src || failed) {
    return (
      <div
        className={`${className} bg-gradient-to-br from-slate-100 via-slate-50 to-blue-50 flex flex-col items-center justify-center gap-2 text-slate-500 border-b border-slate-200/70 px-4 text-center`}
      >
        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-blue-700 shadow-xs">
          <CategoryIcon category={category} className="w-5 h-5" />
        </div>
        <span className="text-xs font-medium text-slate-600 line-clamp-1">{name}</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={name}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${className} object-cover bg-slate-100`}
    />
  );
}
