import LiquidGlass from 'liquid-glass-react';
import { useRef, useEffect, useState } from 'react';

/**
 * Wrapper inline pour liquid-glass-react.
 * LiquidGlass s'attend à être centré dans un parent `position:relative`.
 * On utilise un spacer invisible pour donner les dimensions, puis on
 * superpose le vrai composant en `position:absolute` centré.
 */
export default function LiquidGlassBtn({
  children,
  onClick,
  padding = '14px 28px',
  cornerRadius = 14,
  displacementScale = 70,
  blurAmount = 0.08,
  saturation = 150,
  aberrationIntensity = 1.5,
  elasticity = 0.22,
  mode = 'prominent',
  overLight = false,
  className = '',
  style = {},
}) {
  const containerRef = useRef(null);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', ...style }}
    >
      {/* Spacer invisible — fixe la taille du container */}
      <span
        aria-hidden="true"
        style={{
          visibility: 'hidden',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          padding,
          pointerEvents: 'none',
          userSelect: 'none',
          whiteSpace: 'nowrap',
        }}
      >
        {children}
      </span>

      {/* Liquid glass centré sur le spacer */}
      <LiquidGlass
        mouseContainer={containerRef}
        padding={padding}
        cornerRadius={cornerRadius}
        displacementScale={displacementScale}
        blurAmount={blurAmount}
        saturation={saturation}
        aberrationIntensity={aberrationIntensity}
        elasticity={elasticity}
        mode={mode}
        overLight={overLight}
        onClick={onClick}
        style={{ position: 'absolute', top: '50%', left: '50%' }}
      >
        {children}
      </LiquidGlass>
    </div>
  );
}
