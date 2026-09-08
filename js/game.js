(function (global) {
  "use strict";

  function createGameState(cpuSchoolKey, playerLineup, baseBoard) {
    const board = baseBoard ? baseBoard.map((cell) => ({ ...cell, pieceId: null })) : global.BukatsuBoard.createBoard();
    const pieces = global.BukatsuPieces.createInitialPieces(cpuSchoolKey, playerLineup);
    const state = {
      turn: "blue",
      board: global.BukatsuBoard.hydrateBoardPieces(board, pieces),
      pieces,
      captured: { blue: [], red: [] },
      hazards: [],
      history: [],
      winner: null,
      drawReason: null,
      positionCounts: {},
      moveCount: 0
    };
    state.positionCounts[global.BukatsuRules.positionKey(state)] = 1;
    return state;
  }

  function sideName(side) {
    return side === "blue" ? "あなた" : "CPU";
  }

  global.BukatsuGame = { createGameState, sideName };
})(globalThis);

