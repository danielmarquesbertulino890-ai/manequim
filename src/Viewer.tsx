import { Suspense, useEffect, useMemo, useRef } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { Center, Environment, OrbitControls, useGLTF } from '@react-three/drei';
import * as THREE from 'three';

export type Mode = 'cinza' | 'wireframe' | 'silhueta';
export type Api = { view: (v: string) => void; shot: (v: string) => Promise<string> };
const VIEWS: Record<string, [number, number, number]> = { frente: [0, 0, 4], costas: [0, 0, -4], esquerda: [-4, 0, 0], direita: [4, 0, 0] };

function Model({ url, mode }: { url: string; mode: Mode }) {
  const { scene } = useGLTF(url);
  const obj = useMemo(() => scene.clone(true), [scene]);
  useEffect(() => {
    const mat = mode === 'silhueta' ? new THREE.MeshBasicMaterial({ color: '#111' })
      : new THREE.MeshStandardMaterial({ color: '#b8b8b8', roughness: 0.9, metalness: 0, wireframe: mode === 'wireframe' });
    obj.traverse((o: any) => { if (o.isMesh) o.material = mat; });
  }, [obj, mode]);
  return <Center><primitive object={obj} /></Center>;
}

function Rig({ apiRef, ctl }: { apiRef: React.MutableRefObject<Api | null>; ctl: React.MutableRefObject<any> }) {
  const { camera, gl, scene } = useThree();
  useEffect(() => {
    const view = (v: string) => { camera.position.set(...(VIEWS[v] || [0, 0.3, 4])); ctl.current?.target.set(0, 0, 0); ctl.current?.update(); };
    apiRef.current = { view, shot: async (v) => { view(v); await new Promise(r => setTimeout(r, 150)); gl.render(scene, camera); return gl.domElement.toDataURL('image/png'); } };
  }, [camera, gl, scene]);
  return null;
}

export default function Viewer({ url, mode, auto, apiRef }: { url: string; mode: Mode; auto: boolean; apiRef: React.MutableRefObject<Api | null> }) {
  const ctl = useRef<any>(null);
  return (
    <Canvas camera={{ position: [0, 0.3, 4], fov: 35 }} gl={{ preserveDrawingBuffer: true }} style={{ background: '#f2f2f0', touchAction: 'none' }}>
      <hemisphereLight intensity={0.7} groundColor="#ddd" />
      <directionalLight position={[3, 5, 4]} intensity={1.6} />
      <directionalLight position={[-4, 2, -3]} intensity={0.8} />
      <Suspense fallback={null}><Model url={url} mode={mode} /><Environment preset="studio" /></Suspense>
      <OrbitControls ref={ctl} autoRotate={auto} autoRotateSpeed={2} makeDefault minDistance={1.5} maxDistance={10} />
      <Rig apiRef={apiRef} ctl={ctl} />
    </Canvas>
  );
}
