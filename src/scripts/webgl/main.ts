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
  section: number;
  sectionTransition: number;
  objects: THREE.Mesh[];
  clock: THREE.Clock;
  running: boolean;
  rafId: number;
  lastScrollY: number;
}

let state: SceneState | null = null;

function getWebGLCanvas(): HTMLCanvasElement | null {
  return document.getElementById('webgl-canvas') as HTMLCanvasElement | null;
}

/* ── Section boundary cache ── */
let sectionBoundaries: { top: number; bottom: number; center: number; idx: number }[] = [];
let sectionScrollMargin = 80; // nav + padding

function cacheSectionBoundaries() {
  const els = document.querySelectorAll<HTMLElement>('.hero, section[id], .bio-hero, .project-page, .projects-page');
  sectionBoundaries = [];
  els.forEach((el, idx) => {
    const rect = el.getBoundingClientRect();
    const top = window.scrollY + rect.top;
    const bottom = top + rect.height;
    sectionBoundaries.push({ top, bottom, center: (top + bottom) / 2, idx });
  });
}

function getCurrentSection(): number {
  if (!sectionBoundaries.length) return 0;
  const viewportCenter = window.scrollY + window.innerHeight / 2;
  let best = 0, bestDist = Infinity;
  for (let i = 0; i < sectionBoundaries.length; i++) {
    const dist = Math.abs(viewportCenter - sectionBoundaries[i].center);
    if (dist < bestDist) { bestDist = dist; best = i; }
  }
  return best / Math.max(sectionBoundaries.length - 1, 1);
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
    uSection: { value: 0 },
    uSectionTransition: { value: 0 },
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
    renderer.setSize(w, h);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    uniforms.uResolution.value.set(w, h);
  }
  window.addEventListener('resize', () => {
    resize();
    cacheSectionBoundaries(); // recalculate on resize
  });
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
  window.addEventListener('touchmove', onTouch, { passive: true });

  // Scroll — velocity tracking + section transition
  let scroll = 0;
  let scrollVelocity = 0;
  let section = 0;
  let sectionTransition = 0;
  let lastScrollY = window.scrollY;
  let velocitySmooth = 0;
  let transitionSmooth = 0;

  function getSectionTransition(): number {
    if (sectionBoundaries.length < 2) return 0;
    const scrollPos = window.scrollY;
    const margin = sectionScrollMargin;

    // Find the nearest section snap point above and below scroll position
    // Snap point = section top minus the scroll-margin (accounts for nav overlap)
    let snapAbove = -Infinity;
    let snapBelow = Infinity;
    for (const s of sectionBoundaries) {
      const snap = s.top - margin;
      if (snap <= scrollPos && snap > snapAbove) snapAbove = snap;
      if (snap > scrollPos && snap < snapBelow) snapBelow = snap;
    }

    // At or above the first snap point, or at/below the last → no transition
    if (snapAbove === -Infinity || snapBelow === Infinity) return 0;

    // Transition = how far we are between the two snap points (0→1)
    const range = snapBelow - snapAbove;
    if (range <= 0) return 0;
    return Math.min(1, (scrollPos - snapAbove) / range);
  }

  // Cache boundaries on init + resize
  cacheSectionBoundaries();

  function onScroll() {
    const current = window.scrollY;
    scroll = current / (document.documentElement.scrollHeight - window.innerHeight);
    const delta = Math.abs(current - lastScrollY);
    scrollVelocity = delta / 16;
    lastScrollY = current;
    section = getCurrentSection();
    sectionTransition = getSectionTransition();
  }
  window.addEventListener('scroll', onScroll, { passive: true });

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

    // Smooth scroll velocity + section transition
    velocitySmooth += (scrollVelocity - velocitySmooth) * 0.08;
    scrollVelocity *= 0.85;
    transitionSmooth += (sectionTransition - transitionSmooth) * 0.05;

    uniforms.uTime.value = elapsed;
    uniforms.uScroll.value = scroll;
    uniforms.uScrollVelocity.value = Math.min(velocitySmooth, 2.0);
    uniforms.uSection.value = section;
    uniforms.uSectionTransition.value = 0.15 + Math.min(transitionSmooth, 0.85); // baseline 0.15 = subtle background glow
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
      obj.position.z = Math.sin(elapsed * 0.5 + data.floatOffset) * 0.05
        + velocitySmooth * 0.02;

      // Mouse repulsion
      const dx = mouse.x - (obj.position.x * 0.5 + 0.5);
      const dy = mouse.y - (obj.position.y * 0.5 + 0.5);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.3) {
        const push = (1 - dist / 0.3) * 0.08;
        obj.position.x -= dx * push;
        obj.position.y -= dy * push;
      }

      // Smooth fade in/out oscillation
      const fadeVal = Math.sin(elapsed * data.fadeSpeed + data.fadePhase) * 0.5 + 0.5;
      obj.material.opacity = 0.1 + fadeVal * 0.55;
    });


    renderer.render(scene, camera);
    state!.rafId = requestAnimationFrame(animate);
  }

  state = {
    renderer, scene, camera, shaderMaterial, mesh,
    mouse, targetMouse, scroll, scrollVelocity, section,
    sectionTransition, objects, clock, running, rafId: 0, lastScrollY,
  };

  animate();
}

export function destroyScene(): void {
  if (!state) return;
  state.running = false;
  cancelAnimationFrame(state.rafId);
  state.renderer.dispose();
  state = null;
}
