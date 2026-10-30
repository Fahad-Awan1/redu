import * as THREE from 'three';

// Particle field that starts as a cloud of coloured PET "flakes" (waste)
// and reassembles into a ball-and-stick BHET molecule (W2V Monomer).

const WASTE_COLORS = ['#FF5A2C', '#FF8A3D', '#2EE6C5', '#2F7BFF', '#3FB45F', '#F2C230', '#B9C2BE', '#6B4CFF', '#1A1F1D'];
const C_COLOR = new THREE.Color('#EEF0EA');
const O_COLOR = new THREE.Color('#C8FF2E');
const H_COLOR = new THREE.Color('#2EE6C5');
const BOND_COLOR = new THREE.Color('#9AA6A1');

function bhet() {
  // 2D skeleton of bis(2-hydroxyethyl) terephthalate, roughly to scale (Å-ish units)
  const atoms = [];
  const bonds = [];
  const add = (x, y, el) => (atoms.push({ p: new THREE.Vector3(x, y, 0), el }), atoms.length - 1);
  const ring = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ring.push(add(Math.cos(a) * 1.4, Math.sin(a) * 1.4, 'C'));
  }
  for (let i = 0; i < 6; i++) bonds.push([ring[i], ring[(i + 1) % 6], i % 2 ? 1 : 2]);
  for (const i of [1, 2, 4, 5]) {
    const a = (i / 6) * Math.PI * 2;
    const h = add(Math.cos(a) * 2.45, Math.sin(a) * 2.45, 'H');
    bonds.push([ring[i], h, 1]);
  }
  for (const s of [1, -1]) {
    const c7 = add(2.85 * s, 0, 'C');
    const o8 = add(3.6 * s, 1.25 * s, 'O');
    const o9 = add(3.6 * s, -1.25 * s, 'O');
    const c10 = add(5.05 * s, -1.25 * s, 'C');
    const c11 = add(5.8 * s, 0, 'C');
    const o12 = add(7.25 * s, 0, 'O');
    const h12 = add(7.95 * s, 0.95 * s, 'H');
    bonds.push([s > 0 ? ring[0] : ring[3], c7, 1], [c7, o8, 2], [c7, o9, 1], [o9, c10, 1], [c10, c11, 1], [c11, o12, 1], [o12, h12, 1]);
  }
  // give it a slight 3D twist so it reads as an object when it rotates
  atoms.forEach(({ p }) => { p.z = Math.sin(p.x * 0.55) * 0.9; });
  return { atoms, bonds };
}

function randInSphere(r) {
  const u = Math.random(), v = Math.random();
  const th = u * Math.PI * 2, ph = Math.acos(2 * v - 1);
  return new THREE.Vector3(Math.sin(ph) * Math.cos(th), Math.sin(ph) * Math.sin(th), Math.cos(ph)).multiplyScalar(r);
}

function buildTargets(N) {
  const posA = new Float32Array(N * 3), posB = new Float32Array(N * 3);
  const colA = new Float32Array(N * 3), colB = new Float32Array(N * 3);
  const rnd = new Float32Array(N), size = new Float32Array(N);

  // ---- state A: waste flakes ----
  const FLAKES = 46;
  const flakes = [];
  for (let f = 0; f < FLAKES; f++) {
    const c = new THREE.Vector3((Math.random() - 0.5) * 20, (Math.random() - 0.5) * 11, (Math.random() - 0.5) * 9);
    const n = randInSphere(1).normalize();
    const u = new THREE.Vector3().crossVectors(n, new THREE.Vector3(0, 1, 0.3)).normalize();
    const v = new THREE.Vector3().crossVectors(n, u).normalize();
    flakes.push({ c, u, v, r: 0.35 + Math.random() * 0.9, col: new THREE.Color(WASTE_COLORS[f % WASTE_COLORS.length]), k: 3 + Math.floor(Math.random() * 4) });
  }

  // ---- state B: molecule ----
  const { atoms, bonds } = bhet();
  const S = 0.62;
  const rad = { C: 0.42, O: 0.46, H: 0.22 };
  const atomW = atoms.map(a => rad[a.el] ** 2);
  const atomWSum = atomW.reduce((a, b) => a + b, 0);
  const bondLen = bonds.map(([a, b]) => atoms[a].p.distanceTo(atoms[b].p));
  const bondSum = bondLen.reduce((a, b) => a + b, 0);
  const pick = (weights, sum) => { let r = Math.random() * sum; for (let i = 0; i < weights.length; i++) { r -= weights[i]; if (r <= 0) return i; } return weights.length - 1; };

  const tmp = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    const r = Math.random();
    rnd[i] = Math.random();

    // A
    const fl = flakes[i % FLAKES];
    const ang = Math.random() * Math.PI * 2;
    // irregular shard outline
    const edge = fl.r * (0.6 + 0.4 * Math.abs(Math.sin(ang * fl.k + fl.r * 10)));
    const d = Math.sqrt(Math.random()) * edge;
    tmp.copy(fl.c).addScaledVector(fl.u, Math.cos(ang) * d).addScaledVector(fl.v, Math.sin(ang) * d);
    if (Math.random() < 0.12) tmp.add(randInSphere(Math.random() * 6)); // dust between flakes
    tmp.toArray(posA, i * 3);
    const shade = 0.75 + Math.random() * 0.4;
    colA[i * 3] = fl.col.r * shade; colA[i * 3 + 1] = fl.col.g * shade; colA[i * 3 + 2] = fl.col.b * shade;

    // B
    let col;
    if (r < 0.58) {
      const a = atoms[pick(atomW, atomWSum)];
      tmp.copy(a.p).multiplyScalar(S).add(randInSphere(rad[a.el] * S * 1.6).normalize().multiplyScalar(rad[a.el] * (0.85 + Math.random() * 0.25)));
      col = a.el === 'C' ? C_COLOR : a.el === 'O' ? O_COLOR : H_COLOR;
      size[i] = 1.0 + Math.random() * 0.7;
    } else if (r < 0.93) {
      const bi = pick(bondLen, bondSum);
      const [a, b, order] = bonds[bi];
      const t = Math.random();
      tmp.lerpVectors(atoms[a].p, atoms[b].p, t);
      if (order === 2) {
        const dir = new THREE.Vector3().subVectors(atoms[b].p, atoms[a].p).normalize();
        const perp = new THREE.Vector3(-dir.y, dir.x, 0);
        tmp.addScaledVector(perp, Math.random() < 0.5 ? 0.13 : -0.13);
      }
      tmp.multiplyScalar(S).add(randInSphere(0.035));
      col = BOND_COLOR;
      size[i] = 0.7 + Math.random() * 0.4;
    } else {
      // electron halo
      const t = Math.random() * Math.PI * 2;
      tmp.set(Math.cos(t) * 6.2, Math.sin(t) * 2.1, Math.sin(t * 2) * 0.6).add(randInSphere(0.15));
      col = O_COLOR;
      size[i] = 0.5 + Math.random() * 0.5;
    }
    tmp.toArray(posB, i * 3);
    colB[i * 3] = col.r; colB[i * 3 + 1] = col.g; colB[i * 3 + 2] = col.b;
  }
  return { posA, posB, colA, colB, rnd, size };
}

const vert = /* glsl */`
  attribute vec3 posB;
  attribute vec3 colA;
  attribute vec3 colB;
  attribute float aRnd;
  attribute float aSize;
  uniform float uTime;
  uniform float uProgress;
  uniform float uIntro;
  uniform float uPixel;
  uniform vec3 uMouse;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = aRnd * 0.35;
    float p = smoothstep(d, d + 0.65, uProgress);
    vec3 pos = mix(position, posB, p);

    // waste drifts
    pos += (1.0 - p) * vec3(sin(uTime * 0.6 + aRnd * 40.0), cos(uTime * 0.5 + aRnd * 30.0), sin(uTime * 0.4 + aRnd * 20.0)) * 0.22;
    // reaction turbulence while bonds break and reform
    float t = sin(p * 3.14159);
    vec3 dir = normalize(vec3(sin(aRnd * 91.0), cos(aRnd * 57.0), sin(aRnd * 13.0 + 1.0)));
    pos += t * dir * 2.4 * (0.4 + aRnd);
    // molecule shimmer
    pos += p * dir * sin(uTime * 2.2 + aRnd * 50.0) * 0.02;

    // intro: particles condense from far away
    float ip = smoothstep(aRnd * 0.5, aRnd * 0.5 + 0.5, uIntro);
    pos = mix(dir * (26.0 + aRnd * 14.0), pos, ip);

    // mouse repulsion (in object space, approx)
    vec3 toM = pos - uMouse;
    float md = length(toM.xy);
    pos.xy += normalize(toM.xy + 0.0001) * smoothstep(2.6, 0.0, md) * 1.1 * (1.0 - p); // finished molecule stays intact

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uPixel * mix(1.25, 1.0, p) * (28.0 / -mv.z);

    vColor = mix(colA, colB, p) + t * vec3(0.78, 1.0, 0.18) * 0.55;
    vAlpha = mix(0.9, 1.0, p) * ip;
  }
`;

const frag = /* glsl */`
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.05, r);
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor, a * vAlpha);
  }
`;

export function createHeroGL(canvas, { mobile = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: 'high-performance' });
  const dpr = Math.min(window.devicePixelRatio, mobile ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  camera.position.set(0, 0, 18);

  const N = mobile ? 7000 : 16000;
  const t = buildTargets(N);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(t.posA, 3));
  geo.setAttribute('posB', new THREE.BufferAttribute(t.posB, 3));
  geo.setAttribute('colA', new THREE.BufferAttribute(t.colA, 3));
  geo.setAttribute('colB', new THREE.BufferAttribute(t.colB, 3));
  geo.setAttribute('aRnd', new THREE.BufferAttribute(t.rnd, 1));
  geo.setAttribute('aSize', new THREE.BufferAttribute(t.size, 1));

  const uniforms = {
    uTime: { value: 0 }, uProgress: { value: 0 }, uIntro: { value: 0 },
    uPixel: { value: dpr * (mobile ? 2.4 : 2.8) }, uMouse: { value: new THREE.Vector3(99, 99, 0) },
  };
  const mat = new THREE.ShaderMaterial({ vertexShader: vert, fragmentShader: frag, uniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  const points = new THREE.Points(geo, mat);
  const group = new THREE.Group();
  group.add(points);
  scene.add(group);

  const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  let lastPointer = -1e9;
  const wander = new THREE.Vector3();

  window.addEventListener('pointermove', (e) => {
    mouse.tx = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.ty = -(e.clientY / window.innerHeight) * 2 + 1;
    lastPointer = performance.now();
  });
  // phones: tilt the scene with the device (no permission prompt needed on Android)
  if (mobile) {
    window.addEventListener('deviceorientation', (e) => {
      if (e.gamma == null) return;
      mouse.tx = THREE.MathUtils.clamp(e.gamma / 30, -1, 1);
      mouse.ty = THREE.MathUtils.clamp((e.beta - 50) / 30, -1, 1);
    });
  }

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    // keep the molecule framed on the right on wide screens, centered on narrow
    const wide = w / h > 1.1;
    group.userData.baseX = wide ? 3.2 : 0;
    group.userData.baseY = wide ? 0.9 : 2.6;
    group.userData.scale = wide ? 1 : 0.46;
    group.userData.endY = wide ? 1.2 : 1.4;
    // portrait screens: stand the molecule upright so it fits the width
    group.userData.rotZ = wide ? 0 : Math.PI / 2;
  }
  resize();
  window.addEventListener('resize', resize);

  let visible = true;
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(canvas);

  const clock = new THREE.Clock();
  const inv = new THREE.Matrix4();
  function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    uniforms.uTime.value += dt;
    mouse.x += (mouse.tx - mouse.x) * 0.06;
    mouse.y += (mouse.ty - mouse.y) * 0.06;

    const p = uniforms.uProgress.value;
    const ud = group.userData;
    const time = uniforms.uTime.value;
    const sc = ud.scale * (1 + p * 0.3);
    group.scale.setScalar(sc);
    // drift to center stage as the molecule forms
    group.position.x = ud.baseX * (1 - p);
    group.position.y = ud.baseY * (1 - p) + p * ud.endY;
    // waste tumbles freely; the molecule only sways so it stays readable face-on
    group.rotation.y = mouse.x * 0.35 + (1 - p) * time * 0.06 + p * Math.sin(time * 0.45) * 0.45;
    group.rotation.x = -mouse.y * 0.18 + Math.sin(time * 0.3) * 0.08;
    group.rotation.z = (1 - p) * time * 0.02 + p * ud.rotZ;

    if (performance.now() - lastPointer < 2500) {
      ray.setFromCamera({ x: mouse.tx, y: mouse.ty }, camera);
      if (ray.ray.intersectPlane(plane, hit)) {
        group.updateMatrixWorld();
        inv.copy(group.matrixWorld).invert();
        uniforms.uMouse.value.lerp(hit.applyMatrix4(inv), 0.25);
      }
    } else {
      // idle (and always on touch): a "catalyst" point drifts through the cloud and parts it
      wander.set(Math.sin(time * 0.55) * 7, Math.sin(time * 0.8 + 1.3) * 3.5, 0);
      uniforms.uMouse.value.lerp(wander, 0.05);
    }
    renderer.render(scene, camera);
  }
  tick();

  return { uniforms };
}
