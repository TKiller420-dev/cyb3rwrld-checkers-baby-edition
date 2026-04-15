import type { Board, Color, GameState, Move, Piece, Position } from './types';

const BOARD_SIZE = 8;

function isDarkSquare(row: number, col: number) {
  return (row + col) % 2 === 1;
}

function inBounds(row: number, col: number) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

function isSamePosition(left: Position, right: Position) {
  return left.row === right.row && left.col === right.col;
}

function getOpponentColor(color: Color): Color {
  return color === 'red' ? 'black' : 'red';
}

function getDirections(piece: Piece): Array<[number, number]> {
  if (piece.king) {
    return [
      [-1, -1],
      [-1, 1],
      [1, -1],
      [1, 1]
    ];
  }

  return piece.color === 'red'
    ? [
        [-1, -1],
        [-1, 1]
      ]
    : [
        [1, -1],
        [1, 1]
      ];
}

function getPiece(board: Board, position: Position) {
  if (!inBounds(position.row, position.col)) {
    return null;
  }

  return board[position.row][position.col];
}

function isPromotionRow(piece: Piece, row: number) {
  return (piece.color === 'red' && row === 0) || (piece.color === 'black' && row === BOARD_SIZE - 1);
}

function listPositionsForColor(board: Board, color: Color) {
  const positions: Position[] = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (piece?.color === color) {
        positions.push({ row, col });
      }
    }
  }

  return positions;
}

function listSimpleMovesForPiece(board: Board, from: Position, piece: Piece): Move[] {
  const moves: Move[] = [];

  for (const [rowDelta, colDelta] of getDirections(piece)) {
    const nextRow = from.row + rowDelta;
    const nextCol = from.col + colDelta;

    if (!inBounds(nextRow, nextCol) || !isDarkSquare(nextRow, nextCol)) {
      continue;
    }

    if (board[nextRow][nextCol] === null) {
      moves.push({
        from,
        to: { row: nextRow, col: nextCol }
      });
    }
  }

  return moves;
}

function listCapturesForPiece(board: Board, from: Position, piece: Piece): Move[] {
  const moves: Move[] = [];

  for (const [rowDelta, colDelta] of getDirections(piece)) {
    const middleRow = from.row + rowDelta;
    const middleCol = from.col + colDelta;
    const landingRow = from.row + rowDelta * 2;
    const landingCol = from.col + colDelta * 2;

    if (!inBounds(middleRow, middleCol) || !inBounds(landingRow, landingCol)) {
      continue;
    }

    const jumpedPiece = board[middleRow][middleCol];
    if (!jumpedPiece || jumpedPiece.color === piece.color) {
      continue;
    }

    if (!isDarkSquare(landingRow, landingCol) || board[landingRow][landingCol] !== null) {
      continue;
    }

    moves.push({
      from,
      to: { row: landingRow, col: landingCol },
      capturedPosition: { row: middleRow, col: middleCol }
    });
  }

  return moves;
}

function countPieces(board: Board, color: Color) {
  let total = 0;

  for (const row of board) {
    for (const piece of row) {
      if (piece?.color === color) {
        total += 1;
      }
    }
  }

  return total;
}

export function createInitialState(): GameState {
  const board: Board = Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null));

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      if (!isDarkSquare(row, col)) {
        continue;
      }

      if (row < 3) {
        board[row][col] = { color: 'black', king: false };
      }

      if (row > 4) {
        board[row][col] = { color: 'red', king: false };
      }
    }
  }

  return {
    board,
    turn: 'red',
    winner: null,
    mustContinueFrom: null,
    lastMove: null
  };
}

export function getLegalMoves(state: GameState, from?: Position): Move[] {
  if (state.winner) {
    return [];
  }

  if (from && state.mustContinueFrom && !isSamePosition(from, state.mustContinueFrom)) {
    return [];
  }

  const candidatePositions = state.mustContinueFrom
    ? [state.mustContinueFrom]
    : from
      ? [from]
      : listPositionsForColor(state.board, state.turn);

  const captureMoves: Move[] = [];
  const simpleMoves: Move[] = [];

  for (const position of candidatePositions) {
    const piece = getPiece(state.board, position);
    if (!piece || piece.color !== state.turn) {
      continue;
    }

    const pieceCaptures = listCapturesForPiece(state.board, position, piece);
    captureMoves.push(...pieceCaptures);

    if (pieceCaptures.length === 0 && !state.mustContinueFrom) {
      simpleMoves.push(...listSimpleMovesForPiece(state.board, position, piece));
    }
  }

  return captureMoves.length > 0 ? captureMoves : simpleMoves;
}

export function applyMove(state: GameState, requestedMove: Move): GameState {
  const piece = getPiece(state.board, requestedMove.from);
  if (!piece) {
    throw new Error('No piece at the selected square.');
  }

  if (piece.color !== state.turn) {
    throw new Error('It is not that piece\'s turn.');
  }

  const legalMove = getLegalMoves(state, requestedMove.from).find((move) => isSamePosition(move.to, requestedMove.to));
  if (!legalMove) {
    throw new Error('That move is not legal.');
  }

  const board = cloneBoard(state.board);
  const movingPiece = board[requestedMove.from.row][requestedMove.from.col];
  if (!movingPiece) {
    throw new Error('The selected piece is missing.');
  }

  board[requestedMove.from.row][requestedMove.from.col] = null;
  if (legalMove.capturedPosition) {
    board[legalMove.capturedPosition.row][legalMove.capturedPosition.col] = null;
  }

  let becameKing = false;
  if (!movingPiece.king && isPromotionRow(movingPiece, legalMove.to.row)) {
    movingPiece.king = true;
    becameKing = true;
  }

  board[legalMove.to.row][legalMove.to.col] = movingPiece;

  const nextState: GameState = {
    board,
    turn: state.turn,
    winner: null,
    mustContinueFrom: null,
    lastMove: legalMove
  };

  const opponent = getOpponentColor(state.turn);
  if (countPieces(board, opponent) === 0) {
    nextState.winner = state.turn;
    return nextState;
  }

  if (legalMove.capturedPosition && !becameKing) {
    const continuationState: GameState = {
      ...nextState,
      mustContinueFrom: legalMove.to
    };

    const followUpCaptures = getLegalMoves(continuationState, legalMove.to).filter((move) => Boolean(move.capturedPosition));
    if (followUpCaptures.length > 0) {
      return continuationState;
    }
  }

  nextState.turn = opponent;

  const opponentMoves = getLegalMoves({
    ...nextState,
    mustContinueFrom: null,
    winner: null
  });

  if (opponentMoves.length === 0) {
    nextState.winner = state.turn;
  }

  return nextState;
}

export function getPieceAt(state: GameState, position: Position) {
  return getPiece(state.board, position);
}
