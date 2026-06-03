import React from 'react';

// Stylized faux logos — each is text + a glyph so the strip reads as recognizable brand marks
const LOGOS = [
  { name: 'NEXUS',    glyph: '◆' },
  { name: 'ORBITAL',  glyph: '◐' },
  { name: 'VOLT',     glyph: '⚡' },
  { name: 'PRISMA',   glyph: '▲' },
  { name: 'HELIX',    glyph: '∞' },
  { name: 'QUANTA',   glyph: '◉' },
  { name: 'AETHER',   glyph: '✦' },
  { name: 'NORTH',    glyph: '◢' },
  { name: 'LUMEN',    glyph: '◯' },
  { name: 'VERTEX',   glyph: '◬' },
];

function Logo({ name, glyph }) {
  return (
    <span className="logo-mark">
      <span className="logo-glyph">{glyph}</span>
      <span className="logo-name">{name}</span>
    </span>
  );
}

export default function LogoStrip() {
  const items = [...LOGOS, ...LOGOS]; // duplicated for seamless loop
  return (
    <section className="logo-strip-section">
      <div className="logo-strip-label">Trusted by event teams at</div>
      <div className="logo-strip-track-wrap">
        <div className="logo-strip-track">
          {items.map((l, i) => <Logo key={i} {...l} />)}
        </div>
      </div>
    </section>
  );
}
