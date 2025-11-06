import React from 'react';

const Logo = ({ className = "h-8 w-8" }) => (
  <svg 
    viewBox="0 0 200 200" 
    className={className}
    aria-label="Cross-Chain Lending Logo"
  >
    {/* Background Circle */}
    <circle cx="100" cy="100" r="90" fill="#1a1a1a"/>
    
    {/* Outer Chain Ring */}
    <circle cx="100" cy="100" r="80" fill="none" stroke="#6366f1" strokeWidth="4" strokeDasharray="15,8"/>
    
    {/* Inner Chain Ring */}
    <circle cx="100" cy="100" r="60" fill="none" stroke="#818cf8" strokeWidth="4" strokeDasharray="12,6"/>
    
    {/* Central Symbol */}
    <g transform="translate(100,100)">
      {/* Bridge/Connection Symbol */}
      <path d="M-30,-10 L30,-10 M-30,10 L30,10" 
            stroke="#fff" 
            strokeWidth="8" 
            strokeLinecap="round"/>
      
      {/* Arrows indicating flow */}
      <path d="M-20,0 L-40,-20 M-20,0 L-40,20" 
            stroke="#22c55e" 
            strokeWidth="6" 
            strokeLinecap="round"/>
      <path d="M20,0 L40,-20 M20,0 L40,20" 
            stroke="#22c55e" 
            strokeWidth="6" 
            strokeLinecap="round"/>
    </g>
    
    {/* Chain Nodes */}
    <circle cx="50" cy="100" r="12" fill="#22c55e"/>
    <circle cx="150" cy="100" r="12" fill="#22c55e"/>
    
    {/* Subtle Glow Effect */}
    <circle cx="100" cy="100" r="70" fill="url(#glow)" opacity="0.2"/>
    
    {/* Definitions */}
    <defs>
      <radialGradient id="glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.6"/>
        <stop offset="100%" stopColor="#6366f1" stopOpacity="0"/>
      </radialGradient>
    </defs>
  </svg>
);

export default Logo;