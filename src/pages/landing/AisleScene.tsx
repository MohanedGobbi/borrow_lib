import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import gsap from "gsap";
import {
  AISLE, RUNNER_REPEAT, archGeometry, cameraZ, floorTexture, labelTexture, plasterTexture, runnerTexture, shelfBooks,
  spineTexture, vaultGeometry,
} from "@/lib/aisle";

const PLASTER = "#FBFBF8";
const RUNNER = "#0E6B3C";
const STACKS = "#0A5230";
const FOG = "#F8F8F5";

type SceneProps = {
  /** The tall landing section the walk belongs to: the camera's progress is how far it has scrolled past. */
  track: RefObject<HTMLElement | null>;
  /** Real cover colours from the catalogue, for the spines. */
  colors: string[];
  /** Real subject names from the catalogue, lettered on the brass plates at the end of each stack. */
  subjects: string[];
  /** Reduced motion: the camera stays at the first arch and nothing animates on its own. */
  still: boolean;
  onReady: () => void;
};

/** Scroll progress of the track, 0 when its top meets the viewport's top, 1 when its end leaves the bottom. */
function trackProgress(el: HTMLElement | null) {
  if (!el) return 0;
  const rect = el.getBoundingClientRect();
  const span = rect.height - window.innerHeight;
  return span > 0 ? THREE.MathUtils.clamp(-rect.top / span, 0, 1) : 0;
}

function Walk({ track, still }: Pick<SceneProps, "track" | "still">) {
  const pointer = useRef({ x: 0, y: 0 });
  // The arrival: the camera steps in from outside the first arch. Content is already on screen; only the view moves.
  const intro = useRef({ z: still ? 0 : 4.5 });
  const look = useMemo(() => new THREE.Vector3(), []);

  useEffect(() => {
    if (still) return;
    const tween = gsap.to(intro.current, { z: 0, duration: 2.6, ease: "expo.out", delay: 0.1 });
    const move = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", move, { passive: true });
    return () => {
      tween.kill();
      window.removeEventListener("pointermove", move);
    };
  }, [still]);

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.05);
    const z = still ? cameraZ(0) : cameraZ(trackProgress(track.current)) + intro.current.z;
    const px = still ? 0 : pointer.current.x * 0.28;
    const py = still ? 0 : -pointer.current.y * 0.1;
    camera.position.x = THREE.MathUtils.damp(camera.position.x, px, 3, dt);
    camera.position.y = THREE.MathUtils.damp(camera.position.y, AISLE.eye + py, 3, dt);
    camera.position.z = THREE.MathUtils.damp(camera.position.z, z, 4.5, dt);
    look.set(camera.position.x * 0.4, AISLE.eye + 0.6, camera.position.z - 12);
    camera.lookAt(look);
  });
  return null;
}

/**
 * The bay plates: brass plates fixed to the face of each arch's piers, one on either side of the opening,
 * lettered with the subject shelved in the bay behind it. They sit beside the opening, so the section
 * plaques never cover them, and high on the pier: seen from the stop in front of the arch, their lower edge
 * stays above the line of the stack tops, so the shelves never hide them.
 */
function Labels({ subjects }: { subjects: string[] }) {
  const textures = useMemo(() => subjects.map((s) => labelTexture(s)), [subjects]);
  useEffect(() => () => textures.forEach((t) => t?.dispose()), [textures]);
  return (
    <>
      {textures.map((texture, i) => {
        if (!texture) return null;
        const arch = Math.floor(i / 2);
        if (arch >= AISLE.arches - 1) return null;
        const side = i % 2 === 0 ? 1 : -1;
        return (
          <group key={i} position={[side * (AISLE.openHalf + 0.62), 4.15, -arch * AISLE.spacing + AISLE.wall / 2 + 0.26]}>
            <mesh castShadow>
              <boxGeometry args={[1.04, 0.52, 0.03]} />
              <meshStandardMaterial color="#8E7038" roughness={0.4} metalness={0.5} />
            </mesh>
            <mesh position={[0, 0, 0.016]}>
              <planeGeometry args={[1, 0.48]} />
              <meshStandardMaterial map={texture} roughness={0.45} metalness={0.25} />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function Arcade({ colors, subjects, shadows }: { colors: string[]; subjects: string[]; shadows: boolean }) {
  const arches = useMemo(() => Array.from({ length: AISLE.arches }, (_, i) => archGeometry(i + 1)), []);
  const vault = useMemo(() => vaultGeometry(), []);
  const bump = useMemo(() => plasterTexture(), []);
  const floor = useMemo(() => floorTexture(), []);
  const spine = useMemo(() => spineTexture(), []);
  const depth = AISLE.spacing * AISLE.arches + 12;
  const runnerLength = depth + 6;
  const runner = useMemo(() => {
    const texture = runnerTexture();
    texture?.repeat.set(1, runnerLength / RUNNER_REPEAT);
    return texture;
  }, [runnerLength]);
  const books = useMemo(() => shelfBooks(colors), [colors]);
  const booksRef = useRef<THREE.InstancedMesh>(null);
  const bayLength = AISLE.spacing - AISLE.wall;

  useLayoutEffect(() => {
    const mesh = booksRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const color = new THREE.Color();
    books.forEach((b, i) => {
      e.set(b.tilt, 0, 0);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(...b.position), q, new THREE.Vector3(...b.scale));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, color.set(b.color).offsetHSL(0, 0, b.shade));
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [books]);

  useEffect(() => () => {
    arches.forEach((a) => a.dispose());
    vault.dispose();
    bump?.dispose();
    floor?.dispose();
    spine?.dispose();
    runner?.dispose();
  }, [arches, vault, bump, floor, spine, runner]);

  const plaster = <meshStandardMaterial color={PLASTER} roughness={0.92} bumpMap={bump ?? undefined} bumpScale={3} />;

  return (
    <group>
      {/* Stone floor, shaded under the stacks, and the green runner down the middle of the aisle. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, -depth / 2 + 10]} receiveShadow>
        <planeGeometry args={[(AISLE.halfWidth + 2) * 2, depth + 20]} />
        <meshStandardMaterial map={floor ?? undefined} color="#FFFFFF" roughness={0.6} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.006, -depth / 2 + 6]} receiveShadow>
        <planeGeometry args={[1.5, runnerLength]} />
        <meshStandardMaterial map={runner ?? undefined} color={runner ? "#FFFFFF" : RUNNER} roughness={0.95} />
      </mesh>

      {arches.map((geometry, i) => (
        <mesh key={`arch-${i}`} geometry={geometry} position={[0, 0, -i * AISLE.spacing]} castShadow receiveShadow>
          <meshStandardMaterial color={PLASTER} roughness={0.92} bumpMap={bump ?? undefined} bumpScale={3} vertexColors />
        </mesh>
      ))}

      {Array.from({ length: AISLE.arches - 1 }, (_, bay) => {
        const z = -bay * AISLE.spacing - AISLE.spacing / 2;
        return (
          <group key={`bay-${bay}`} position={[0, 0, z]}>
            <mesh geometry={vault} position={[0, AISLE.height - AISLE.halfWidth - 0.05, 0]} receiveShadow>
              <meshStandardMaterial color={PLASTER} roughness={0.95} side={THREE.DoubleSide} bumpMap={bump ?? undefined} bumpScale={3} />
            </mesh>
            {[-1, 1].map((side) => (
              <group key={side}>
                {/* The side wall, then the painted stacks against it. */}
                <mesh position={[side * AISLE.halfWidth, AISLE.height / 2, 0]} receiveShadow>
                  <boxGeometry args={[0.2, AISLE.height, bayLength]} />
                  {plaster}
                </mesh>
                <mesh position={[side * AISLE.stackBack, 1.85, 0]} castShadow receiveShadow>
                  <boxGeometry args={[0.06, 3.7, bayLength - 0.5]} />
                  <meshStandardMaterial color={STACKS} roughness={0.6} />
                </mesh>
                {Array.from({ length: 6 }, (_, row) => (
                  <mesh key={row} position={[side * AISLE.stackX, 0.27 + row * 0.68, 0]} castShadow receiveShadow>
                    <boxGeometry args={[0.42, 0.04, bayLength - 0.5]} />
                    <meshStandardMaterial color={STACKS} roughness={0.6} />
                  </mesh>
                ))}
                {[-1, 1].map((end) => (
                  <mesh key={end} position={[side * AISLE.stackX, 1.85, end * (bayLength / 2 - 0.27)]} castShadow>
                    <boxGeometry args={[0.44, 3.7, 0.05]} />
                    <meshStandardMaterial color={STACKS} roughness={0.6} />
                  </mesh>
                ))}
              </group>
            ))}
          </group>
        );
      })}

      <Labels subjects={subjects} />

      <instancedMesh ref={booksRef} args={[undefined, undefined, books.length]} castShadow={shadows} receiveShadow>
        <boxGeometry />
        <meshStandardMaterial map={spine ?? undefined} roughness={0.72} />
      </instancedMesh>

      {/* The far end: a doorway full of daylight. */}
      <mesh position={[0, 3.2, -(AISLE.arches - 1) * AISLE.spacing - 9]}>
        <planeGeometry args={[5, 6.4]} />
        <meshBasicMaterial color="#FFFFFF" toneMapped={false} />
      </mesh>
    </group>
  );
}

function Lights({ shadows }: { shadows: boolean }) {
  const sun = useRef<THREE.DirectionalLight>(null);
  // The sun stands high over the far end; the vaults let it through, so each arch lays its shadow on the
  // floor of the bay in front of it and the opening becomes a pool of light on the runner.
  const target = useMemo(() => {
    const o = new THREE.Object3D();
    o.position.set(0, 0, -16);
    return o;
  }, []);
  useLayoutEffect(() => {
    if (sun.current) sun.current.target = target;
  }, [target]);
  return (
    <>
      <primitive object={target} />
      <hemisphereLight args={["#FFFFFF", "#E8E3D8", 1.9]} />
      <directionalLight
        ref={sun}
        position={[6, 26, -76]}
        intensity={2.4}
        color="#FFF3E2"
        castShadow={shadows}
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
        shadow-normalBias={0.05}
        shadow-camera-left={-7}
        shadow-camera-right={7}
        shadow-camera-top={18}
        shadow-camera-bottom={-18}
        shadow-camera-near={1}
        shadow-camera-far={140}
      />
      {/* A soft fill from behind the visitor, so the faces of the arches stay white rather than grey. */}
      <directionalLight position={[-2, 5, 16]} intensity={1.7} color="#F7FAF7" />
    </>
  );
}

/** Calls onReady once the first frame has been drawn, so the canvas can fade in over the placeholder. */
function FirstFrame({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    requestAnimationFrame(onReady);
  });
  return null;
}

/** Without WebGL (or if the scene fails) the page keeps its plain background; nothing else depends on it. */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

/** The arched aisle behind the landing page. Lazy-loaded: three.js stays out of every other page's bundle. */
export default function AisleScene({ track, colors, subjects, still, onReady }: SceneProps) {
  const [visible, setVisible] = useState(true);
  const [webgl] = useState(hasWebGL);
  const small = typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
  const shadows = !small;

  // Stop drawing once the aisle has scrolled out of view (the footer, or another tab).
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, [track]);

  if (!webgl) return null;
  return (
    <SceneBoundary>
      <div className="absolute inset-0">
        <Canvas
          shadows={shadows}
          dpr={small ? [1, 1.5] : [1, 1.75]}
          frameloop={visible ? "always" : "never"}
          gl={{ antialias: true, powerPreference: "high-performance" }}
          // Neutral tone mapping keeps white plaster white; the default filmic curve turns it grey.
          onCreated={({ gl }) => {
            gl.toneMapping = THREE.NeutralToneMapping;
            gl.toneMappingExposure = 1.05;
          }}
          camera={{ fov: small ? 68 : 52, near: 0.1, far: 140, position: [0, AISLE.eye, cameraZ(0) + 4.5] }}
          aria-hidden
        >
          <color attach="background" args={[FOG]} />
          <fog attach="fog" args={[FOG, 16, 60]} />
          <Lights shadows={shadows} />
          <Arcade colors={colors} subjects={subjects} shadows={shadows} />
          <Walk track={track} still={still} />
          <FirstFrame onReady={onReady} />
        </Canvas>
      </div>
    </SceneBoundary>
  );
}
