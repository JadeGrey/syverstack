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
uniform float uIntensity;
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

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 pos = uv;

  // ── Intensity drives all transient effects ──
  // 0.15 = baseline (subtle), up to ~0.8 = full blast during scroll
  float intensity = uIntensity;

  // ── Base grid ──
  vec2 grid = abs(fract(pos * 24.0 - 0.5) - 0.5);
  float gridX = 1.0 - smoothstep(0.0, 0.012, grid.x);
  float gridY = 1.0 - smoothstep(0.0, 0.012, grid.y);
  float gridLine = max(gridX, gridY);

  // Grid ripples — scale with intensity
  float ripple = sin(pos.x * 30.0 + uTime * 2.0 + uScroll * 5.0) * 0.5 + 0.5;
  float gridRipple = ripple * (intensity - 0.15) * 0.15;

  // Edge fade
  float edgeFade = 1.0 - smoothstep(0.2, 0.8, abs(uv.x - 0.5) * 1.8);
  edgeFade *= 1.0 - smoothstep(0.2, 0.8, abs(uv.y - 0.5) * 1.8);
  gridLine *= edgeFade;

  // ── Speed lines (intensity-based, no separate velocity check needed) ──
  float speedLines = 0.0;
  float speedFactor = max(0.0, intensity - 0.15) * 1.5; // 0 when at baseline, up to ~1.0 at peak

  // Dense speed lines — frequency increases with intensity
  float density = 30.0 + intensity * 50.0;
  float lineNoise = noise(vec2(pos.x * density, pos.y * 4.0 + uTime * 2.0));
  speedLines = smoothstep(0.2, 0.55, lineNoise) * speedFactor * 0.6;

  // Fast horizontal streaks
  float streakSpeed = 5.0 + intensity * 8.0;
  float streak = fract(pos.y * 25.0 - uTime * streakSpeed);
  speedLines += smoothstep(0.0, 0.03, streak) * speedFactor * 0.4 *
                (sin(pos.x * 10.0 + uTime) * 0.5 + 0.5);

  // Whoosh walls — sweeping light beams, always active but stronger at higher intensity
  float whoosh = fract(uTime * (0.8 + intensity * 0.4) - pos.x * 0.5 + uScroll * 3.0);
  float whooshLine = smoothstep(0.0, 0.06, whoosh) * (1.0 - smoothstep(0.1, 0.25, whoosh));
  speedLines += whooshLine * speedFactor * 0.5;

  // Second whoosh
  float whoosh2 = fract(uTime * (1.2 + intensity * 0.3) + pos.y * 0.3 - uScroll * 4.0);
  float whooshLine2 = smoothstep(0.0, 0.04, whoosh2) * (1.0 - smoothstep(0.07, 0.18, whoosh2));
  speedLines += whooshLine2 * speedFactor * 0.3;

  speedLines *= edgeFade;

  // ── Scroll glow bands ──
  float scrollBand = 0.0;
  for (int i = 0; i < 4; i++) {
    float fi = float(i);
    float bandPos = fract(uScroll * 2.5 + fi * 0.25 + uTime * 0.03);
    float band = 1.0 - smoothstep(0.0, 0.12, abs(pos.y - bandPos));
    band *= sin(uv.x * 3.14159 * 2.0 + fi * 2.0 + uTime * 0.5) * 0.5 + 0.5;
    // Amplification: baseline bands get boost from intensity
    scrollBand += band * (0.03 + intensity * 0.04);
  }

  // ── Travelling pulses ──
  float pulse1 = sin(pos.x * 8.0 + uTime * 1.2 + uScroll * 3.0) * 0.5 + 0.5;
  float pulse2 = sin(pos.y * 6.0 - uTime * 0.9 + pos.x * 3.0 + uScroll * 2.0) * 0.5 + 0.5;
  float pulse = pulse1 * pulse2 * (1.0 + intensity * 2.0);

  // ── Organic flow ──
  float flow = fbm(pos * 3.0 + vec2(uTime * 0.02, uScroll * 0.5));
  float scrollFlow = flow * (0.04 + intensity * 0.06);

  // ── Colors ──
  vec3 magenta = vec3(1.0, 0.231, 0.549);
  vec3 cyan = vec3(0.0, 0.961, 1.0);
  vec3 darkBg = vec3(0.02, 0.027, 0.05);

  // Accent color shifts with pulse + scroll position
  float blend = pulse * 0.4 + uv.x * 0.15;
  vec3 accentColor = mix(magenta, cyan, blend);

  // ── Build final color ──
  vec3 color = darkBg;

  // Grid
  color = mix(color, accentColor, gridLine * 0.25);
  color += accentColor * gridRipple;

  // Speed lines
  color += magenta * speedLines * 1.2;
  color += vec3(0.9, 0.5, 0.9) * speedLines * 0.3;

  // Glow bands
  vec3 bandColor = mix(magenta, cyan, sin(uScroll * 3.0 + uTime * 0.2) * 0.5 + 0.5);
  color += bandColor * scrollBand;

  // Organic flow
  color += accentColor * scrollFlow;

  // Noise texture
  float n = noise(uv * 4.0 + uTime * 0.02);
  color += vec3(n * 0.03, n * 0.02, n * 0.05);

  // Pulse highlights
  float pulseHighlight = pulse * gridLine * 0.15;
  color += accentColor * pulseHighlight;

  // Vignette
  float vignette = 1.0 - length(uv - 0.5) * 0.7;
  color *= vignette;

  gl_FragColor = vec4(color, uOpacity);
}
`;
