import * as THREE from 'three';
import { vertexShader, fragmentShader } from './shaders';

interface SceneState {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.OrthographicCamera;
  shaderMaterial: THREE.ShaderMaterial;
  mesh: THREE.Mesh;
  time: number;
  mouse: THREE.Vector2;
  targetMouse: THREE.Vector2;
  scroll: number;
  objects: THREE.Mesh[];
  clock: THREE.Clock;
  running: boolean;
  rafId: number;
}

let state: SceneState | null = null;

function getWebGLCanvas(): HTMLCanvasElement | null {
  let canvas = document.getElementById('webgl-canvas') as HTMLCanvasElement | null;
  return canvas;
}

export function initScene(): void {
  const canvas = getWebGLCanvas();
  if (!canvas || state) return;

  // Check reduced motion
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

  // Add 3D objects in foreground
  const objectGroup = new THREE.Group();
  scene.add(objectGroup);

  const objects: THREE.Mesh[] = [];

  // Torus knot (hero)
  const knotGeo = new THREE.TorusKnotGeometry(0.15, 0.05, 64, 8);
  const knotMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#ff3b8c'),
    emissive: new THREE.Color('#ff3b8c'),
    emissiveIntensity: 0.3,
    metalness: 0.7,
    roughness: 0.2,
    wireframe: false,
    transparent: true,
    opacity: 0.9,
  });
  const knot = new THREE.Mesh(knotGeo, knotMat);
  knot.position.set(0.5, 0.1, 0);
  knot.scale.set(1, 1, 1);
  objectGroup.add(knot);
  objects.push(knot);

  // Secondary floating geometries
  const colors = [new THREE.Color('#00f5ff'), new THREE.Color('#ff3b8c'), new THREE.Color('#ff3b8c')];
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
    };
    objectGroup.add(obj);
    objects.push(obj);
  }

  // Resize handler
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio, 2);
    renderer.setSize(w, h);
    renderer.setPixelRatio(dpr);
    uniforms.uResolution.value.set(w, h);
  }
  window.addEventListener('resize', resize);
  resize();

  // Mouse handler
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

  // Scroll handler
  let scroll = 0;
  function onScroll() {
    scroll = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight);
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  // Animation loop
  const clock = new THREE.Clock();
  let running = true;

  function animate() {
    if (!running) return;
    const delta = clock.getDelta();
    const elapsed = clock.getElapsedTime();

    // Smooth mouse
    mouse.x += (targetMouse.x - mouse.x) * 0.05;
    mouse.y += (targetMouse.y - mouse.y) * 0.05;

    uniforms.uTime.value = elapsed;
    uniforms.uScroll.value = scroll;
    uniforms.uMouse.value.set(mouse.x, mouse.y);

    // Animate objects
    objects.forEach((obj, i) => {
      const data = obj.userData;
      obj.rotation.x += delta * data.rotSpeed;
      obj.rotation.y += delta * data.rotSpeed * 0.7;
      obj.position.x = data.basePos.x + Math.sin(elapsed * data.floatSpeed + data.floatOffset) * data.floatAmp;
      obj.position.y = data.basePos.y + Math.cos(elapsed * data.floatSpeed * 0.8 + data.floatOffset) * data.floatAmp;
      obj.position.z = Math.sin(elapsed * 0.5 + data.floatOffset) * 0.05;

      // React to mouse proximity
      const dx = mouse.x - (obj.position.x * 0.5 + 0.5);
      const dy = mouse.y - (obj.position.y * 0.5 + 0.5);
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 0.3) {
        const push = (1 - dist / 0.3) * 0.08;
        obj.position.x -= dx * push;
        obj.position.y -= dy * push;
      }
    });

    // Torus knot floats toward mouse slightly
    const mtX = (mouse.x - 0.5) * 0.15;
    const mtY = (mouse.y - 0.5) * 0.1;
    knot.position.x = 0.5 + mtX + Math.sin(elapsed * 0.4) * 0.03;
    knot.position.y = 0.1 + mtY + Math.cos(elapsed * 0.3) * 0.03;
    knot.rotation.x = elapsed * 0.4;
    knot.rotation.y = elapsed * 0.6;

    renderer.render(scene, camera);
    state!.rafId = requestAnimationFrame(animate);
  }

  state = {
    renderer, scene, camera, shaderMaterial,
    mesh, time: 0, mouse, targetMouse, scroll,
    objects, clock, running, rafId: 0,
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
