import { useEffect, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { READERS, readerPosition, type Reader } from "@/lib/aisle";

type Loaded = { reader: Reader; object: THREE.Object3D };

/**
 * Scales a figure to its reader's height, stands it on the floor and centres it on its own footprint, so a
 * model from any source lands at the right size wherever it was modelled.
 */
function normalise(scene: THREE.Object3D, height: number) {
  const box = new THREE.Box3().setFromObject(scene);
  const size = box.getSize(new THREE.Vector3());
  const scale = size.y > 0 ? height / size.y : 1;
  const centre = box.getCenter(new THREE.Vector3());
  scene.position.set(-centre.x * scale, -box.min.y * scale, -centre.z * scale);
  scene.scale.setScalar(scale);
  scene.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  const holder = new THREE.Group();
  holder.add(scene);
  return holder;
}

/**
 * The people in the aisle: readers loaded from public/models as they arrive. A figure whose file is missing or
 * fails to load is simply not there; the arcade never waits for them. `onLoaded` reports which ones made it,
 * so the page can credit their authors.
 */
export function Readers({ onLoaded }: { onLoaded: (readers: Reader[]) => void }) {
  const [loaded, setLoaded] = useState<Loaded[]>([]);

  useEffect(() => {
    let cancelled = false;
    const loader = new GLTFLoader();
    loader.setMeshoptDecoder(MeshoptDecoder);
    Promise.all(READERS.map((reader): Promise<Loaded | null> =>
      loader.loadAsync(reader.file)
        .then((gltf) => ({ reader, object: normalise(gltf.scene, reader.height) }))
        .catch(() => null),
    )).then((results) => {
      if (cancelled) return;
      const found = results.filter((r): r is Loaded => r !== null);
      setLoaded(found);
      onLoaded(found.map((f) => f.reader));
    });
    return () => {
      cancelled = true;
    };
  }, [onLoaded]);

  useEffect(() => () => {
    loaded.forEach(({ object }) => object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      mesh.geometry.dispose();
      (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => m.dispose());
    }));
  }, [loaded]);

  return (
    <>
      {loaded.map(({ reader, object }) => {
        // Facing the visitor walking in, turned toward the stacks by the reader's own angle.
        const yaw = reader.side * (reader.turn ?? 0);
        return (
          <group key={reader.file} position={readerPosition(reader)} rotation-y={yaw}>
            {reader.bench && (
              <mesh position={[0, 0.22, -0.05]} castShadow receiveShadow>
                <boxGeometry args={[1.3, 0.44, 0.5]} />
                <meshStandardMaterial color="#F3F3EE" roughness={0.92} />
              </mesh>
            )}
            <primitive object={object} />
          </group>
        );
      })}
    </>
  );
}
