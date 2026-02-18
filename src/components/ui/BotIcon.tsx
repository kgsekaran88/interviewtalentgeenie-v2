interface BotIconProps {
  className?: string;
  size?: number;
}

export function BotIcon({ className = '', size = 32 }: BotIconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Left headphone */}
      <rect
        x="6"
        y="18"
        width="4"
        height="12"
        rx="2"
        fill="white"
      />
      
      {/* Right headphone */}
      <rect
        x="38"
        y="18"
        width="4"
        height="12"
        rx="2"
        fill="white"
      />
      
      {/* Head circle */}
      <circle
        cx="24"
        cy="24"
        r="12"
        fill="white"
      />
      
      {/* Visor/Face */}
      <rect
        x="14"
        y="20"
        width="20"
        height="10"
        rx="5"
        fill="hsl(var(--primary))"
      />
      
      {/* Left eye */}
      <ellipse
        cx="19"
        cy="25"
        rx="2"
        ry="3"
        fill="white"
      />
      
      {/* Right eye */}
      <ellipse
        cx="29"
        cy="25"
        rx="2"
        ry="3"
        fill="white"
      />
      
      {/* Antenna */}
      <line
        x1="24"
        y1="12"
        x2="24"
        y2="8"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx="24"
        cy="7"
        r="2"
        fill="white"
      />
      
      {/* Microphone arm */}
      <path
        d="M34 28 Q38 30 38 34 L38 40"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        fill="none"
      />
      
      {/* Microphone */}
      <ellipse
        cx="37"
        cy="42"
        rx="3.5"
        ry="2.5"
        fill="white"
      />
    </svg>
  );
}
