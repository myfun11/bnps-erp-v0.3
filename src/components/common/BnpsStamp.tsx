import React from 'react';

interface BnpsStampProps {
  className?: string;
  size?: number; // diameter in px, default 120
}

/**
 * Official circular ink stamp & signature for Bhumi Nidhi Powar Solution
 * Recreates the authentic physical stamp with:
 * - Double concentric circle ink borders (#1e3a8a / blue-800 / navy ink)
 * - Arced uppercase texts: "BHUMI NIDHI POWAR" on top, "★ SOLUTION ★" on bottom
 * - Boxed center: "JAIJAIPUR (C.G.)"
 * - Dynamic handwritten blue-ink cursive signatory overlay
 */
export const BnpsStamp: React.FC<BnpsStampProps> = ({
  className = '',
  size = 130,
}) => {
  return (
    <div 
      className={`relative inline-block select-none ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        className="w-full h-full transform -rotate-6"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          {/* Top Arc for "BHUMI NIDHI POWAR" */}
          <path
            id="topStampArc"
            d="M 28 100 A 72 72 0 0 1 172 100"
            fill="none"
          />
          {/* Bottom Arc for "★ SOLUTION ★" */}
          <path
            id="bottomStampArc"
            d="M 172 100 A 72 72 0 0 1 28 100"
            fill="none"
          />
        </defs>

        {/* Outer Circular Ink Border */}
        <circle
          cx="100"
          cy="100"
          r="92"
          fill="none"
          stroke="#1e3a8a"
          strokeWidth="4"
          strokeDasharray="none"
          opacity="0.92"
        />

        {/* Inner Concentric Circle */}
        <circle
          cx="100"
          cy="100"
          r="84"
          fill="none"
          stroke="#1e3a8a"
          strokeWidth="1.5"
          opacity="0.9"
        />

        {/* Circular Text Top: BHUMI NIDHI POWAR */}
        <text
          fill="#1e3a8a"
          fontSize="17.5"
          fontFamily="'Arial Black', Impact, sans-serif"
          fontWeight="900"
          letterSpacing="2.5"
        >
          <textPath href="#topStampArc" startOffset="50%" textAnchor="middle">
            BHUMI NIDHI POWAR
          </textPath>
        </text>

        {/* Circular Text Bottom: ★ SOLUTION ★ */}
        <text
          fill="#1e3a8a"
          fontSize="17.5"
          fontFamily="'Arial Black', Impact, sans-serif"
          fontWeight="900"
          letterSpacing="3"
        >
          <textPath href="#bottomStampArc" startOffset="50%" textAnchor="middle">
            ★ SOLUTION ★
          </textPath>
        </text>

        {/* Center Rectangular / Elliptic Division Border */}
        <rect
          x="32"
          y="76"
          width="136"
          height="48"
          rx="6"
          fill="#ffffff"
          fillOpacity="0.85"
          stroke="#1e3a8a"
          strokeWidth="2.5"
        />

        {/* Center City and State: JAIJAIPUR */}
        <text
          x="100"
          y="98"
          textAnchor="middle"
          fill="#1e3a8a"
          fontSize="16.5"
          fontFamily="'Arial Black', sans-serif"
          fontWeight="900"
          letterSpacing="1.2"
        >
          JAIJAIPUR
        </text>

        {/* State subtitle: (C.G.) */}
        <text
          x="100"
          y="116"
          textAnchor="middle"
          fill="#1e3a8a"
          fontSize="12.5"
          fontFamily="system-ui, sans-serif"
          fontWeight="800"
          letterSpacing="1"
        >
          (C.G.)
        </text>

        {/* Authentic Handwritten Blue Ink Signature overlay matching WhatsApp Image */}
        <path
          d="M 45 138 C 58 132, 68 118, 72 96 C 76 74, 86 52, 94 88 C 102 120, 88 152, 82 178 C 80 186, 92 148, 102 136 C 112 124, 126 122, 138 126 C 150 130, 142 152, 132 154 C 122 156, 116 142, 124 136 C 132 130, 148 128, 164 126 L 182 142 M 38 152 L 186 138"
          fill="none"
          stroke="#1d4ed8"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.95"
        />
      </svg>
    </div>
  );
};
