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
uniform float uOpacity;

varying vec2 vUv;

// 2D noise
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

// FBM noise for organic movement
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

  // ── Base grid ──
  vec2 grid = abs(fract(pos * 24.0 - 0.5) - 0.5);
  float gridX = 1.0 - smoothstep(0.0, 0.012, grid.x);
  float gridY = 1.0 - smoothstep(0.0, 0.012, grid.y);
  float gridLine = max(gridX, gridY);

  // Edge fade on grid
  float edgeFade = 1.0 - smoothstep(0.2, 0.8, abs(uv.x - 0.5) * 1.8);
  edgeFade *= 1.0 - smoothstep(0.2, 0.8, abs(uv.y - 0.5) * 1.8);
  gridLine *= edgeFade;

  // ── Scroll velocity: speed lines ──
  float speedLines = 0.0;
  if (uScrollVelocity > 0.05) {
    float speedIntensity = smoothstep(0.05, 0.5, uScrollVelocity);
    // Horizontal speed lines (like Tron light cycles)
    float lineNoise = noise(vec2(pos.x * 40.0, pos.y * 4.0 + uTime * 2.0));
    speedLines = smoothstep(0.3, 0.7, lineNoise) * speedIntensity * 0.3;
    // Directional streaks based on scroll direction
    float streak = fract(pos.y * 30.0 - uTime * uScrollVelocity * 5.0);
    speedLines += smoothstep(0.0, 0.05, streak) * speedIntensity * 0.2;
    speedLines *= edgeFade;
  }

  // ── Scroll-reactive glow bands ──
  float scrollBand = 0.0;
  // Moving bands that follow scroll position
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    float bandPos = fract(uScroll * 2.0 + fi * 0.33 + uTime * 0.05);
    float band = 1.0 - smoothstep(0.0, 0.15, abs(pos.y - bandPos));
    band *= sin(uv.x * 3.14159 * 2.0 + fi * 2.0) * 0.5 + 0.5;
    scrollBand += band * (0.04 - fi * 0.01);
  }

  // ── Section-aware color shift ──
  // uSection 0-1 smoothly transitions through sections
  float sectionShift = sin(uSection * 3.14159 * 2.0) * 0.5 + 0.5;

  // ── Travelling pulses ──
  float pulse1 = sin(pos.x * 8.0 + uTime * 1.2 + uScroll * 3.0) * 0.5 + 0.5;
  float pulse2 = sin(pos.y * 6.0 - uTime * 0.9 + pos.x * 3.0 + uScroll * 2.0) * 0.5 + 0.5;
  float pulse = pulse1 * pulse2;

  // ── Scroll-responsive organic flow ──
  float flow = fbm(pos * 3.0 + vec2(uTime * 0.03, uScroll * 0.5));
  float scrollFlow = flow * 0.06 * (1.0 + uScrollVelocity * 2.0);

  // ── Mouse interaction ──
  float dist = length(uv - uMouse);
  float mouseGlow = 0.08 / (dist * 4.0 + 0.5);
  float mouseRing = smoothstep(0.02, 0.0, abs(dist - 0.15)) * 0.3;

  // ── Colors ──
  vec3 magenta = vec3(1.0, 0.231, 0.549);
  vec3 cyan = vec3(0.0, 0.961, 1.0);
  vec3 darkBg = vec3(0.02, 0.027, 0.05);

  // Blended accent shifts with section
  float blend = pulse * 0.4 + uv.x * 0.15 + sectionShift * 0.15;
  vec3 accentColor = mix(magenta, cyan, blend);

  // ── Build final color ──
  vec3 color = darkBg;

  // Grid with accent
  color = mix(color, accentColor, gridLine * 0.25);

  // Speed lines (magenta tinted)
  color += magenta * speedLines * 0.8;
  color += vec3(0.8, 0.8, 1.0) * speedLines * 0.2;

  // Scroll glow bands
  float bandIntensity = scrollBand * (1.0 + uScrollVelocity * 3.0);
  vec3 bandColor = mix(magenta, cyan, sin(uScroll * 3.0 + uTime * 0.2) * 0.5 + 0.5);
  color += bandColor * bandIntensity;

  // Organic flow
  color += accentColor * scrollFlow;

  // Noise texture
  float n = noise(uv * 4.0 + uTime * 0.02);
  color += vec3(n * 0.03, n * 0.02, n * 0.05);

  // Mouse interaction
  color += magenta * mouseGlow * 0.2;
  color += cyan * mouseRing;

  // Pulse highlights on grid
  float pulseHighlight = pulse * gridLine * 0.15;
  color += accentColor * pulseHighlight;

  // Vignette
  float vignette = 1.0 - length(uv - 0.5) * 0.7;
  color *= vignette;

  gl_FragColor = vec4(color, uOpacity);
}
`;
