(function (global) {
  "use strict";

  function createGameState() {
    const board = global.BukatsuBoard.createBoard();
    const pieces = global.BukatsuPieces.createInitialPieces();
    return {
      turn: "blue",
      board: global.BukatsuBoard.hydrateBoardPieces(board, pieces),
      pieces,
      captured: { blue: [], red: [] },
      hazards: [],
      history: [],
      winner: null,
      moveCount: 0
    };
  }

  function sideName(side) {
    return side === "blue" ? "あなた" : "CPU";
  }

  global.BukatsuGame = { createGameState, sideName };
})(globalThis);
