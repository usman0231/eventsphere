import React from 'react';
import { EffectComposer, Bloom, Vignette, ChromaticAberration, ToneMapping, DepthOfField } from '@react-three/postprocessing';
import { BlendFunction, ToneMappingMode } from 'postprocessing';
import { Vector2 } from 'three';

/**
 * Cinematic postprocessing pipeline.
 *
 * - Bloom — picks up the neon emissive booths, holo panels, light bars
 * - DepthOfField — focus near the center of the world, blur far away
 * - ChromaticAberration — subtle prism edge for "lens" feel
 * - Vignette — frame focus
 * - ToneMapping — ACES filmic so the bloom doesn't clip to white
 */
export default function PostFX({ enabled = true }) {
  if (!enabled) return null;

  return (
    <EffectComposer multisampling={0} disableNormalPass>
      <DepthOfField
        focusDistance={0.012}
        focalLength={0.04}
        bokehScale={2.4}
        height={480}
      />
      <Bloom
        intensity={0.95}
        luminanceThreshold={0.35}
        luminanceSmoothing={0.5}
        mipmapBlur
        levels={6}
        radius={0.85}
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={new Vector2(0.0008, 0.0008)}
        radialModulation
        modulationOffset={0.6}
      />
      <Vignette
        offset={0.25}
        darkness={0.7}
        eskil={false}
        blendFunction={BlendFunction.NORMAL}
      />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
    </EffectComposer>
  );
}
