import React from 'react';

// Quick capability probe — true if the browser can actually hand out a WebGL context.
export function isWebGLAvailable() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch {
    return false;
  }
}

// Wraps a Three.js <Canvas>. If WebGL is unavailable, or the renderer throws while
// initialising (e.g. "Error creating WebGL context"), it renders `fallback` instead
// of letting the error crash the whole page. 3D here is a visual enhancement, not core.
export default class WebGLBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { errored: false, supported: isWebGLAvailable() };
  }

  static getDerivedStateFromError() {
    return { errored: true };
  }

  componentDidCatch(error) {
    console.warn('[WebGLBoundary] 3D disabled:', error?.message || error);
  }

  render() {
    if (!this.state.supported || this.state.errored) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
