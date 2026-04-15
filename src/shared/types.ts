export type Color = 'red' | 'black';

export type Position = {
  row: number;
  col: number;
};

export type Piece = {
  color: Color;
  king: boolean;
};

export type Board = Array<Array<Piece | null>>;

export type Move = {
  from: Position;
  to: Position;
  capturedPosition?: Position;
};

export type GameState = {
  board: Board;
  turn: Color;
  winner: Color | null;
  mustContinueFrom: Position | null;
  lastMove: Move | null;
};

export type RoomPlayers = {
  red: string | null;
  black: string | null;
};

export type RoomSnapshot = {
  roomCode: string;
  players: RoomPlayers;
  state: GameState;
};
