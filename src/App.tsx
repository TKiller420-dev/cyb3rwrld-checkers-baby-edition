import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getLegalMoves } from './shared';
import type { Color, Move, Position, RoomSnapshot } from './shared';
import { CheckersScene } from './game/CheckersScene';

const DEFAULT_SERVER_URL = 'https://217-216-40-246.sslip.io';
const SERVER_URL = import.meta.env.VITE_SERVER_URL?.trim() || DEFAULT_SERVER_URL;

function getSocketConnectionConfig(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    const origin = `${parsed.protocol}//${parsed.host}`;
    const basePath = parsed.pathname.replace(/\/+$/, '');
    const rawPath = basePath && basePath !== '/' ? `${basePath}/socket.io` : '/socket.io';
    const path = rawPath.endsWith('/') ? rawPath : `${rawPath}/`;
    return { origin, path };
  } catch {
    return { origin: rawUrl, path: '/socket.io/' };
  }
}

type JoinPayload = {
  snapshot: RoomSnapshot;
  yourColor: Color;
};

function getColorLabel(color: Color | null) {
  if (color === 'red') {
    return 'violet';
  }

  if (color === 'black') {
    return 'blue';
  }

  return 'observer';
}

function samePosition(left: Position, right: Position) {
  return left.row === right.row && left.col === right.col;
}

export default function App() {
  const [playerName, setPlayerName] = useState('Player');
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [playerColor, setPlayerColor] = useState<Color | null>(null);
  const [selected, setSelected] = useState<Position | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [message, setMessage] = useState('Enter your tag, open a den, or join one with a room code.');

  const socketRef = useRef<Socket | null>(null);
  const socketUrlRef = useRef<string | null>(null);

  useEffect(() => {
    ensureSocket();

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!room) {
      setSelected(null);
      return;
    }

    if (room.state.mustContinueFrom) {
      setSelected(room.state.mustContinueFrom);
      return;
    }

    if (!selected) {
      return;
    }

    const nextMoves = getLegalMoves(room.state, selected);
    if (nextMoves.length === 0) {
      setSelected(null);
    }
  }, [room, selected]);

  const hasBothPlayers = Boolean(room?.players.red && room?.players.black);
  const legalMoves = room && selected ? getLegalMoves(room.state, selected) : [];
  const isMyTurn = Boolean(room && playerColor && hasBothPlayers && room.state.turn === playerColor && !room.state.winner);
  const canInteractWithServer = isConnected && !isConnecting;

  function bindSocket(socket: Socket) {
    socket.on('connect', () => {
      setIsConnected(true);
      setIsConnecting(false);
      setMessage((currentMessage) =>
        currentMessage === 'Connecting to the den network...' || currentMessage.startsWith('Unable to reach the den network')
          ? 'Connected. Open a den or enter one with a code.'
          : currentMessage
      );
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setIsConnecting(false);
      setMessage('Signal lost. The den link dropped.');
    });

    socket.on('connect_error', (error) => {
      setIsConnected(false);
      setIsConnecting(false);
      const { origin, path } = getSocketConnectionConfig(SERVER_URL);
      setMessage(`Unable to reach den network at ${origin}${path} (${error.message}).`);
    });

    socket.on('server:error', ({ message: errorMessage }: { message: string }) => {
      setMessage(errorMessage);
    });

    socket.on('room:created', ({ snapshot, yourColor }: JoinPayload) => {
      setRoom(snapshot);
      setPlayerColor(yourColor);
      setSelected(null);
      setMessage(`Den ${snapshot.roomCode} is live. Waiting for a rival.`);
    });

    socket.on('room:joined', ({ snapshot, yourColor }: JoinPayload) => {
      setRoom(snapshot);
      setPlayerColor(yourColor);
      setSelected(null);
      setMessage(`Entered den ${snapshot.roomCode}. ${getColorLabel(snapshot.state.turn)} moves first.`);
    });

    socket.on('room:update', (snapshot: RoomSnapshot) => {
      setRoom(snapshot);

      if (snapshot.state.winner) {
        setMessage(`${getColorLabel(snapshot.state.winner)} controls the grid.`);
        return;
      }

      if (snapshot.state.mustContinueFrom) {
        setMessage(`${getColorLabel(snapshot.state.turn)} must keep hunting.`);
        return;
      }

      setMessage(`${getColorLabel(snapshot.state.turn)} to move.`);
    });

    socket.on('room:left', () => {
      setRoom(null);
      setPlayerColor(null);
      setSelected(null);
      setMessage('You left the den.');
    });
  }

  function ensureSocket() {
    if (socketRef.current && socketUrlRef.current === SERVER_URL) {
      if (!socketRef.current.connected && !socketRef.current.active) {
        setIsConnecting(true);
        socketRef.current.connect();
      }
      return socketRef.current;
    }

    socketRef.current?.disconnect();
    setIsConnecting(true);
    setIsConnected(false);
    setMessage('Connecting to the den network...');

    const { origin, path } = getSocketConnectionConfig(SERVER_URL);

    const socket = io(origin, {
      autoConnect: true,
      path
    });

    socketRef.current = socket;
    socketUrlRef.current = SERVER_URL;
    bindSocket(socket);
    return socket;
  }

  function handleCreateRoom() {
    if (!canInteractWithServer) {
      setMessage('The den network is offline right now. Start the VPS server, then try again.');
      ensureSocket();
      return;
    }

    const socket = ensureSocket();
    socket.emit('room:create', { name: playerName });
  }

  function handleJoinRoom() {
    const code = roomCodeInput.trim().toUpperCase();
    if (!code) {
      setMessage('Enter a den code first.');
      return;
    }

    if (!canInteractWithServer) {
      setMessage('The den network is offline right now. Start the VPS server, then try again.');
      ensureSocket();
      return;
    }

    const socket = ensureSocket();
    socket.emit('room:join', { roomCode: code, name: playerName });
  }

  function handleLeaveRoom() {
    socketRef.current?.emit('room:leave');
    setRoom(null);
    setPlayerColor(null);
    setSelected(null);
  }

  function handleRestart() {
    socketRef.current?.emit('game:restart');
  }

  async function handleCheckForUpdates() {
    if (!window.checkersApi?.checkForUpdates) {
      setMessage('Manual update checks are available in the packaged desktop build.');
      return;
    }

    setIsCheckingUpdates(true);
    setMessage('Checking for a newer build...');

    try {
      const result = await window.checkersApi.checkForUpdates();
      setMessage(result.message);
    } catch {
      setMessage('Update check failed. Try again in a moment.');
    } finally {
      setIsCheckingUpdates(false);
    }
  }

  function handleSquareClick(position: Position) {
    if (!room || !playerColor || !hasBothPlayers || !isMyTurn) {
      return;
    }

    const chosenMove = legalMoves.find((move) => samePosition(move.to, position));
    if (selected && chosenMove) {
      socketRef.current?.emit('game:move', chosenMove satisfies Move);
      return;
    }

    const piece = room.state.board[position.row][position.col];
    if (!piece || piece.color !== playerColor) {
      return;
    }

    const pieceMoves = getLegalMoves(room.state, position);
    if (pieceMoves.length === 0) {
      setMessage('That piece has no legal move.');
      return;
    }

    setSelected(position);
  }

  return (
    <div className="app-shell">
      <aside className="control-panel">
        <div className="title-block">
          <div className="title-row">
            <h1>Cyb3rWrld Checkers</h1>
            <div
              className={`connection-dot ${isConnected ? 'online' : isConnecting ? 'connecting' : 'offline'}`}
              aria-label={isConnected ? 'Connected' : isConnecting ? 'Connecting' : 'Offline'}
            />
          </div>
          <span className="eyebrow">Baby Edition</span>
          <div className="fox-mark" aria-hidden="true">
            <span className="fox-ear fox-ear-left" />
            <span className="fox-ear fox-ear-right" />
            <span className="fox-face">
              <span className="fox-eye fox-eye-left" />
              <span className="fox-eye fox-eye-right" />
              <span className="fox-nose" />
            </span>
            <span className="fox-glow" />
          </div>
        </div>

        {!room ? (
          <div className="card form-card">
            <label>
              <span className="label">Tag</span>
              <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} maxLength={24} />
            </label>
            <label>
              <span className="label">Den code</span>
              <input value={roomCodeInput} onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())} maxLength={5} placeholder="ABCDE" />
            </label>
            <div className="button-row">
              <button type="button" onClick={handleCreateRoom} disabled={!canInteractWithServer}>Open den</button>
              <button type="button" className="secondary" onClick={handleJoinRoom} disabled={!canInteractWithServer}>Enter den</button>
            </div>
          </div>
        ) : null}

        <div className="card status-card">
          <div className="status-row">
            <span className="label">Side</span>
            <strong>{getColorLabel(playerColor)}</strong>
          </div>
          <div className="status-row">
            <span className="label">Den</span>
            <strong>{room?.roomCode ?? '—'}</strong>
          </div>
          <div className="status-row">
            <span className="label">Violet</span>
            <strong>{room?.players.red ?? 'Open'}</strong>
          </div>
          <div className="status-row">
            <span className="label">Azure</span>
            <strong>{room?.players.black ?? 'Open'}</strong>
          </div>
          <div className="status-row">
            <span className="label">Turn</span>
            <strong>{room?.state.winner ? 'Game over' : room ? getColorLabel(room.state.turn) : '—'}</strong>
          </div>
          <div className="status-row">
            <span className="label">Combo</span>
            <strong>{room?.state.mustContinueFrom ? 'Active' : '—'}</strong>
          </div>
        </div>

        <div className="card message-card">
          <p>{message}</p>
        </div>

        <div className="button-row wide">
          <button type="button" className="secondary" onClick={handleLeaveRoom} disabled={!room}>Leave den</button>
          <button type="button" onClick={handleRestart} disabled={!room}>Restart</button>
        </div>

        <button type="button" className="secondary update-button" onClick={handleCheckForUpdates} disabled={isCheckingUpdates}>
          {isCheckingUpdates ? 'Checking updates...' : 'Check updates'}
        </button>
      </aside>

      <main className="board-panel">
        <header className="board-header">
          <h2>{isMyTurn ? 'Your move' : room?.state.winner ? 'Game over' : room ? 'Waiting…' : 'Board'}</h2>
          <p className="hint">
            {room && !hasBothPlayers
              ? 'Waiting for another player to join this den before the game starts.'
              : 'Select a piece, then tap a lit square to move. Captures are forced.'}
          </p>
        </header>

        <div className="board-frame">
          <CheckersScene
            state={room?.state ?? null}
            localColor={playerColor}
            selected={selected}
            legalMoves={legalMoves}
            onSquareClick={handleSquareClick}
          />
        </div>
      </main>
    </div>
  );
}
