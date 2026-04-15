import { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sparkles } from '@react-three/drei';
import { createInitialState } from '../shared';
import type { Color, GameState, Move, Position } from '../shared';
import type { Mesh, PointLight } from 'three';

type CheckersSceneProps = {
  state: GameState | null;
  localColor: Color | null;
  selected: Position | null;
  legalMoves: Move[];
  onSquareClick: (position: Position) => void;
};

function samePosition(left: Position, right: Position) {
  return left.row === right.row && left.col === right.col;
}

function TargetMarker({ x, z }: { x: number; z: number }) {
  const coreRef = useRef<Mesh>(null);
  const ringRef = useRef<Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (coreRef.current) {
      coreRef.current.position.y = 0.16 + Math.sin(t * 3 + x + z) * 0.02;
    }

    if (ringRef.current) {
      ringRef.current.rotation.y += 0.03;
      const pulse = 0.95 + (Math.sin(t * 4 + x) + 1) * 0.08;
      ringRef.current.scale.set(pulse, 1, pulse);
    }
  });

  return (
    <group position={[x, 0, z]}>
      <mesh ref={coreRef}>
        <cylinderGeometry args={[0.14, 0.14, 0.07, 28]} />
        <meshStandardMaterial color="#66f3ff" emissive="#66f3ff" emissiveIntensity={0.72} transparent opacity={0.92} />
      </mesh>
      <mesh ref={ringRef} position={[0, 0.2, 0]}>
        <torusGeometry args={[0.26, 0.02, 14, 34]} />
        <meshStandardMaterial color="#98f8ff" emissive="#72f2ff" emissiveIntensity={0.7} transparent opacity={0.9} />
      </mesh>
    </group>
  );
}

function FoxCompanion({ position, rotationY }: { position: [number, number, number]; rotationY: number }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh castShadow position={[0, 0.3, 0.02]}>
        <sphereGeometry args={[0.3, 22, 22]} />
        <meshStandardMaterial color="#f58a3c" roughness={0.45} />
      </mesh>
      <mesh castShadow position={[0, 0.62, 0.2]}>
        <sphereGeometry args={[0.24, 22, 22]} />
        <meshStandardMaterial color="#ff9f4c" roughness={0.4} />
      </mesh>
      <mesh castShadow position={[-0.12, 0.83, 0.14]} rotation={[0, 0, 0.2]}>
        <coneGeometry args={[0.08, 0.18, 20]} />
        <meshStandardMaterial color="#ff9f4c" />
      </mesh>
      <mesh castShadow position={[0.12, 0.83, 0.14]} rotation={[0, 0, -0.2]}>
        <coneGeometry args={[0.08, 0.18, 20]} />
        <meshStandardMaterial color="#ff9f4c" />
      </mesh>
      <mesh castShadow position={[0, 0.57, 0.4]}>
        <sphereGeometry args={[0.11, 16, 16]} />
        <meshStandardMaterial color="#fff3e2" roughness={0.5} />
      </mesh>
      <mesh castShadow position={[-0.14, 0.1, 0.21]}>
        <capsuleGeometry args={[0.06, 0.12, 6, 12]} />
        <meshStandardMaterial color="#e77a2c" />
      </mesh>
      <mesh castShadow position={[0.14, 0.1, 0.21]}>
        <capsuleGeometry args={[0.06, 0.12, 6, 12]} />
        <meshStandardMaterial color="#e77a2c" />
      </mesh>
      <mesh castShadow position={[-0.22, 0.26, -0.18]} rotation={[0.2, 0, -0.9]}>
        <capsuleGeometry args={[0.08, 0.26, 8, 16]} />
        <meshStandardMaterial color="#f38a39" />
      </mesh>
    </group>
  );
}

function AnimatedLights() {
  const violetRef = useRef<PointLight>(null);
  const blueRef = useRef<PointLight>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (violetRef.current) {
      violetRef.current.intensity = 9 + Math.sin(t * 2.2) * 2;
    }
    if (blueRef.current) {
      blueRef.current.intensity = 8 + Math.sin(t * 1.6 + 1.2) * 1.8;
    }
  });

  return (
    <>
      <pointLight ref={violetRef} position={[-3.2, 2.7, -3.4]} intensity={9.5} distance={14} color="#8b5cf6" />
      <pointLight ref={blueRef} position={[3.4, 2.5, 3.1]} intensity={8.4} distance={14} color="#2f7bff" />
      <spotLight
        castShadow
        position={[0, 8.5, 0]}
        angle={0.35}
        penumbra={0.35}
        intensity={1.35}
        distance={20}
        color="#ffd8a8"
      />
    </>
  );
}

function BoardScene({ state, localColor, selected, legalMoves, onSquareClick }: CheckersSceneProps) {
  const displayState = state ?? createInitialState();
  const rotation = localColor === 'black' ? Math.PI : 0;

  return (
    <group rotation={[0, rotation, 0]}>
      <mesh position={[0, -0.28, 0]} receiveShadow>
        <boxGeometry args={[9.4, 0.4, 9.4]} />
        <meshStandardMaterial color="#8a5c31" roughness={0.72} />
      </mesh>

      <mesh position={[0, -1.62, 0]} receiveShadow>
        <boxGeometry args={[10.8, 0.5, 10.8]} />
        <meshStandardMaterial color="#5e3719" roughness={0.78} />
      </mesh>

      {[
        [-4.7, -2.35, -4.7],
        [4.7, -2.35, -4.7],
        [-4.7, -2.35, 4.7],
        [4.7, -2.35, 4.7]
      ].map((position) => (
        <mesh key={position.join('-')} position={position as [number, number, number]} receiveShadow>
          <boxGeometry args={[0.48, 1.45, 0.48]} />
          <meshStandardMaterial color="#4d2914" roughness={0.78} />
        </mesh>
      ))}

      <FoxCompanion position={[-5.35, -1.05, -5.2]} rotationY={0.64} />
      <FoxCompanion position={[5.35, -1.05, 5.2]} rotationY={-2.35} />

      <mesh position={[0, -0.02, 0]} receiveShadow>
        <cylinderGeometry args={[5.3, 5.3, 0.05, 40]} />
        <meshStandardMaterial color="#1f1530" emissive="#120f1c" emissiveIntensity={0.22} transparent opacity={0.86} />
      </mesh>

      {displayState.board.map((row, rowIndex) =>
        row.map((piece, colIndex) => {
          const squarePosition: Position = { row: rowIndex, col: colIndex };
          const x = colIndex - 3.5;
          const z = rowIndex - 3.5;
          const isDark = (rowIndex + colIndex) % 2 === 1;
          const isSelected = selected ? samePosition(selected, squarePosition) : false;
          const isTarget = legalMoves.some((move) => samePosition(move.to, squarePosition));

          return (
            <group key={`${rowIndex}-${colIndex}`}>
              <mesh
                position={[x, 0, z]}
                receiveShadow
                onClick={(event) => {
                  event.stopPropagation();
                  onSquareClick(squarePosition);
                }}
              >
                <boxGeometry args={[1, 0.18, 1]} />
                <meshStandardMaterial
                  color={isDark ? '#151a36' : '#28315f'}
                  emissive={isSelected ? '#ff7a1a' : isTarget ? '#72f2ff' : '#1a1f33'}
                  emissiveIntensity={isSelected ? 0.82 : isTarget ? 0.42 : 0.14}
                />
              </mesh>

              {isTarget ? <TargetMarker x={x} z={z} /> : null}

              {piece ? (
                <group
                  position={[x, 0.23, z]}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSquareClick(squarePosition);
                  }}
                >
                  <mesh castShadow>
                    <cylinderGeometry args={[0.34, 0.4, 0.22, 40]} />
                    <meshStandardMaterial
                      color={piece.color === 'red' ? '#6b4d8a' : '#2a5a7a'}
                      emissive={piece.color === 'red' ? '#4a3a6a' : '#1a3a5a'}
                      emissiveIntensity={0.18}
                      roughness={0.22}
                      metalness={0.55}
                    />
                  </mesh>
                  <mesh position={[0, 0.12, 0]} castShadow>
                    <torusGeometry args={[0.21, 0.05, 18, 40]} />
                    <meshStandardMaterial color="#ff8c2a" emissive="#ff8c2a" emissiveIntensity={0.28} />
                  </mesh>
                  {piece.king ? (
                    <mesh position={[0, 0.18, 0]} castShadow>
                      <cylinderGeometry args={[0.18, 0.18, 0.12, 32]} />
                      <meshStandardMaterial color="#ffd166" emissive="#ff8c2a" emissiveIntensity={0.4} metalness={0.75} roughness={0.16} />
                    </mesh>
                  ) : null}
                </group>
              ) : null}
            </group>
          );
        })
      )}
    </group>
  );
}

export function CheckersScene(props: CheckersSceneProps) {
  return (
    <Canvas shadows camera={{ position: [0, 8.5, 8.2], fov: 38 }}>
      <color attach="background" args={['#070b18']} />
      <fog attach="fog" args={['#070b18', 8, 18]} />
      <hemisphereLight intensity={0.95} color="#7a8cff" groundColor="#1f0d22" />
      <directionalLight castShadow position={[5, 9, 6]} intensity={1.55} color="#ff8c2a" shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <AnimatedLights />
      <Sparkles count={48} scale={[10.2, 3.2, 10.2]} size={2.5} speed={0.28} opacity={0.6} color="#ffd39b" noise={0.3} />
      <BoardScene {...props} />
      <OrbitControls enablePan={false} minDistance={8.5} maxDistance={12} minPolarAngle={0.65} maxPolarAngle={1.25} />
    </Canvas>
  );
}
