(function (global) {
  "use strict";

  function createPiece(id, team, club, row, col) {
    return { id, team, club, row, col, promoted: false, status: [] };
  }

  function createInitialPieces() {
    const pieces = [];
    const homeCols = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const backLine = [
      ["chemistry", 0],
      ["swim", 1],
      ["judo", 2],
      ["kendo", 3],
      ["president", 4],
      ["kendo", 5],
      ["judo", 6],
      ["swim", 7],
      ["chemistry", 8]
    ];

    for (const col of homeCols) {
      pieces.push(createPiece(`blue-home-${col}`, "blue", "home", 6, col));
      pieces.push(createPiece(`red-home-${col}`, "red", "home", 2, col));
    }

    pieces.push(createPiece("blue-track-1", "blue", "track", 7, 1));
    pieces.push(createPiece("blue-rugby-1", "blue", "rugby", 7, 4));
    pieces.push(createPiece("blue-archery-1", "blue", "archery", 7, 7));
    pieces.push(createPiece("red-archery-1", "red", "archery", 1, 1));
    pieces.push(createPiece("red-rugby-1", "red", "rugby", 1, 4));
    pieces.push(createPiece("red-track-1", "red", "track", 1, 7));

    for (const [club, col] of backLine) {
      pieces.push(createPiece(`blue-${club}-${col}`, "blue", club, 8, col));
      pieces.push(createPiece(`red-${club}-${col}`, "red", club, 0, col));
    }

    return pieces;
  }

  global.BukatsuPieces = { createInitialPieces };
})(globalThis);
