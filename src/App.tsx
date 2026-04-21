import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { getLegalMoves } from './shared';
import type { Color, Move, Position, RoomSnapshot } from './shared';
import { CheckersScene } from './game/CheckersScene';

const DEFAULT_SERVER_URL = import.meta.env.VITE_SERVER_URL?.trim() || 'http://localhost:4000';
const SERVER_URL = DEFAULT_SERVER_URL;
const FALLBACK_SERVER_URLS = [
  SERVER_URL,
  'http://localhost:4000'
].filter((value, index, all) => Boolean(value) && all.indexOf(value) === index);

const STORAGE_KEYS = {
  playerName: 'checkers.playerName',
  roomCode: 'checkers.roomCodeInput',
  denName: 'checkers.denNameInput',
  roomPassword: 'checkers.roomPasswordInput',
  preferredSide: 'checkers.preferredSide',
  forcedCaptures: 'checkers.forcedCaptures',
  session: 'checkers.session'
} as const;

type SidePreference = Color | 'auto';

type StoredSession = {
  roomCode: string;
  playerName: string;
  password: string;
  denName: string;
  preferredSide: SidePreference;
  forcedCaptures: boolean;
};

type PendingAction =
  | {
      type: 'create';
      payload: {
        name: string;
        roomName?: string;
        password?: string;
        preferredColor?: Color;
        forcedCaptures: boolean;
      };
    }
  | {
      type: 'join';
      payload: {
        roomCode: string;
        name: string;
        password?: string;
        preferredColor?: Color;
      };
    };

  type SocketTransportMode = 'default' | 'websocket';

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

function readStorage(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage errors in restricted environments.
  }
}

function removeStorage(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage errors in restricted environments.
  }
}

function readStoredString(key: string, fallback: string) {
  const value = readStorage(key);
  return value && value.trim().length > 0 ? value : fallback;
}

function readStoredSidePreference() {
  const value = readStorage(STORAGE_KEYS.preferredSide);
  if (value === 'red' || value === 'black' || value === 'auto') {
    return value;
  }

  return 'auto';
}

function readStoredForcedCaptures() {
  const value = readStorage(STORAGE_KEYS.forcedCaptures);
  if (value === 'true') {
    return true;
  }

  if (value === 'false') {
    return false;
  }

  return true;
}

function readStoredSession() {
  const raw = readStorage(STORAGE_KEYS.session);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredSession;
    if (!parsed.roomCode || !parsed.playerName) {
      return null;
    }

    const preferredSide: SidePreference = parsed.preferredSide === 'red' || parsed.preferredSide === 'black' ? parsed.preferredSide : 'auto';

    return {
      roomCode: parsed.roomCode.toUpperCase(),
      playerName: parsed.playerName,
      password: parsed.password ?? '',
      denName: parsed.denName ?? '',
      preferredSide,
      forcedCaptures: typeof parsed.forcedCaptures === 'boolean' ? parsed.forcedCaptures : true
    };
  } catch {
    return null;
  }
}

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
  const [playerName, setPlayerName] = useState(() => readStoredString(STORAGE_KEYS.playerName, 'Player'));
  const [roomCodeInput, setRoomCodeInput] = useState(() => readStoredString(STORAGE_KEYS.roomCode, '').toUpperCase());
  const [denNameInput, setDenNameInput] = useState(() => readStoredString(STORAGE_KEYS.denName, ''));
  const [roomPasswordInput, setRoomPasswordInput] = useState(() => readStoredString(STORAGE_KEYS.roomPassword, ''));
  const [preferredSide, setPreferredSide] = useState<SidePreference>(() => readStoredSidePreference());
  const [forcedCapturesInput, setForcedCapturesInput] = useState(() => readStoredForcedCaptures());
  const [room, setRoom] = useState<RoomSnapshot | null>(null);
  const [activeDenName, setActiveDenName] = useState<string | null>(null);
  const [roomForcedCaptures, setRoomForcedCaptures] = useState<boolean | null>(null);
  const [playerColor, setPlayerColor] = useState<Color | null>(null);
  const [selected, setSelected] = useState<Position | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);
  const [isCheckingUpdates, setIsCheckingUpdates] = useState(false);
  const [message, setMessage] = useState('Enter your tag, open a den, or join one with a room code.');

  const socketRef = useRef<Socket | null>(null);
  const socketUrlRef = useRef<string | null>(null);
  const socketTransportModeRef = useRef<SocketTransportMode>('default');
  const websocketRetryTriedRef = useRef<Set<string>>(new Set());
  const pendingActionRef = useRef<PendingAction | null>(null);
  const serverUrlIndexRef = useRef(0);
  const restoredSessionRef = useRef<StoredSession | null>(readStoredSession());
  const hasAttemptedRestoreRef = useRef(false);

  const activeForcedCaptures = room?.rules?.forcedCaptures ?? roomForcedCaptures ?? true;

  useEffect(() => {
    ensureSocket();

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.playerName, playerName);
  }, [playerName]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.roomCode, roomCodeInput);
  }, [roomCodeInput]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.denName, denNameInput);
  }, [denNameInput]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.roomPassword, roomPasswordInput);
  }, [roomPasswordInput]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.preferredSide, preferredSide);
  }, [preferredSide]);

  useEffect(() => {
    writeStorage(STORAGE_KEYS.forcedCaptures, String(forcedCapturesInput));
  }, [forcedCapturesInput]);

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

    const nextMoves = getLegalMoves(room.state, selected, { forcedCaptures: activeForcedCaptures });
    if (nextMoves.length === 0) {
      setSelected(null);
    }
  }, [room, selected, activeForcedCaptures]);

  const hasBothPlayers = Boolean(room?.players.red && room?.players.black);
  const legalMoves = room && selected ? getLegalMoves(room.state, selected, { forcedCaptures: activeForcedCaptures }) : [];
  const isMyTurn = Boolean(room && playerColor && hasBothPlayers && room.state.turn === playerColor && !room.state.winner);
  const canInteractWithServer = isConnected && !isConnecting;
  const canInteractWithBoard = Boolean(room && playerColor && hasBothPlayers && isMyTurn);

  function persistSession(nextSession: StoredSession) {
    restoredSessionRef.current = nextSession;
    writeStorage(STORAGE_KEYS.session, JSON.stringify(nextSession));
  }

  function clearSessionPersistence() {
    restoredSessionRef.current = null;
    hasAttemptedRestoreRef.current = false;
    removeStorage(STORAGE_KEYS.session);
  }

  function bindSocket(socket: Socket) {
    socket.on('connect', () => {
      setIsConnected(true);
      setIsConnecting(false);

      if (pendingActionRef.current) {
        const pending = pendingActionRef.current;
        pendingActionRef.current = null;
        hasAttemptedRestoreRef.current = true;
        if (pending.type === 'create') {
          socket.emit('room:create', pending.payload);
          setMessage('Connected. Opening your den...');
        } else {
          socket.emit('room:join', pending.payload);
          setMessage(`Connected. Entering den ${pending.payload.roomCode}...`);
        }
      }

      if (socketUrlRef.current) {
        const matchedIndex = FALLBACK_SERVER_URLS.indexOf(socketUrlRef.current);
        if (matchedIndex >= 0) {
          serverUrlIndexRef.current = matchedIndex;
        }
      }
      setMessage((currentMessage) =>
        currentMessage === 'Connecting to the den network...' || currentMessage.startsWith('Unable to reach the den network')
          ? 'Connected. Open a den or enter one with a code.'
          : currentMessage
      );

      if (!pendingActionRef.current && !hasAttemptedRestoreRef.current && !room && restoredSessionRef.current) {
        hasAttemptedRestoreRef.current = true;
        const persisted = restoredSessionRef.current;
        setPlayerName(persisted.playerName);
        setRoomCodeInput(persisted.roomCode);
        setRoomPasswordInput(persisted.password);
        setDenNameInput(persisted.denName);
        setPreferredSide(persisted.preferredSide);
        setForcedCapturesInput(persisted.forcedCaptures);
        setMessage(`Connected. Restoring den ${persisted.roomCode}...`);
        socket.emit('room:join', {
          roomCode: persisted.roomCode,
          name: persisted.playerName,
          password: persisted.password || undefined,
          preferredColor: persisted.preferredSide === 'auto' ? undefined : persisted.preferredSide
        });
      }
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      setIsConnecting(false);
      hasAttemptedRestoreRef.current = false;
      setMessage('Signal lost. The den link dropped.');
    });

    socket.on('connect_error', (error) => {
      setIsConnected(false);
      setIsConnecting(false);

      const activeUrl = socketUrlRef.current ?? SERVER_URL;
      const { origin: activeOrigin, path: activePath } = getSocketConnectionConfig(activeUrl);
      const isXhrPollError = /xhr\s+poll\s+error/i.test(error.message);

      if (isXhrPollError && socketTransportModeRef.current !== 'websocket' && !websocketRetryTriedRef.current.has(activeUrl)) {
        websocketRetryTriedRef.current.add(activeUrl);
        setMessage(`Polling failed at ${activeOrigin}${activePath}. Retrying with websocket transport...`);
        ensureSocket(activeUrl, 'websocket');
        return;
      }

      const currentIndex = FALLBACK_SERVER_URLS.findIndex((url) => url === socketUrlRef.current);
      const nextIndex = currentIndex >= 0 ? currentIndex + 1 : serverUrlIndexRef.current + 1;
      const nextUrl = FALLBACK_SERVER_URLS[nextIndex];

      if (nextUrl) {
        serverUrlIndexRef.current = nextIndex;
        const { origin, path } = getSocketConnectionConfig(nextUrl);
        setMessage(`Unable to reach den network at ${origin}${path} (${error.message}). Trying fallback ${nextIndex + 1}/${FALLBACK_SERVER_URLS.length}...`);
        ensureSocket(nextUrl, 'default');
        return;
      }

      const failedUrl = socketUrlRef.current ?? SERVER_URL;
      const { origin, path } = getSocketConnectionConfig(failedUrl);
      setMessage(`Unable to reach den network at ${origin}${path} (${error.message}).`);
    });

    socket.on('server:error', ({ message: errorMessage }: { message: string }) => {
      setMessage(errorMessage);
    });

    socket.on('room:created', ({ snapshot, yourColor }: JoinPayload) => {
      pendingActionRef.current = null;
      setRoom(snapshot);
      setPlayerColor(yourColor);
      setSelected(null);
      setActiveDenName(snapshot.name ?? (denNameInput.trim() || null));
      const nextForcedCaptures = snapshot.rules?.forcedCaptures ?? forcedCapturesInput;
      setRoomForcedCaptures(nextForcedCaptures);
      persistSession({
        roomCode: snapshot.roomCode,
        playerName,
        password: roomPasswordInput,
        denName: snapshot.name ?? denNameInput,
        preferredSide,
        forcedCaptures: nextForcedCaptures
      });
      setMessage(`Den ${snapshot.roomCode} is live. Waiting for a rival.`);
    });

    socket.on('room:joined', ({ snapshot, yourColor }: JoinPayload) => {
      pendingActionRef.current = null;
      setRoom(snapshot);
      setPlayerColor(yourColor);
      setSelected(null);
      setActiveDenName(snapshot.name ?? (denNameInput.trim() || null));
      const nextForcedCaptures = snapshot.rules?.forcedCaptures ?? forcedCapturesInput;
      setRoomForcedCaptures(nextForcedCaptures);
      persistSession({
        roomCode: snapshot.roomCode,
        playerName,
        password: roomPasswordInput,
        denName: snapshot.name ?? denNameInput,
        preferredSide,
        forcedCaptures: nextForcedCaptures
      });
      setMessage(`Entered den ${snapshot.roomCode}. ${getColorLabel(snapshot.state.turn)} moves first.`);
    });

    socket.on('room:update', (snapshot: RoomSnapshot) => {
      setRoom(snapshot);
      if (snapshot.name) {
        setActiveDenName(snapshot.name);
      }
      if (typeof snapshot.rules?.forcedCaptures === 'boolean') {
        setRoomForcedCaptures(snapshot.rules.forcedCaptures);
      }

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
      pendingActionRef.current = null;
      setRoom(null);
      setPlayerColor(null);
      setActiveDenName(null);
      setRoomForcedCaptures(null);
      setSelected(null);
      clearSessionPersistence();
      setMessage('You left the den.');
    });
  }

  function ensureSocket(
    targetUrl = FALLBACK_SERVER_URLS[serverUrlIndexRef.current] ?? SERVER_URL,
    transportMode: SocketTransportMode = 'default'
  ) {
    if (socketRef.current && socketUrlRef.current === targetUrl && socketTransportModeRef.current === transportMode) {
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

    const { origin, path } = getSocketConnectionConfig(targetUrl);

    const socket = io(origin, {
      autoConnect: true,
      path,
      transports: transportMode === 'websocket' ? ['websocket'] : ['polling', 'websocket'],
      rememberUpgrade: true
    });

    socketRef.current = socket;
    socketUrlRef.current = targetUrl;
    socketTransportModeRef.current = transportMode;
    bindSocket(socket);
    return socket;
  }

  function handleCreateRoom() {
    const trimmedDenName = denNameInput.trim();
    const password = roomPasswordInput.trim();
    const createPayload = {
      name: playerName,
      roomName: trimmedDenName || undefined,
      password: password || undefined,
      preferredColor: preferredSide === 'auto' ? undefined : preferredSide,
      forcedCaptures: forcedCapturesInput
    };

    if (!canInteractWithServer) {
      pendingActionRef.current = {
        type: 'create',
        payload: createPayload
      };
      hasAttemptedRestoreRef.current = true;
      setMessage('Reconnecting... your den will open when the link is back.');
      ensureSocket();
      return;
    }

    const socket = ensureSocket();
    setRoomForcedCaptures(forcedCapturesInput);
    socket.emit('room:create', createPayload);
  }

  function handleJoinRoom() {
    const code = roomCodeInput.trim().toUpperCase();
    if (!code) {
      setMessage('Enter a den code first.');
      return;
    }

    const password = roomPasswordInput.trim();
    const joinPayload = {
      roomCode: code,
      name: playerName,
      password: password || undefined,
      preferredColor: preferredSide === 'auto' ? undefined : preferredSide
    };

    if (!canInteractWithServer) {
      pendingActionRef.current = {
        type: 'join',
        payload: joinPayload
      };
      hasAttemptedRestoreRef.current = true;
      setMessage(`Reconnecting... joining den ${code} when the link returns.`);
      ensureSocket();
      return;
    }

    const sessionForRestore: StoredSession = {
      roomCode: code,
      playerName,
      password,
      denName: denNameInput,
      preferredSide,
      forcedCaptures: forcedCapturesInput
    };
    persistSession(sessionForRestore);

    const socket = ensureSocket();
    socket.emit('room:join', joinPayload);
  }

  function handleLeaveRoom() {
    socketRef.current?.emit('room:leave');
    setRoom(null);
    setPlayerColor(null);
    setActiveDenName(null);
    setRoomForcedCaptures(null);
    setSelected(null);
    clearSessionPersistence();
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

    const pieceMoves = getLegalMoves(room.state, position, { forcedCaptures: activeForcedCaptures });
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
              <span className="label">Den name</span>
              <input value={denNameInput} onChange={(event) => setDenNameInput(event.target.value)} maxLength={36} placeholder="My cozy den" />
            </label>
            <label>
              <span className="label">Den code</span>
              <input value={roomCodeInput} onChange={(event) => setRoomCodeInput(event.target.value.toUpperCase())} maxLength={5} placeholder="ABCDE" />
            </label>
            <label>
              <span className="label">Password</span>
              <input type="password" value={roomPasswordInput} onChange={(event) => setRoomPasswordInput(event.target.value)} maxLength={32} placeholder="Optional" />
            </label>
            <label>
              <span className="label">Preferred side</span>
              <select value={preferredSide} onChange={(event) => setPreferredSide(event.target.value as SidePreference)}>
                <option value="auto">Auto assign</option>
                <option value="red">Violet</option>
                <option value="black">Azure</option>
              </select>
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={forcedCapturesInput} onChange={(event) => setForcedCapturesInput(event.target.checked)} />
              <span>Force jumps</span>
            </label>
            <div className="button-row">
              <button type="button" onClick={handleCreateRoom}>Open den</button>
              <button type="button" className="secondary" onClick={handleJoinRoom}>Enter den</button>
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
            <span className="label">Den name</span>
            <strong>{activeDenName ?? room?.name ?? '—'}</strong>
          </div>
          <div className="status-row">
            <span className="label">Password</span>
            <strong>{room?.hasPassword || roomPasswordInput ? 'protected' : 'open'}</strong>
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
          <div className="status-row">
            <span className="label">Forced jumps</span>
            <strong>{activeForcedCaptures ? 'on' : 'off'}</strong>
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
              : activeForcedCaptures
                ? 'Select a piece, then tap a lit square to move. Captures are forced.'
                : 'Select a piece, then tap a lit square to move. Captures are optional.'}
          </p>
        </header>

        <div className="board-frame">
          <CheckersScene
            state={room?.state ?? null}
            localColor={playerColor}
            selected={selected}
            legalMoves={legalMoves}
            canInteract={canInteractWithBoard}
            onSquareClick={handleSquareClick}
          />
        </div>
      </main>
    </div>
  );
}
