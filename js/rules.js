(function (global) {
  "use strict";

  const { BOARD_CONFIG, CLUBS, TERRAIN } = global.BukatsuConfig;
  const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ];
  const ORTHOGONAL = [[-1, 0], [0, -1], [0, 1], [1, 0]];

  function cloneState(state) {
    return {
      turn: state.turn,
      board: state.board.map((cell) => ({ ...cell })),
      pieces: state.pieces.map((piece) => ({ ...piece, status: [...piece.status] })),
      captured: { blue: [...state.captured.blue], red: [...state.captured.red] },
      hazards: state.hazards.map((hazard) => ({ ...hazard })),
      history: state.history.map((entry) => ({ ...entry })),
      winner: state.winner,
      moveCount: state.moveCount
    };
  }

  function inBounds(row, col) {
    return row >= 0 && col >= 0 && row < BOARD_CONFIG.rows && col < BOARD_CONFIG.cols;
  }

  function cellAt(state, row, col) {
    return state.board.find((cell) => cell.row === row && cell.col === col);
  }

  function terrainAt(state, row, col) {
    const cell = cellAt(state, row, col);
    return cell ? cell.terrain : null;
  }

  function pieceAt(state, row, col) {
    return state.pieces.find((piece) => !piece.captured && piece.row === row && piece.col === col) || null;
  }

  function getPiece(state, pieceId) {
    return state.pieces.find((piece) => piece.id === pieceId) || null;
  }

  function hasHazard(state, row, col) {
    return state.hazards.some((hazard) => hazard.row === row && hazard.col === col);
  }

  function isPassable(state, piece, row, col) {
    if (!inBounds(row, col) || hasHazard(state, row, col)) return false;
    const occupying = pieceAt(state, row, col);
    if (occupying && occupying.team === piece.team) return false;
    const terrain = terrainAt(state, row, col);
    if (terrain === "pool" && piece.club !== "swim") {
      return piece.club === "president" || piece.club === "home";
    }
    return true;
  }

  function getBonus(piece, terrain, key) {
    const club = CLUBS[piece.club];
    return club.terrainBonus && club.terrainBonus[terrain] ? club.terrainBonus[terrain][key] || 0 : 0;
  }

  function moveLimitFor(state, piece) {
    const terrain = terrainAt(state, piece.row, piece.col);
    return CLUBS[piece.club].baseMove + getBonus(piece, terrain, "move");
  }

  function rangeFor(state, piece) {
    const terrain = terrainAt(state, piece.row, piece.col);
    return CLUBS[piece.club].attackRange + getBonus(piece, terrain, "range");
  }

  function specialRangeFor(state, piece) {
    const terrain = terrainAt(state, piece.row, piece.col);
    return (CLUBS[piece.club].specialRange || 0) + getBonus(piece, terrain, "specialRange");
  }

  function stepMoves(state, piece, dirs, distance, options) {
    const moves = [];
    for (const [dr, dc] of dirs) {
      for (let step = 1; step <= distance; step += 1) {
        const row = piece.row + dr * step;
        const col = piece.col + dc * step;
        if (!inBounds(row, col) || hasHazard(state, row, col)) break;
        const target = pieceAt(state, row, col);
        if (target) {
          if (target.team !== piece.team && options.canCapture) {
            moves.push({ type: "move", pieceId: piece.id, from: { row: piece.row, col: piece.col }, to: { row, col }, captureId: target.id });
          }
          break;
        }
        if (options.canMove) {
          moves.push({ type: "move", pieceId: piece.id, from: { row: piece.row, col: piece.col }, to: { row, col }, captureId: null });
        }
        if (!options.slide) break;
      }
    }
    return moves;
  }

  function hasLineOfSight(state, from, to) {
    const dr = Math.sign(to.row - from.row);
    const dc = Math.sign(to.col - from.col);
    const rowDistance = Math.abs(to.row - from.row);
    const colDistance = Math.abs(to.col - from.col);
    if (!(rowDistance === 0 || colDistance === 0 || rowDistance === colDistance)) return false;

    let row = from.row + dr;
    let col = from.col + dc;
    while (row !== to.row || col !== to.col) {
      const terrain = terrainAt(state, row, col);
      if (TERRAIN[terrain] && TERRAIN[terrain].blocksLine) return false;
      if (pieceAt(state, row, col)) return false;
      row += dr;
      col += dc;
    }
    return true;
  }

  function hasArcheryCover(state, attacker, target) {
    if (CLUBS[target.club].shield) return true;
    const dr = Math.sign(target.row - attacker.row);
    const dc = Math.sign(target.col - attacker.col);
    const coverRow = target.row - dr;
    const coverCol = target.col - dc;
    const cover = pieceAt(state, coverRow, coverCol);
    return Boolean(cover && cover.team === target.team && CLUBS[cover.club].shield);
  }

  function archeryAttacks(state, piece) {
    const moves = [];
    const minRange = CLUBS[piece.club].minAttackRange || 1;
    const maxRange = rangeFor(state, piece);
    for (const [dr, dc] of DIRECTIONS) {
      for (let distance = minRange; distance <= maxRange; distance += 1) {
        const row = piece.row + dr * distance;
        const col = piece.col + dc * distance;
        if (!inBounds(row, col)) break;
        if (!hasLineOfSight(state, piece, { row, col })) continue;
        const target = pieceAt(state, row, col);
        if (!target) continue;
        if (target.team !== piece.team && !hasArcheryCover(state, piece, target)) {
          moves.push({ type: "attack", pieceId: piece.id, from: { row: piece.row, col: piece.col }, to: { row, col }, captureId: target.id });
        }
        break;
      }
    }
    return moves;
  }

  function chemistrySpecials(state, piece) {
    const moves = [];
    const range = specialRangeFor(state, piece);
    for (let row = piece.row - range; row <= piece.row + range; row += 1) {
      for (let col = piece.col - range; col <= piece.col + range; col += 1) {
        const distance = Math.abs(row - piece.row) + Math.abs(col - piece.col);
        if (!inBounds(row, col) || distance === 0 || distance > range) continue;
        if (pieceAt(state, row, col) || hasHazard(state, row, col)) continue;
        moves.push({ type: "special", special: "hazard", pieceId: piece.id, from: { row: piece.row, col: piece.col }, to: { row, col } });
      }
    }
    return moves;
  }

  function generatePieceMoves(state, piece) {
    if (!piece || piece.captured || state.winner) return [];
    const forward = piece.team === "blue" ? -1 : 1;
    const club = CLUBS[piece.club];
    let moves = [];

    if (piece.club === "president") {
      moves = stepMoves(state, piece, DIRECTIONS, 1, { canMove: true, canCapture: true, slide: false });
    } else if (piece.club === "home") {
      moves = stepMoves(state, piece, [[forward, 0]], 1, { canMove: true, canCapture: true, slide: false });
    } else if (piece.club === "track") {
      moves = stepMoves(state, piece, ORTHOGONAL, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: true });
    } else if (piece.club === "archery") {
      moves = stepMoves(state, piece, DIRECTIONS, club.baseMove, { canMove: true, canCapture: false, slide: false });
      moves.push(...archeryAttacks(state, piece));
    } else if (piece.club === "kendo") {
      moves = stepMoves(state, piece, DIRECTIONS, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: true });
    } else if (piece.club === "judo") {
      moves = stepMoves(state, piece, ORTHOGONAL, 1, { canMove: true, canCapture: true, slide: false });
    } else if (piece.club === "swim") {
      moves = stepMoves(state, piece, DIRECTIONS, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: true });
    } else if (piece.club === "rugby") {
      moves = stepMoves(state, piece, [[forward, 0], [forward, -1], [forward, 1]], club.baseMove, { canMove: true, canCapture: true, slide: true });
      moves.push(...stepMoves(state, piece, [[0, -1], [0, 1]], 1, { canMove: true, canCapture: true, slide: false }));
    } else if (piece.club === "chemistry") {
      moves = stepMoves(state, piece, DIRECTIONS, 1, { canMove: true, canCapture: true, slide: false });
      moves.push(...chemistrySpecials(state, piece));
    }

    return moves.filter((move) => isPassable(state, piece, move.to.row, move.to.col) || move.type === "special");
  }

  function generateLegalMoves(state, side) {
    return state.pieces
      .filter((piece) => piece.team === side && !piece.captured)
      .flatMap((piece) => generatePieceMoves(state, piece));
  }

  function applyMove(state, move) {
    const next = cloneState(state);
    const piece = getPiece(next, move.pieceId);
    if (!piece || piece.captured || next.winner) return next;
    const movingClub = piece.club;
    const movingTeam = piece.team;

    if (move.type === "special") {
      next.hazards.push({ row: move.to.row, col: move.to.col, team: piece.team, turns: 2 });
    } else {
      const target = move.captureId ? getPiece(next, move.captureId) : pieceAt(next, move.to.row, move.to.col);
      if (target && target.team !== piece.team) {
        target.captured = true;
        next.captured[piece.team].push(target.id);
        if (target.club === "president") {
          next.winner = piece.team;
        }
      }
      piece.row = move.to.row;
      piece.col = move.to.col;
    }

    next.turn = piece.team === "blue" ? "red" : "blue";
    next.moveCount += 1;
    next.history.push({
      side: movingTeam,
      club: movingClub,
      type: move.type,
      fromRow: move.from.row,
      fromCol: move.from.col,
      toRow: move.to.row,
      toCol: move.to.col,
      captureId: move.captureId || null
    });
    next.hazards = next.hazards
      .map((hazard) => ({ ...hazard, turns: hazard.turns - 1 }))
      .filter((hazard) => hazard.turns > 0);
    next.board = global.BukatsuBoard.hydrateBoardPieces(next.board, next.pieces);
    return next;
  }

  function getWinner(state) {
    if (state.winner) return state.winner;
    const bluePresident = state.pieces.find((piece) => piece.team === "blue" && piece.club === "president");
    const redPresident = state.pieces.find((piece) => piece.team === "red" && piece.club === "president");
    if (!bluePresident || bluePresident.captured) return "red";
    if (!redPresident || redPresident.captured) return "blue";
    return null;
  }

  function isSideInCheck(state, side) {
    if (getWinner(state)) return false;
    const president = state.pieces.find((piece) => piece.team === side && piece.club === "president" && !piece.captured);
    if (!president) return false;
    const enemy = side === "blue" ? "red" : "blue";
    return generateLegalMoves(state, enemy).some((move) => move.captureId === president.id);
  }

  global.BukatsuRules = {
    cloneState,
    inBounds,
    cellAt,
    terrainAt,
    pieceAt,
    getPiece,
    generatePieceMoves,
    generateLegalMoves,
    applyMove,
    hasLineOfSight,
    getWinner,
    isSideInCheck,
    moveLimitFor,
    rangeFor
  };
})(globalThis);
