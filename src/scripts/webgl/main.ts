import * as THREE from 'three';
import { vertexShader, fragmentShader } from './shaders';

interface SceneState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  shaderMaterial: THREE.ShaderMaterial;
  mesh: THREE.Mesh;
  mouse: THREE.Vector2;
  targetMouse: THREE.Vector2;
  scroll: number;
  scrollVelocity: number;
  objects: THREE.Mesh[];
  clock: THREE.Clock;
  running: boolean;
  rafId: number;
  lastScrollY: number;
  cleanupFns: (() => void)[];
}

let state: SceneState | null = null;

function getWebGLCanvas(): HTMLCanvasElement | null {
  return document.getElementById('webgl-canvas') as HTMLCanvasElement | null;
}

export function initScene(): void {
  const canvas = getWebGLCanvas();
  if (!canvas || state) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    canvas.style.display = 'none';
    return;
  }

  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance',
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const uniforms = {
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    uTime: { value: 0 },
    uScroll: { value: 0 },
    uScrollVelocity: { value: 0 },
    uIntensity: { value: 0.15 },
    uOpacity: { value: 1.0 },
  };

  const shaderMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthWrite: false,
  });

  const geometry = new THREE.PlaneGeometry(2, 2);
  const mesh = new THREE.Mesh(geometry, shaderMaterial);
  scene.add(mesh);

  // ── 3D foreground objects ──
  const objectGroup = new THREE.Group();
  scene.add(objectGroup);

  const objects: THREE.Mesh[] = [];

  // Floating geometries
  const colors = [new THREE.Color('#00f5ff'), new THREE.Color('#ff3b8c'), new THREE.Color('#ff3b8c'), new THREE.Color('#00f5ff')];
  const positions = [
    { x: -0.6, y: -0.3 },
    { x: 0.7, y: -0.5 },
    { x: -0.3, y: 0.6 },
    { x: 0.8, y: 0.5 },
  ];

  for (let i = 0; i < 4; i++) {
    const size = 0.03 + Math.random() * 0.06;
    const geo = new THREE.IcosahedronGeometry(size, 0);
    const mat = new THREE.MeshPhysicalMaterial({
      color: colors[i % colors.length],
      emissive: colors[i % colors.length],
      emissiveIntensity: 0.2,
      metalness: 0.5,
      roughness: 0.3,
      transparent: true,
      opacity: 0.6,
      wireframe: i === 1,
    });
    const obj = new THREE.Mesh(geo, mat);
    obj.position.set(positions[i].x, positions[i].y, 0);
    obj.userData = {
      floatOffset: Math.random() * Math.PI * 2,
      rotSpeed: 0.3 + Math.random() * 0.5,
      floatSpeed: 0.3 + Math.random() * 0.5,
      floatAmp: 0.02 + Math.random() * 0.04,
      basePos: new THREE.Vector3(positions[i].x, positions[i].y, 0),
      scrollAmp: 0.05 + Math.random() * 0.08,
      fadePhase: Math.random() * Math.PI * 2,
      fadeSpeed: 0.15 + Math.random() * 0.2,
    };
    objectGroup.add(obj);
    objects.push(obj);
  }

  /* ── Event handlers ── */

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const aspect = w / h;
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    uniforms.uResolution.value.set(w, h);
    // Proper orthographic aspect handling
    if (aspect > 1) {
      camera.left = -aspect;
      camera.right = aspect;
      camera.top = 1;
      camera.bottom = -1;
    } else {
      camera.left = -1;
      camera.right = 1;
      camera.top = 1 / aspect;
      camera.bottom = -1 / aspect;
    }
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  cleanupFns.push(() => window.removeEventListener('resize', resize));
  resize();

  // Mouse
  const mouse = new THREE.Vector2(0.5, 0.5);
  const targetMouse = new THREE.Vector2(0.5, 0.5);

  function onMouse(e: MouseEvent) {
    targetMouse.x = e.clientX / window.innerWidth;
    targetMouse.y = 1 - e.clientY / window.innerHeight;
  }
  function onTouch(e: TouchEvent) {
    if (e.touches.length > 0) {
      targetMouse.x = e.touches[0].clientX / window.innerWidth;
      targetMouse.y = 1 - e.touches[0].clientY / window.innerHeight;
    }
  }
  window.addEventListener('mousemove', onMouse);
  cleanupFns.push(() => window.removeEventListener('mousemove', onMouse));
  window.addEventListener('touchmove', onTouch, { passive: true });
  cleanupFns.push(() => window.removeEventListener('touchmove', onTouch));

  // Scroll — velocity-only tracking (no sections)
  let scroll = 0;
  let scrollVelocity = 0;
  let lastScrollY = window.scrollY;
  let velocitySmooth = 0;
  const cleanupFns: (() => void)[] = [];

  function onScroll() {
    const current = window.scrollY;
    const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
    scroll = Math.min(current / maxScroll, 1);
    const delta = Math.abs(current - lastScrollY);
    scrollVelocity = delta / 16;
    lastScrollY = current;
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  cleanupFns.push(() => window.removeEventListener('scroll', onScroll));

  /* ── Animation loop ── */
  const clock = new THREE.Clock();
  let running = true;

  function animate() {
    if (!running) return;
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    // Smooth mouse
    mouse.x += (targetMouse.x - mouse.x) * 0.05;
    mouse.y += (targetMouse.y - mouse.y) * 0.05;

    // Velocity smoothing & decay
    velocitySmooth += (scrollVelocity - velocitySmooth) * 0.08;
    scrollVelocity *= 0.85;

    // Intensity: baseline 0.15 + velocity contribution (peaks ~0.8 on fast scroll, decays to baseline)
    const intensity = 0.15 + Math.min(velocitySmooth * 0.7, 0.65);

    uniforms.uTime.value = elapsed;
    uniforms.uScroll.value = scroll;
    uniforms.uScrollVelocity.value = Math.min(velocitySmooth, 2.0);
    uniforms.uIntensity.value = intensity;
    uniforms.uMouse.value.set(mouse.x, mouse.y);

    // Animate 3D objects with scroll reactivity
    objects.forEach((obj, i) => {
      const data = obj.userData;
      // Rotation
      obj.rotation.x += delta * data.rotSpeed;
      obj.rotation.y += delta * data.rotSpeed * 0.7;

      // Base floating
      obj.position.x = data.basePos.x
        + Math.sin(elapsed * data.floatSpeed + data.floatOffset) * data.floatAmp;
      obj.position.y = data.basePos.y
        + Math.cos(elapsed * data.floatSpeed * 0.8 + data.floatOffset) * data.floatAmp;

      // Scroll-responsive vertical drift
      const scrollDrift = (scroll - 0.5) * data.scrollAmp;
      obj.position.y += scrollDrift;

      // Z-axis breathing with scroll velocity
      obj.position.z = -Math.abs(Math.sin(elapsed * 0.5 + data.floatOffset) * 0.05 + velocitySmooth * 0.02);

      // Mouse repulsion with restoring spring
      const dx = mouse.x - (obj.position.x * 0.5 + 0.5);
      const dy = mouse.y - (obj.position.y * 0.5 + 0.5);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.3) {
        const push = (1 - dist / 0.3) * 0.08;
        obj.position.x -= dx * push;
        obj.position.y -= dy * push;
      }
      // Gentle spring back to floating path
      const idealX = data.basePos.x
        + Math.sin(elapsed * data.floatSpeed + data.floatOffset) * data.floatAmp;
      const idealY = data.basePos.y
        + Math.cos(elapsed * data.floatSpeed * 0.8 + data.floatOffset) * data.floatAmp
        + (scroll - 0.5) * data.scrollAmp;
      obj.position.x += (idealX - obj.position.x) * 0.005;
      obj.position.y += (idealY - obj.position.y) * 0.005;

      // Smooth fade in/out oscillation
      const fadeVal = Math.sin(elapsed * data.fadeSpeed + data.fadePhase) * 0.5 + 0.5;
      obj.material.opacity = 0.1 + fadeVal * 0.55;
    });

    renderer.render(scene, camera);
    state!.rafId = requestAnimationFrame(animate);
  }

  state = {
    renderer, scene, camera, shaderMaterial, mesh,
    mouse, targetMouse, scroll, scrollVelocity,
    objects, clock, running, rafId: 0, lastScrollY,
    cleanupFns,
  };

  animate();
}

export function destroyScene(): void {
  if (!state) return;
  state.running = false;
  if (state.rafId) cancelAnimationFrame(state.rafId);
  if (state.cleanupFns) state.cleanupFns.forEach(fn => fn());
  state.renderer.dispose();
  state = null;
}
