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

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  float aspect = uResolution.x / uResolution.y;
  vec2 pos = uv;

  // Grid lines
  vec2 grid = abs(fract(pos * 24.0 - 0.5) - 0.5);
  float gridX = 1.0 - smoothstep(0.0, 0.012, grid.x);
  float gridY = 1.0 - smoothstep(0.0, 0.012, grid.y);
  float gridLine = max(gridX, gridY);

  // Fade grid toward edges
  float edgeFade = 1.0 - smoothstep(0.2, 0.8, abs(uv.x - 0.5) * 1.8);
  edgeFade *= 1.0 - smoothstep(0.2, 0.8, abs(uv.y - 0.5) * 1.8);
  gridLine *= edgeFade;

  // Travelling pulse waves
  float pulse1 = sin(pos.x * 8.0 + uTime * 1.2) * 0.5 + 0.5;
  float pulse2 = sin(pos.y * 6.0 - uTime * 0.9 + pos.x * 3.0) * 0.5 + 0.5;
  float pulse = pulse1 * pulse2;

  // Scroll-responsive glow bands
  float scrollBand = sin(pos.y * 12.0 - uScroll * 2.0 + uTime * 0.3) * 0.5 + 0.5;
  scrollBand *= 1.0 - smoothstep(0.0, 0.15, abs(pos.x - 0.5));

  // Mouse interaction
  float dist = length(uv - uMouse);
  float mouseGlow = 0.08 / (dist * 4.0 + 0.5);
  float mouseRing = smoothstep(0.02, 0.0, abs(dist - 0.15)) * 0.3;

  // Colors
  vec3 magenta = vec3(1.0, 0.231, 0.549);
  vec3 cyan = vec3(0.0, 0.961, 1.0);
  vec3 darkBg = vec3(0.02, 0.027, 0.05);

  // Mix colors based on pulse + position
  float blend = pulse * 0.4 + uv.x * 0.2 + 0.1;
  vec3 accentColor = mix(magenta, cyan, blend);

  // Build final color
  vec3 color = darkBg;

  // Grid with accent
  color = mix(color, accentColor, gridLine * 0.25);

  // Scroll-responsive glow bands
  float bandIntensity = scrollBand * 0.04;
  vec3 bandColor = mix(magenta, cyan, sin(uScroll * 0.5 + uTime * 0.2) * 0.5 + 0.5);
  color += bandColor * bandIntensity;

  // Noise distortion
  float n = noise(uv * 4.0 + uTime * 0.02) * 0.03;
  color += vec3(n * 0.5, n * 0.3, n * 0.8);

  // Mouse interaction
  color += magenta * mouseGlow * 0.2;
  color += cyan * mouseRing;

  // Pulse highlights
  float pulseHighlight = pulse * gridLine * 0.15;
  color += accentColor * pulseHighlight;

  // Vignette
  float vignette = 1.0 - length(uv - 0.5) * 0.8;
  color *= vignette;

  gl_FragColor = vec4(color, uOpacity);
}
`;
