(function (global) {
  "use strict";

  const { BOARD_CONFIG } = global.BukatsuConfig;

  function terrainFor(row, col) {
    if (row <= 1 && col <= 2) return "archeryRange";
    if (row <= 1 && col >= 3 && col <= 5) return "clubhouse";
    if (row <= 1 && col >= 6) return "tennis";
    if (row >= 7 && col <= 2) return "gym";
    if (row >= 7 && col >= 3 && col <= 5) return "courtyard";
    if (row >= 7 && col >= 6) return "courtyard";
    if (col <= 2 && row >= 2 && row <= 3) return "classroom";
    if (col <= 2 && row >= 4 && row <= 5) return "lab";
    if (col >= 6 && row >= 3 && row <= 5) return "pool";
    if (col >= 3 && row >= 2 && row <= 5) return "ground";
    if (row === 6 && col <= 2) return "gym";
    if (row === 6 && col >= 6) return "courtyard";
    return "courtyard";
  }

  function createBoard() {
    const cells = [];
    for (let row = 0; row < BOARD_CONFIG.rows; row += 1) {
      for (let col = 0; col < BOARD_CONFIG.cols; col += 1) {
        cells.push({ row, col, terrain: terrainFor(row, col), pieceId: null });
      }
    }
    return cells;
  }

  function hydrateBoardPieces(board, pieces) {
    const nextBoard = board.map((cell) => ({ ...cell, pieceId: null }));
    const byCoord = new Map(nextBoard.map((cell) => [`${cell.row},${cell.col}`, cell]));
    for (const piece of pieces) {
      if (!piece.captured) {
        const cell = byCoord.get(`${piece.row},${piece.col}`);
        if (cell) cell.pieceId = piece.id;
      }
    }
    return nextBoard;
  }

  global.BukatsuBoard = { createBoard, hydrateBoardPieces, terrainFor };
})(globalThis);
