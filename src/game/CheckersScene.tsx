import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { createInitialState } from '../shared';
import type { Color, GameState, Move, Position } from '../shared';

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

function BoardScene({ state, localColor, selected, legalMoves, onSquareClick }: CheckersSceneProps) {
  const displayState = state ?? createInitialState();
  const rotation = localColor === 'black' ? Math.PI : 0;

  return (
    <group rotation={[0, rotation, 0]}>
      <mesh position={[0, -0.22, 0]} receiveShadow>
        <boxGeometry args={[9.4, 0.4, 9.4]} />
        <meshStandardMaterial color="#8a5c31" />
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
                  color={isDark ? '#0f1123' : '#1f2444'}
                  emissive={isSelected ? '#ff7a1a' : isTarget ? '#55f0ff' : '#161822'}
                  emissiveIntensity={isSelected ? 0.78 : isTarget ? 0.38 : 0.1}
                />
              </mesh>

              {isTarget ? (
                <mesh position={[x, 0.16, z]}>
                  <cylinderGeometry args={[0.16, 0.16, 0.08, 28]} />
                  <meshStandardMaterial color="#55f0ff" emissive="#55f0ff" emissiveIntensity={0.6} transparent opacity={0.92} />
                </mesh>
              ) : null}

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
      <pointLight position={[-3, 2.6, -3]} intensity={11} distance={14} color="#8b5cf6" />
      <pointLight position={[3, 2.4, 3]} intensity={10} distance={14} color="#2f7bff" />
      <BoardScene {...props} />
      <OrbitControls enablePan={false} minDistance={8.5} maxDistance={12} minPolarAngle={0.65} maxPolarAngle={1.25} />
    </Canvas>
  );
}
