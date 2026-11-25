import {
  Building2,
  Film,
  GraduationCap,
  Landmark,
  Mail,
  MapPin,
  ShieldCheck,
  ShoppingBag,
  Stethoscope,
  Store,
  Utensils,
} from 'lucide-react';
import { ServiceCategory } from '../types/qlite';

interface CategoryIconProps {
  category: ServiceCategory;
  className?: string;
}

export function CategoryIcon({ category, className = 'w-4 h-4' }: CategoryIconProps) {
  switch (category) {
    case 'temple':
      return <Landmark className={className} />;
    case 'hospital':
      return <Stethoscope className={className} />;
    case 'bank':
      return <Building2 className={className} />;
    case 'mall':
      return <Store className={className} />;
    case 'post_office':
      return <Mail className={className} />;
    case 'government':
      return <ShieldCheck className={className} />;
    case 'retail':
      return <ShoppingBag className={className} />;
    case 'cinema':
      return <Film className={className} />;
    case 'restaurant':
      return <Utensils className={className} />;
    case 'college':
      return <GraduationCap className={className} />;
    default:
      return <MapPin className={className} />;
  }
}
