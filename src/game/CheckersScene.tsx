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

function HeartBadge({ color }: { color: string }) {
  return (
    <group position={[0, 0.14, 0]}>
      <mesh castShadow position={[-0.07, 0.04, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.26} />
      </mesh>
      <mesh castShadow position={[0.07, 0.04, 0]}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.26} />
      </mesh>
      <mesh castShadow position={[0, -0.05, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[0.15, 0.15, 0.06]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.26} />
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
      violetRef.current.intensity = 11 + Math.sin(t * 2.2) * 2.4;
    }
    if (blueRef.current) {
      blueRef.current.intensity = 10 + Math.sin(t * 1.6 + 1.2) * 2.2;
    }
  });

  return (
    <>
      <pointLight ref={violetRef} position={[-3.2, 2.7, -3.4]} intensity={11} distance={14} color="#8b5cf6" />
      <pointLight ref={blueRef} position={[3.4, 2.5, 3.1]} intensity={10} distance={14} color="#2f7bff" />
      <spotLight
        castShadow
        position={[0, 8.5, 0]}
        angle={0.35}
        penumbra={0.35}
        intensity={1.9}
        distance={20}
        color="#ffe0ba"
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
        <meshStandardMaterial color="#a57443" roughness={0.66} />
      </mesh>

      <mesh position={[0, -1.62, 0]} receiveShadow>
        <boxGeometry args={[10.8, 0.5, 10.8]} />
        <meshStandardMaterial color="#7c4d28" roughness={0.72} />
      </mesh>

      {[
        [-4.7, -2.35, -4.7],
        [4.7, -2.35, -4.7],
        [-4.7, -2.35, 4.7],
        [4.7, -2.35, 4.7]
      ].map((position) => (
        <mesh key={position.join('-')} position={position as [number, number, number]} receiveShadow>
          <boxGeometry args={[0.48, 1.45, 0.48]} />
          <meshStandardMaterial color="#684022" roughness={0.72} />
        </mesh>
      ))}

      <FoxCompanion position={[-5.35, -1.05, -5.2]} rotationY={0.64} />
      <FoxCompanion position={[5.35, -1.05, 5.2]} rotationY={-2.35} />

      <mesh position={[0, -0.02, 0]} receiveShadow>
        <cylinderGeometry args={[5.3, 5.3, 0.05, 40]} />
        <meshStandardMaterial color="#31254a" emissive="#1d1530" emissiveIntensity={0.28} transparent opacity={0.9} />
      </mesh>

      {displayState.board.map((row, rowIndex) =>
        row.map((piece, colIndex) => {
          const squarePosition: Position = { row: rowIndex, col: colIndex };
          const x = colIndex - 3.5;
          const z = rowIndex - 3.5;
          const isDark = (rowIndex + colIndex) % 2 === 1;
          const isSelected = selected ? samePosition(selected, squarePosition) : false;
          const isTarget = legalMoves.some((move) => samePosition(move.to, squarePosition));
          const heartColor = (rowIndex + colIndex) % 2 === 0 ? '#7a61ff' : '#3f9bff';

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
                  color={isDark ? '#2d3a71' : '#5a6cb3'}
                  emissive={isSelected ? '#ff7a1a' : isTarget ? '#72f2ff' : '#273359'}
                  emissiveIntensity={isSelected ? 0.86 : isTarget ? 0.48 : 0.22}
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
                  <HeartBadge color={heartColor} />
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
      <color attach="background" args={['#1c2550']} />
      <fog attach="fog" args={['#1c2550', 10, 22]} />
      <ambientLight intensity={0.42} color="#b5c6ff" />
      <hemisphereLight intensity={1.25} color="#9fb1ff" groundColor="#3e2a47" />
      <directionalLight castShadow position={[5, 9, 6]} intensity={2.15} color="#ffd1a1" shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <AnimatedLights />
      <Sparkles count={56} scale={[10.2, 3.6, 10.2]} size={2.8} speed={0.34} opacity={0.72} color="#ffd39b" noise={0.3} />
      <BoardScene {...props} />
      <OrbitControls enablePan={false} minDistance={8.5} maxDistance={12} minPolarAngle={0.65} maxPolarAngle={1.25} />
    </Canvas>
  );
}
