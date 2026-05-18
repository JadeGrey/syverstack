export const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const fragmentShader = `
uniform vec2 uResolution;
uniform vec2 uMouse;
uniform float uTime;
uniform float uScroll;
uniform float uScrollVelocity;
uniform float uSection;
uniform float uSectionTransition;
uniform float uOpacity;

varying vec2 vUv;

// ── 2D noise ──
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  vec2 shift = vec2(100.0);
  for (int i = 0; i < 4; i++) {
    v += a * noise(p);
    p = p * 2.0 + shift;
    a *= 0.5;
  }
  return v;
}

// ── Transition intensity ramps ──
// Smooth ease-in-out for transition effects
float transEase(float t) {
  return t * t * (3.0 - 2.0 * t);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 pos = uv;

  // ── Transition factor ──
  float trans = smoothstep(0.0, 0.6, uSectionTransition);
  float transIntensity = transEase(trans); // 0 at center, 1 fully between sections

  // ── Base grid ──
  vec2 grid = abs(fract(pos * 24.0 - 0.5) - 0.5);
  float gridX = 1.0 - smoothstep(0.0, 0.012, grid.x);
  float gridY = 1.0 - smoothstep(0.0, 0.012, grid.y);
  float gridLine = max(gridX, gridY);

  // Grid ripples intensify during transitions
  float gridRipple = 0.0;
  if (transIntensity > 0.01) {
    float ripple = sin(pos.x * 30.0 + uTime * 3.0 + uScroll * 6.0) * 0.5 + 0.5;
    gridRipple = ripple * transIntensity * 0.15;
  }

  // Edge fade
  float edgeFade = 1.0 - smoothstep(0.2, 0.8, abs(uv.x - 0.5) * 1.8);
  edgeFade *= 1.0 - smoothstep(0.2, 0.8, abs(uv.y - 0.5) * 1.8);
  gridLine *= edgeFade;

  // ── Scroll velocity: speed lines ──
  float speedLines = 0.0;
  float baseVelocity = smoothstep(0.02, 0.4, uScrollVelocity);

  if (uScrollVelocity > 0.02 || transIntensity > 0.01) {
    // Speed line intensity: base from velocity + amplified by transition
    float speedIntensity = baseVelocity + transIntensity * 0.6;
    speedIntensity = min(speedIntensity, 1.0);

    // Dense speed lines — frequency increases with transition
    float density = 30.0 + transIntensity * 60.0;
    float lineNoise = noise(vec2(pos.x * density, pos.y * 4.0 + uTime * 2.0));
    speedLines = smoothstep(0.2, 0.6, lineNoise) * speedIntensity * 0.5;

    // Fast horizontal streaks (Tron-style)
    float streakSpeed = 5.0 + transIntensity * 10.0;
    float streak = fract(pos.y * 25.0 - uTime * streakSpeed);
    speedLines += smoothstep(0.0, 0.03, streak) * speedIntensity * 0.35 *
                  (sin(pos.x * 10.0 + uTime) * 0.5 + 0.5);

    // Transition whoosh — wall of light sweeping across
    if (transIntensity > 0.1) {
      float whoosh = fract(uTime * 0.8 - pos.x * 0.5 + uScroll * 3.0);
      float whooshLine = smoothstep(0.0, 0.08, whoosh) * (1.0 - smoothstep(0.1, 0.3, whoosh));
      float whooshIntensity = transIntensity * (0.5 + uScrollVelocity * 2.0);
      speedLines += whooshLine * whooshIntensity * 0.6;

      // Second whoosh from opposite direction
      float whoosh2 = fract(uTime * 1.2 + pos.y * 0.3 - uScroll * 4.0);
      float whooshLine2 = smoothstep(0.0, 0.05, whoosh2) * (1.0 - smoothstep(0.08, 0.2, whoosh2));
      speedLines += whooshLine2 * whooshIntensity * 0.3;
    }

    speedLines *= edgeFade;
  }

  // ── Scroll-reactive glow bands ──
  float scrollBand = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float bandPos = fract(uScroll * 2.5 + fi * 0.25 + uTime * 0.03);
    float band = 1.0 - smoothstep(0.0, 0.12, abs(pos.y - bandPos));
    band *= sin(uv.x * 3.14159 * 2.0 + fi * 2.0 + uTime * 0.5) * 0.5 + 0.5;
    scrollBand += band * (0.05 - fi * 0.01);
  }
  // Bands intensify during transitions
  scrollBand *= (1.0 + transIntensity * 3.0);

  // ── Section-aware color shift ──
  float sectionShift = sin(uSection * 3.14159 * 2.0 + uTime * 0.1) * 0.5 + 0.5;

  // ── Travelling pulses ──
  float pulse1 = sin(pos.x * 8.0 + uTime * 1.2 + uScroll * 3.0) * 0.5 + 0.5;
  float pulse2 = sin(pos.y * 6.0 - uTime * 0.9 + pos.x * 3.0 + uScroll * 2.0) * 0.5 + 0.5;
  float pulse = pulse1 * pulse2;
  // Pulse amplifies during transitions
  pulse += pulse * transIntensity * 2.0;

  // ── Transition flash — quick brightness spike when snapping ──
  float transitionFlash = 0.0;
  if (transIntensity > 0.3) {
    float flash = sin(uTime * 4.0 + uScroll * 5.0) * 0.5 + 0.5;
    transitionFlash = flash * transIntensity * 0.12 * (1.0 + uScrollVelocity * 3.0);
  }

  // ── Scroll-responsive organic flow ──
  float flow = fbm(pos * 3.0 + vec2(uTime * 0.02, uScroll * 0.5));
  float scrollFlow = flow * 0.06 * (1.0 + uScrollVelocity * 3.0 + transIntensity * 5.0);

  // ── Mouse interaction ──
  float dist = length(uv - uMouse);
  float mouseGlow = 0.06 / (dist * 6.0 + 0.5);

  // ── Colors ──
  vec3 magenta = vec3(1.0, 0.231, 0.549);
  vec3 cyan = vec3(0.0, 0.961, 1.0);
  vec3 darkBg = vec3(0.02, 0.027, 0.05);

  // During transitions, colors shift more dramatically
  float blend = pulse * 0.4 + uv.x * 0.15 + sectionShift * 0.15;
  blend += transIntensity * 0.2 * sin(uTime + uScroll * 4.0);
  vec3 accentColor = mix(magenta, cyan, blend);

  // ── Build final color ──
  vec3 color = darkBg;

  // Grid with accent
  color = mix(color, accentColor, gridLine * 0.25);
  color += accentColor * gridRipple;

  // Speed lines — magenta dominant, aggressively intensified
  color += magenta * speedLines * 1.2;
  color += vec3(0.9, 0.5, 0.9) * speedLines * 0.3;
  color += vec3(1.0, 0.4, 0.7) * speedLines * transIntensity * 0.5;

  // Scroll glow bands
  float bandIntensity = scrollBand * (1.0 + uScrollVelocity * 5.0);
  vec3 bandColor = mix(magenta, cyan, sin(uScroll * 3.0 + uTime * 0.2 + transIntensity * 3.0) * 0.5 + 0.5);
  color += bandColor * bandIntensity;

  // Transition flash
  color += vec3(1.0, 0.5, 0.7) * transitionFlash;

  // Organic flow — amplified during transitions
  color += accentColor * scrollFlow;

  // Noise texture
  float n = noise(uv * 4.0 + uTime * 0.02);
  color += vec3(n * 0.03, n * 0.02, n * 0.05);

  // Subtle mouse highlight — no visible ring/glow, just barely lifts the grid
  color += magenta * mouseGlow * 0.15;

  // Pulse highlights
  float pulseHighlight = pulse * gridLine * 0.15;
  color += accentColor * pulseHighlight;

  // Vignette
  float vignette = 1.0 - length(uv - 0.5) * 0.7;
  color *= vignette;

  gl_FragColor = vec4(color, uOpacity);
}
`;
