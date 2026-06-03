import React from 'react';

// Animated mesh-gradient + drifting "nebula" layers + soft noise overlay.
// Pure CSS — no canvas, no GPU thrash beyond compositor.
export default function HeroBackground() {
  return (
    <div className="hero-bg" aria-hidden>
      <div className="hero-bg-mesh" />
      <div className="hero-bg-nebula nebula-a" />
      <div className="hero-bg-nebula nebula-b" />
      <div className="hero-bg-nebula nebula-c" />
      <div className="hero-bg-beam beam-a" />
      <div className="hero-bg-beam beam-b" />
      <div className="hero-bg-grid" />
      <div className="hero-bg-vignette" />
    </div>
  );
}
