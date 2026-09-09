(function (global) {
  "use strict";

  const { BOARD_CONFIG, CLUBS, TERRAIN } = global.BukatsuConfig;
  const DIRECTIONS = [
    [-1, -1], [-1, 0], [-1, 1],
    [0, -1], [0, 1],
    [1, -1], [1, 0], [1, 1]
  ];
  const ORTHOGONAL = [[-1, 0], [0, -1], [0, 1], [1, 0]];
  const DIAGONAL = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  function cloneState(state) {
    return {
      turn: state.turn,
      board: state.board.map((cell) => ({ ...cell })),
      pieces: state.pieces.map((piece) => ({ ...piece })),
      captured: { blue: [...state.captured.blue], red: [...state.captured.red] },
      history: state.history.map((entry) => ({ ...entry })),
      winner: state.winner,
      drawReason: state.drawReason,
      positionCounts: { ...state.positionCounts },
      moveCount: state.moveCount
    };
  }


  function positionKey(state) {
    const pieces = state.pieces.map((piece) => ({
      id: piece.id,
      team: piece.team,
      originalTeam: piece.originalTeam || piece.team,
      club: piece.club,
      row: piece.row,
      col: piece.col,
      promoted: piece.promoted,
      captured: Boolean(piece.captured)
    })).sort((a, b) => a.id.localeCompare(b.id));
    return JSON.stringify({ turn: state.turn, pieces, captured: state.captured });
  }

  function isFinished(state) {
    return Boolean(getWinner(state) || state.drawReason);
  }  function inBounds(row, col) {
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

  function isPassable(state, piece, row, col) {
    if (!inBounds(row, col)) return false;
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
    const club = CLUBS[piece.club];
    const terrain = terrainAt(state, piece.row, piece.col);
    const base = club.baseMove;
    const promotedBonus = piece.promoted && piece.club !== "home" && piece.club !== "president" ? 1 : 0;
    const normalLimit = base + promotedBonus + getBonus(piece, terrain, "move");
    if (club.fieldTerrains && club.fieldTerrains.includes(terrain)) {
      return Math.min(base * 2, Math.max(normalLimit, base * 2));
    }
    return normalLimit;
  }

  function rangeFor(state, piece) {
    const terrain = terrainAt(state, piece.row, piece.col);
    return CLUBS[piece.club].attackRange + getBonus(piece, terrain, "range");
  }


  function canPromote(piece) {
    return piece.club !== "president";
  }

  function isPromotionZone(piece, row) {
    return piece.team === "blue" ? row <= 2 : row >= BOARD_CONFIG.rows - 3;
  }

  function shouldPromote(piece, fromRow, toRow) {
    return canPromote(piece) && !piece.promoted && (isPromotionZone(piece, fromRow) || isPromotionZone(piece, toRow));
  }

  function goldDirections(forward) {
    return [[forward, -1], [forward, 0], [forward, 1], [0, -1], [0, 1], [-forward, 0]];
  }
  function makeMove(piece, row, col, extra) {
    return { type: "move", pieceId: piece.id, from: { row: piece.row, col: piece.col }, to: { row, col }, captureId: null, ...extra };
  }

  function stepMoves(state, piece, dirs, distance, options) {
    const moves = [];
    for (const [dr, dc] of dirs) {
      for (let step = 1; step <= distance; step += 1) {
        const row = piece.row + dr * step;
        const col = piece.col + dc * step;
        if (!inBounds(row, col)) break;
        const target = pieceAt(state, row, col);
        if (target) {
          if (target.team !== piece.team && options.canCapture) {
            moves.push(makeMove(piece, row, col, { captureId: target.id }));
          }
          break;
        }
        if (options.canMove) moves.push(makeMove(piece, row, col));
        if (!options.slide) break;
      }
    }
    return moves;
  }

  function conversionMoves(state, piece, dirs, distance, slide) {
    return stepMoves(state, piece, dirs, distance, { canMove: true, canCapture: true, slide })
      .map((move) => {
        const target = move.captureId ? getPiece(state, move.captureId) : null;
        return target && target.club !== "president" ? { ...move, type: "attack", convert: true } : move;
      });
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

  function lineAttacks(state, piece, dirs, minRange, maxRange) {
    const moves = [];
    for (const [dr, dc] of dirs) {
      for (let distance = minRange; distance <= maxRange; distance += 1) {
        const row = piece.row + dr * distance;
        const col = piece.col + dc * distance;
        if (!inBounds(row, col)) break;
        if (!hasLineOfSight(state, piece, { row, col })) continue;
        const target = pieceAt(state, row, col);
        if (!target) continue;
        if (target.team !== piece.team) {
          moves.push({ type: "attack", pieceId: piece.id, from: { row: piece.row, col: piece.col }, to: { row, col }, captureId: target.id });
        }
        break;
      }
    }
    return moves;
  }

  function archeryAttacks(state, piece) {
    const forward = piece.team === "blue" ? -1 : 1;
    return lineAttacks(state, piece, [[forward, 0]], CLUBS[piece.club].minAttackRange || 2, CLUBS[piece.club].attackRange)
      .filter((move) => {
        const target = move.captureId ? getPiece(state, move.captureId) : null;
        return !target || !hasArcheryCover(state, piece, target);
      });
  }

  function jumpMoves(state, piece, dirs) {
    const moves = [];
    for (const [dr, dc] of dirs) {
      const midRow = piece.row + dr;
      const midCol = piece.col + dc;
      const row = piece.row + dr * 2;
      const col = piece.col + dc * 2;
      if (!inBounds(row, col)) continue;
      if (!pieceAt(state, midRow, midCol)) continue;
      const target = pieceAt(state, row, col);
      if (target && target.team === piece.team) continue;
      moves.push(makeMove(piece, row, col, { captureId: target && target.team !== piece.team ? target.id : null }));
    }
    return moves;
  }

  function generatePieceMoves(state, piece) {
    if (!piece || piece.captured || isFinished(state)) return [];
    const forward = piece.team === "blue" ? -1 : 1;
    let moves = [];

    if (piece.club === "president") {
      moves = stepMoves(state, piece, DIRECTIONS, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: false });
    } else if (piece.club === "home") {
      const homeDirs = piece.promoted ? goldDirections(forward) : [[forward, 0]];
      moves = stepMoves(state, piece, homeDirs, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: false });
    } else if (piece.club === "track") {
      moves = stepMoves(state, piece, ORTHOGONAL, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: true });
    } else if (piece.club === "archery") {
      moves = stepMoves(state, piece, DIAGONAL, moveLimitFor(state, piece), { canMove: true, canCapture: false, slide: false });
      moves.push(...archeryAttacks(state, piece));
    } else if (piece.club === "kendo") {
      moves = stepMoves(state, piece, [[forward, -1], [forward, 0], [forward, 1], [0, -1], [0, 1]], moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: true });
    } else if (piece.club === "judo") {
      moves = stepMoves(state, piece, ORTHOGONAL, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: false });
    } else if (piece.club === "swim") {
      moves = stepMoves(state, piece, ORTHOGONAL, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: true });
    } else if (piece.club === "rugby") {
      const distance = terrainAt(state, piece.row, piece.col) === "ground" ? BOARD_CONFIG.rows - 1 : 2;
      moves = stepMoves(state, piece, [[forward, 0]], distance, { canMove: true, canCapture: true, slide: true });
    } else if (piece.club === "chemistry") {
      moves = stepMoves(state, piece, ORTHOGONAL, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: false });
    } else if (piece.club === "broadcast") {
      moves = conversionMoves(state, piece, ORTHOGONAL, moveLimitFor(state, piece), false);
    } else if (piece.club === "newspaper") {
      moves = conversionMoves(state, piece, ORTHOGONAL, moveLimitFor(state, piece), true);
    } else if (piece.club === "art") {
      moves = stepMoves(state, piece, DIAGONAL, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: false });
    } else if (piece.club === "drama") {
      moves = stepMoves(state, piece, DIRECTIONS, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: false });
    } else if (piece.club === "pc") {
      moves = stepMoves(state, piece, DIAGONAL, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: false });
    } else if (piece.club === "physics") {
      moves = stepMoves(state, piece, ORTHOGONAL, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: false });
      moves.push(...jumpMoves(state, piece, ORTHOGONAL));
    } else if (piece.club === "band") {
      moves = stepMoves(state, piece, DIAGONAL, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: false });
    } else if (piece.club === "baseball") {
      moves = stepMoves(state, piece, ORTHOGONAL, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: false });
      moves.push(...lineAttacks(state, piece, ORTHOGONAL, 2, rangeFor(state, piece)));
    } else if (piece.club === "soccer") {
      moves = stepMoves(state, piece, ORTHOGONAL, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: true });
    } else if (piece.club === "basketball") {
      moves = stepMoves(state, piece, DIRECTIONS, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: false });
      moves.push(...jumpMoves(state, piece, ORTHOGONAL));
    } else if (piece.club === "volleyball") {
      moves = stepMoves(state, piece, [[forward, -1], [forward, 0], [forward, 1], [0, -1], [0, 1]], moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: false });
    }

    return moves.filter((move) => isPassable(state, piece, move.to.row, move.to.col) || move.type === "attack");
  }

  function generateLegalMoves(state, side) {
    const boardMoves = state.pieces
      .filter((piece) => piece.team === side && !piece.captured)
      .flatMap((piece) => generatePieceMoves(state, piece));
    const dropMoves = state.captured[side]
      .flatMap((pieceId) => generateDropMoves(state, pieceId, side));
    return boardMoves.concat(dropMoves);
  }

  function generateDropMoves(state, pieceId, side) {
    const piece = getPiece(state, pieceId);
    if (!piece || !piece.captured || piece.club === "president" || isFinished(state)) return [];
    if (!state.captured[side] || !state.captured[side].includes(pieceId)) return [];

    const dropPiece = { ...piece, team: side, promoted: false };
    return state.board
      .filter((cell) => {
        if (pieceAt(state, cell.row, cell.col)) return false;
        if (!isPassable(state, dropPiece, cell.row, cell.col)) return false;
        if (piece.club !== "home") return true;
        return !state.pieces.some((other) => (
          !other.captured
          && other.team === side
          && other.club === "home"
          && !other.promoted
          && other.col === cell.col
        ));
      })
      .map((cell) => ({
        type: "drop",
        pieceId,
        side,
        from: null,
        to: { row: cell.row, col: cell.col },
        captureId: null,
        convert: false
      }));
  }

  function captureTarget(next, attacker, target) {
    if (!target || target.team === attacker.team) return;
    target.captured = true;
    target.promoted = false;
    next.captured[attacker.team].push(target.id);
    if (target.club === "president") next.winner = attacker.team;
  }

  function applyMove(state, move) {
    const next = cloneState(state);
    const piece = getPiece(next, move.pieceId);
    if (!piece || isFinished(next)) return next;
    const movingClub = piece.club;
    const movingTeam = move.type === "drop" ? move.side : piece.team;

    if (move.type === "drop") {
      const legalDrop = generateDropMoves(next, piece.id, movingTeam)
        .some((candidate) => candidate.to.row === move.to.row && candidate.to.col === move.to.col);
      if (!legalDrop) return next;
      next.captured[movingTeam] = next.captured[movingTeam].filter((pieceId) => pieceId !== piece.id);
      piece.captured = false;
      piece.team = movingTeam;
      piece.originalTeam = movingTeam;
      piece.promoted = false;
      piece.row = move.to.row;
      piece.col = move.to.col;
    } else if (piece.captured) {
      return next;
    }

    if (move.type === "attack") {
      const target = move.captureId ? getPiece(next, move.captureId) : pieceAt(next, move.to.row, move.to.col);
      if (!target || target.captured || target.team === piece.team) return next;
      if (move.convert && target.club !== "president") {
        target.originalTeam = target.originalTeam || target.team;
        target.team = piece.team;
      } else {
        captureTarget(next, piece, target);
      }
    } else if (move.type !== "drop") {
      captureTarget(next, piece, move.captureId ? getPiece(next, move.captureId) : pieceAt(next, move.to.row, move.to.col));
      piece.row = move.to.row;
      piece.col = move.to.col;
      if (shouldPromote(piece, move.from.row, piece.row)) piece.promoted = true;
    }

    next.turn = movingTeam === "blue" ? "red" : "blue";
    next.moveCount += 1;
    next.history.push({
      side: movingTeam,
      club: movingClub,
      pieceId: piece.id,
      type: move.type,
      fromRow: move.from ? move.from.row : null,
      fromCol: move.from ? move.from.col : null,
      toRow: move.to.row,
      toCol: move.to.col,
      captureId: move.captureId || null,
      convert: Boolean(move.convert),
      promoted: piece.promoted || false
    });
    const key = positionKey(next);
    next.positionCounts[key] = (next.positionCounts[key] || 0) + 1;
    if (next.positionCounts[key] >= 4) next.drawReason = "sennichite";
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
    if (isFinished(state)) return false;
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
    generateDropMoves,
    generateLegalMoves,
    applyMove,
    hasLineOfSight,
    getWinner,
    isFinished,
    positionKey,
    isSideInCheck,
    moveLimitFor,
    rangeFor
  };
})(globalThis);
