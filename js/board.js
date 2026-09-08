(function (global) {
  "use strict";

  const { BOARD_CONFIG } = global.BukatsuConfig;

  const FACILITY_TERRAINS = [
    "ground",
    "classroom",
    "gym",
    "pool",
    "lab",
    "archeryRange",
    "clubhouse",
    "tennis"
  ];
  const BLOCK_SHAPES = [
    { rows: 4, cols: 2 },
    { rows: 2, cols: 4 }
  ];

  function shuffle(items) {
    const next = [...items];
    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return next;
  }

  function blockCells(anchorRow, anchorCol, shape) {
    const cells = [];
    for (let row = anchorRow; row < anchorRow + shape.rows; row += 1) {
      for (let col = anchorCol; col < anchorCol + shape.cols; col += 1) {
        cells.push({ row, col });
      }
    }
    return cells;
  }

  function canPlace(terrainByCoord, cells) {
    return cells.every((cell) => terrainByCoord.get(`${cell.row},${cell.col}`) === "courtyard");
  }

  function placeCells(terrainByCoord, cells, terrain) {
    for (const cell of cells) {
      terrainByCoord.set(`${cell.row},${cell.col}`, terrain);
    }
  }

  function candidateBlocks() {
    const candidates = [];
    for (const shape of BLOCK_SHAPES) {
      for (let row = 0; row <= BOARD_CONFIG.rows - shape.rows; row += 1) {
        for (let col = 0; col <= BOARD_CONFIG.cols - shape.cols; col += 1) {
          candidates.push({ row, col, shape });
        }
      }
    }
    return shuffle(candidates);
  }

  function createTerrainMap() {
    const terrainByCoord = new Map();
    for (let row = 0; row < BOARD_CONFIG.rows; row += 1) {
      for (let col = 0; col < BOARD_CONFIG.cols; col += 1) {
        terrainByCoord.set(`${row},${col}`, "courtyard");
      }
    }

    const terrains = shuffle([...FACILITY_TERRAINS, ...FACILITY_TERRAINS]).slice(0, 6 + Math.floor(Math.random() * 3));
    const candidates = candidateBlocks();
    for (const terrain of terrains) {
      const candidateIndex = candidates.findIndex((candidate) => canPlace(terrainByCoord, blockCells(candidate.row, candidate.col, candidate.shape)));
      if (candidateIndex === -1) continue;
      const [candidate] = candidates.splice(candidateIndex, 1);
      placeCells(terrainByCoord, blockCells(candidate.row, candidate.col, candidate.shape), terrain);
    }

    return terrainByCoord;
  }

  function createBoard() {
    const cells = [];
    const terrainByCoord = createTerrainMap();
    for (let row = 0; row < BOARD_CONFIG.rows; row += 1) {
      for (let col = 0; col < BOARD_CONFIG.cols; col += 1) {
        cells.push({ row, col, terrain: terrainByCoord.get(`${row},${col}`), pieceId: null });
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

  global.BukatsuBoard = { createBoard, hydrateBoardPieces };
})(globalThis);