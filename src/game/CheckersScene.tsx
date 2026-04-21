import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sparkles } from '@react-three/drei';
import { createInitialState } from '../shared';
import type { Color, GameState, Move, Position } from '../shared';
import { Shape, type Group, type Mesh, type PointLight } from 'three';

type CheckersSceneProps = {
  state: GameState | null;
  localColor: Color | null;
  selected: Position | null;
  legalMoves: Move[];
  canInteract?: boolean;
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
  const heartShape = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(0, -0.14);
    shape.bezierCurveTo(-0.3, -0.4, -0.6, -0.03, 0, 0.36);
    shape.bezierCurveTo(0.6, -0.03, 0.3, -0.4, 0, -0.14);
    return shape;
  }, []);
  const heartRef = useRef<Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (heartRef.current) {
      heartRef.current.rotation.y = Math.sin(t * 1.8) * 0.18;
      heartRef.current.rotation.z = Math.PI;
      heartRef.current.position.y = 0.1 + Math.sin(t * 3.2) * 0.01;
    }
  });

  return (
    <group position={[0, 0.11, 0]}>
      <mesh castShadow position={[0, -0.015, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.03, 24]} />
        <meshStandardMaterial color="#1f1f38" emissive="#2b2b4f" emissiveIntensity={0.2} />
      </mesh>
      <mesh ref={heartRef} castShadow position={[0, 0.1, 0]} scale={[0.24, 0.24, 0.24]}>
        <extrudeGeometry args={[heartShape, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 2 }]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.26} />
      </mesh>
    </group>
  );
}

function FoxCompanion({ phase = 0, speed = 0.045, variant = 'orange' }: { phase?: number; speed?: number; variant?: 'orange' | 'purple' }) {
  const foxRef = useRef<Group>(null);
  const bodyRef = useRef<Group>(null);
  const frontLeftLegRef = useRef<Group>(null);
  const frontRightLegRef = useRef<Group>(null);
  const backLeftLegRef = useRef<Group>(null);
  const backRightLegRef = useRef<Group>(null);
  const tailRef = useRef<Mesh>(null);

  const palette = variant === 'purple'
    ? {
        body: '#7b63d6',
        head: '#977df2',
        limb: '#5f49b7',
        tail: '#8d73e8'
      }
    : {
        body: '#f58a3c',
        head: '#ff9f4c',
        limb: '#d06f2f',
        tail: '#f38a39'
      };

  useFrame((state) => {
    if (!foxRef.current) {
      return;
    }

    const t = (state.clock.getElapsedTime() * speed + phase) % 1;
    const min = -5.4;
    const max = 5.4;
    const seg = t * 4;

    let x = min;
    let z = min;
    let heading = 0;

    if (seg < 1) {
      x = min + (max - min) * seg;
      z = min;
      heading = Math.PI * 0.5;
    } else if (seg < 2) {
      x = max;
      z = min + (max - min) * (seg - 1);
      heading = 0;
    } else if (seg < 3) {
      x = max - (max - min) * (seg - 2);
      z = max;
      heading = -Math.PI * 0.5;
    } else {
      x = min;
      z = max - (max - min) * (seg - 3);
      heading = Math.PI;
    }

    const bob = Math.sin(state.clock.getElapsedTime() * 10 + phase * 10) * 0.025;
    foxRef.current.position.set(x, 0.12 + bob, z);
    foxRef.current.rotation.y = heading;

    const tAbs = state.clock.getElapsedTime();
    const walk = Math.sin(tAbs * 12 + phase * 12) * 0.55;
    const counterWalk = Math.sin(tAbs * 12 + phase * 12 + Math.PI) * 0.55;

    if (bodyRef.current) {
      bodyRef.current.rotation.z = Math.sin(tAbs * 8 + phase * 8) * 0.04;
    }

    if (frontLeftLegRef.current) {
      frontLeftLegRef.current.rotation.x = walk;
    }
    if (frontRightLegRef.current) {
      frontRightLegRef.current.rotation.x = counterWalk;
    }
    if (backLeftLegRef.current) {
      backLeftLegRef.current.rotation.x = counterWalk;
    }
    if (backRightLegRef.current) {
      backRightLegRef.current.rotation.x = walk;
    }

    if (tailRef.current) {
      tailRef.current.rotation.y = -0.2 + Math.sin(tAbs * 7 + phase * 5) * 0.32;
    }
  });

  return (
    <group ref={foxRef}>
      <group ref={bodyRef}>
        <mesh castShadow position={[0, 0.3, 0.02]}>
          <sphereGeometry args={[0.3, 22, 22]} />
          <meshStandardMaterial color={palette.body} roughness={0.45} />
        </mesh>
        <mesh castShadow position={[0, 0.62, 0.2]}>
          <sphereGeometry args={[0.24, 22, 22]} />
          <meshStandardMaterial color={palette.head} roughness={0.4} />
        </mesh>
        <mesh castShadow position={[-0.12, 0.83, 0.14]} rotation={[0, 0, 0.2]}>
          <coneGeometry args={[0.08, 0.18, 20]} />
          <meshStandardMaterial color={palette.head} />
        </mesh>
        <mesh castShadow position={[0.12, 0.83, 0.14]} rotation={[0, 0, -0.2]}>
          <coneGeometry args={[0.08, 0.18, 20]} />
          <meshStandardMaterial color={palette.head} />
        </mesh>
        <mesh castShadow position={[0, 0.57, 0.4]}>
          <sphereGeometry args={[0.11, 16, 16]} />
          <meshStandardMaterial color="#fff3e2" roughness={0.5} />
        </mesh>
        <mesh ref={tailRef} castShadow position={[-0.22, 0.26, -0.18]} rotation={[0.2, -0.2, -0.9]}>
          <capsuleGeometry args={[0.08, 0.26, 8, 16]} />
          <meshStandardMaterial color={palette.tail} />
        </mesh>

        <group ref={frontLeftLegRef} position={[-0.14, 0.11, 0.2]}>
          <mesh castShadow position={[0, -0.06, 0]}>
            <capsuleGeometry args={[0.045, 0.1, 5, 10]} />
            <meshStandardMaterial color={palette.limb} />
          </mesh>
        </group>
        <group ref={frontRightLegRef} position={[0.14, 0.11, 0.2]}>
          <mesh castShadow position={[0, -0.06, 0]}>
            <capsuleGeometry args={[0.045, 0.1, 5, 10]} />
            <meshStandardMaterial color={palette.limb} />
          </mesh>
        </group>
        <group ref={backLeftLegRef} position={[-0.14, 0.11, -0.02]}>
          <mesh castShadow position={[0, -0.06, 0]}>
            <capsuleGeometry args={[0.045, 0.1, 5, 10]} />
            <meshStandardMaterial color={palette.limb} />
          </mesh>
        </group>
        <group ref={backRightLegRef} position={[0.14, 0.11, -0.02]}>
          <mesh castShadow position={[0, -0.06, 0]}>
            <capsuleGeometry args={[0.045, 0.1, 5, 10]} />
            <meshStandardMaterial color={palette.limb} />
          </mesh>
        </group>
      </group>
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

function BoardScene({ state, localColor, selected, legalMoves, canInteract = true, onSquareClick }: CheckersSceneProps) {
  const displayState = state ?? createInitialState();
  const rotation = localColor === 'black' ? Math.PI : 0;

  return (
    <group rotation={[0, rotation, 0]}>
      <mesh position={[0, -0.28, 0]} receiveShadow>
        <boxGeometry args={[9.4, 0.4, 9.4]} />
        <meshStandardMaterial color="#121018" roughness={0.72} />
      </mesh>

      <mesh position={[0, -1.62, 0]} receiveShadow>
        <boxGeometry args={[10.8, 0.5, 10.8]} />
        <meshStandardMaterial color="#0c0b12" roughness={0.75} />
      </mesh>

      {[
        [-4.7, -2.35, -4.7],
        [4.7, -2.35, -4.7],
        [-4.7, -2.35, 4.7],
        [4.7, -2.35, 4.7]
      ].map((position) => (
        <mesh key={position.join('-')} position={position as [number, number, number]} receiveShadow>
          <boxGeometry args={[0.48, 1.45, 0.48]} />
          <meshStandardMaterial color="#171321" roughness={0.78} />
        </mesh>
      ))}

      <FoxCompanion phase={0} speed={0.047} />
      <FoxCompanion phase={0.5} speed={0.047} variant="purple" />

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
                  if (!canInteract) {
                    return;
                  }
                  event.stopPropagation();
                  onSquareClick(squarePosition);
                }}
              >
                <boxGeometry args={[1, 0.18, 1]} />
                <meshStandardMaterial
                  color={isDark ? '#07070b' : '#251136'}
                  emissive={isSelected ? '#b07dff' : isTarget ? '#c688ff' : '#180b24'}
                  emissiveIntensity={isSelected ? 0.95 : isTarget ? 0.62 : 0.26}
                />
              </mesh>

              {isTarget ? <TargetMarker x={x} z={z} /> : null}

              {piece ? (
                <group
                  position={[x, 0.23, z]}
                  onClick={(event) => {
                    if (!canInteract) {
                      return;
                    }
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
    <Canvas shadows camera={{ position: [0, 8.6, 10.4], fov: 42 }}>
      <color attach="background" args={['#1c2550']} />
      <ambientLight intensity={0.42} color="#b5c6ff" />
      <hemisphereLight intensity={1.25} color="#9fb1ff" groundColor="#3e2a47" />
      <directionalLight castShadow position={[5, 9, 6]} intensity={2.15} color="#ffd1a1" shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
      <AnimatedLights />
      <Sparkles count={56} scale={[10.2, 3.6, 10.2]} size={2.8} speed={0.34} opacity={0.72} color="#ffd39b" noise={0.3} />
      <BoardScene {...props} />
      <OrbitControls enablePan={false} minDistance={10.5} maxDistance={20} minPolarAngle={0.62} maxPolarAngle={1.2} />
    </Canvas>
  );
}
