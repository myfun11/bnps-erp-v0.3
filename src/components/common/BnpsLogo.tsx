import React from 'react';

interface BnpsLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'horizontal';
  inverted?: boolean;
}

export const BnpsLogo: React.FC<BnpsLogoProps> = ({
  className = '',
  size = 'md',
  variant = 'full',
  inverted = false,
}) => {
  // Dimensions map
  const sizeMap = {
    sm: { icon: 32, width: 140, height: 42 },
    md: { icon: 48, width: 180, height: 56 },
    lg: { icon: 64, width: 220, height: 72 },
    xl: { icon: 96, width: 280, height: 96 },
  };

  const navyColor = inverted ? '#f8fafc' : '#0e2b54';
  const amberColor = '#f59e0b';
  const leafColor = '#d97706';
  const leafLight = '#f59e0b';
  const subtextColor = inverted ? '#cbd5e1' : '#475569';

  const Emblem = () => (
    <svg
      viewBox="0 0 200 200"
      className={variant === 'icon' ? className : 'shrink-0'}
      style={{
        width: sizeMap[size].icon,
        height: sizeMap[size].icon,
      }}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* House / Upward Arrow Roof Structure */}
      <path
        d="M100 16 L154 68 H132 V132 H114 V94 L100 106 L86 94 V132 H68 V68 H46 Z"
        fill="#0e2b54"
      />
      {/* Base Foundation Platform */}
      <rect x="44" y="138" width="112" height="8" rx="2" fill="#0e2b54" />
      <rect x="36" y="148" width="128" height="6" rx="2" fill="#0e2b54" />

      {/* Sun / Leaf Wing Left */}
      <path
        d="M50 106 C42 86 64 68 84 82 C88 94 82 114 66 118 C58 120 52 114 50 106 Z"
        fill={leafColor}
      />
      <path
        d="M54 104 C64 96 74 92 84 92"
        stroke={leafLight}
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Sun / Leaf Wing Right */}
      <path
        d="M150 106 C158 86 136 68 116 82 C112 94 118 114 134 118 C142 120 148 114 150 106 Z"
        fill={leafColor}
      />
      <path
        d="M146 104 C136 96 126 92 116 92"
        stroke={leafLight}
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Sprout Stem Center */}
      <path
        d="M92 140 C94 122 88 112 84 104 C92 116 98 126 100 140 Z"
        fill="#0e2b54"
      />
      <path
        d="M108 140 C106 122 112 112 116 104 C108 116 102 126 100 140 Z"
        fill="#0e2b54"
      />

      {/* Central Powerful Lightning Bolt */}
      <polygon
        points="106,20 86,72 108,72 94,124 134,62 110,62"
        fill={amberColor}
      />
      <polygon
        points="104,26 89,70 108,70 96,118 130,64 110,64"
        fill="#fbbf24"
      />
    </svg>
  );

  if (variant === 'icon') {
    return <Emblem />;
  }

  if (variant === 'horizontal') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <Emblem />
        <div className="leading-tight">
          <div
            className="font-black tracking-tight text-base sm:text-lg uppercase"
            style={{ color: navyColor, fontFamily: 'system-ui, sans-serif' }}
          >
            BHUMI NIDHI
          </div>
          <div
            className="font-black tracking-tight text-sm sm:text-base uppercase -mt-0.5"
            style={{ color: navyColor, fontFamily: 'system-ui, sans-serif' }}
          >
            POWAR SOLUTION
          </div>
          <div
            className="text-[9px] sm:text-[10px] tracking-widest font-semibold uppercase text-slate-500 mt-0.5"
            style={{ color: subtextColor }}
          >
            POWARING GLOBAL CONNECTIONS
          </div>
        </div>
      </div>
    );
  }

  // Full stacked vertical variant matching the uploaded logo
  return (
    <div className={`flex flex-col items-center text-center ${className}`}>
      <Emblem />
      <div className="mt-1.5 leading-tight">
        <div
          className="font-black tracking-tight text-base sm:text-xl uppercase"
          style={{ color: navyColor, fontFamily: 'system-ui, sans-serif' }}
        >
          BHUMI NIDHI
        </div>
        <div
          className="font-black tracking-tight text-sm sm:text-lg uppercase -mt-0.5"
          style={{ color: navyColor, fontFamily: 'system-ui, sans-serif' }}
        >
          POWAR SOLUTION
        </div>
        <div
          className="text-[8px] sm:text-[10px] tracking-[0.2em] font-semibold uppercase mt-0.5"
          style={{ color: subtextColor }}
        >
          POWARING GLOBAL CONNECTIONS
        </div>
      </div>
    </div>
  );
};
