import React from 'react';
import logoImg from '../assets/images/zambia_airways_logo_1786459828214.jpg';

interface LogoProps {
  variant?: 'light' | 'dark' | 'icon-only';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export const ZambiaAirwaysLogo: React.FC<LogoProps> = ({
  variant = 'dark',
  size = 'md',
  showText = true,
  className = '',
}) => {
  // Image height class
  const imgHeightClass = {
    sm: 'h-8 sm:h-9',
    md: 'h-10 sm:h-11',
    lg: 'h-14 sm:h-16',
    xl: 'h-20 sm:h-22',
  }[size];

  // Text sizes
  const textStyles = {
    sm: { title: 'text-xs sm:text-sm', subtitle: 'text-[9px] sm:text-[10px]' },
    md: { title: 'text-sm sm:text-base', subtitle: 'text-[10px] sm:text-xs' },
    lg: { title: 'text-lg sm:text-xl', subtitle: 'text-xs sm:text-sm' },
    xl: { title: 'text-2xl sm:text-3xl', subtitle: 'text-sm sm:text-base' },
  }[size];

  const textColorClass = variant === 'light' ? 'text-white' : 'text-[#006B3F]';
  const subtitleColorClass = variant === 'light' ? 'text-emerald-200' : 'text-[#F37C1C]';

  return (
    <div className={`inline-flex items-center gap-2.5 sm:gap-3 select-none ${className}`}>
      {/* Exact Zambia Airways Official Logo Image */}
      <div className={`relative flex items-center justify-center ${imgHeightClass} shrink-0 overflow-hidden rounded-md bg-white p-0.5 shadow-2xs border border-slate-100/90`}>
        <img
          src={logoImg}
          alt="Zambia Airways Logo"
          referrerPolicy="no-referrer"
          className="h-full w-auto object-contain"
        />
      </div>

      {/* Text Next to Logo */}
      {showText && (
        <div className="flex flex-col justify-center leading-tight">
          <span className={`font-black tracking-tight font-serif uppercase ${textStyles.title} ${textColorClass}`} style={{ fontFamily: "'Times New Roman', Georgia, serif" }}>
            Zambia Airways
          </span>
          <span className={`font-extrabold tracking-wide uppercase font-mono ${textStyles.subtitle} ${subtitleColorClass}`}>
            Crew Control &amp; Scheduling
          </span>
        </div>
      )}
    </div>
  );
};
