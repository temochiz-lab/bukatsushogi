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
      pieces: state.pieces.map((piece) => ({ ...piece, status: piece.status.map((item) => ({ ...item })) })),
      captured: { blue: [...state.captured.blue], red: [...state.captured.red] },
      hazards: state.hazards.map((hazard) => ({ ...hazard })),
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
      captured: Boolean(piece.captured),
      status: piece.status.map((item) => ({ ...item })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))
    })).sort((a, b) => a.id.localeCompare(b.id));
    const hazards = state.hazards.map((hazard) => ({ ...hazard })).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    return JSON.stringify({ turn: state.turn, pieces, hazards, captured: state.captured });
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

  function decoyAt(state, row, col) {
    return state.hazards.find((hazard) => hazard.kind === "decoy" && hazard.row === row && hazard.col === col) || null;
  }

  function hasHazard(state, row, col) {
    return state.hazards.some((hazard) => hazard.kind !== "decoy" && hazard.row === row && hazard.col === col);
  }

  function hasStatus(piece, type) {
    return piece.status.some((item) => item.type === type);
  }

  function isPassable(state, piece, row, col) {
    if (!inBounds(row, col) || hasHazard(state, row, col)) return false;
    const occupying = pieceAt(state, row, col);
    if (occupying && occupying.team === piece.team) return false;
    const decoy = decoyAt(state, row, col);
    if (decoy && decoy.team === piece.team) return false;
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
    const boost = hasStatus(piece, "boost") ? 1 : 0;
    return CLUBS[piece.club].attackRange + getBonus(piece, terrain, "range") + boost;
  }

  function specialRangeFor(state, piece) {
    const terrain = terrainAt(state, piece.row, piece.col);
    const boost = hasStatus(piece, "boost") ? 1 : 0;
    return (CLUBS[piece.club].specialRange || 0) + getBonus(piece, terrain, "specialRange") + boost;
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
        if (!inBounds(row, col) || hasHazard(state, row, col)) break;
        const decoy = decoyAt(state, row, col);
        const target = pieceAt(state, row, col);
        if (decoy) {
          if (decoy.team !== piece.team && options.canCapture && !hasStatus(piece, "noCapture")) {
            moves.push(makeMove(piece, row, col, { captureDecoy: true }));
          }
          break;
        }
        if (target) {
          if (target.team !== piece.team && options.canCapture && !hasStatus(piece, "noCapture")) {
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
      if (pieceAt(state, row, col) || decoyAt(state, row, col)) return false;
      row += dr;
      col += dc;
    }
    return true;
  }

  function hasArcheryCover(state, attacker, target) {
    if (CLUBS[target.club].shield || hasStatus(target, "guard")) return true;
    const dr = Math.sign(target.row - attacker.row);
    const dc = Math.sign(target.col - attacker.col);
    const coverRow = target.row - dr;
    const coverCol = target.col - dc;
    const cover = pieceAt(state, coverRow, coverCol);
    return Boolean(cover && cover.team === target.team && (CLUBS[cover.club].shield || hasStatus(cover, "guard")));
  }

  function lineAttacks(state, piece, dirs, minRange, maxRange) {
    const moves = [];
    if (hasStatus(piece, "noCapture")) return moves;
    for (const [dr, dc] of dirs) {
      for (let distance = minRange; distance <= maxRange; distance += 1) {
        const row = piece.row + dr * distance;
        const col = piece.col + dc * distance;
        if (!inBounds(row, col)) break;
        if (!hasLineOfSight(state, piece, { row, col })) continue;
        const decoy = decoyAt(state, row, col);
        const target = pieceAt(state, row, col);
        if (decoy && decoy.team !== piece.team) {
          moves.push({ type: "attack", pieceId: piece.id, from: { row: piece.row, col: piece.col }, to: { row, col }, captureDecoy: true });
          break;
        }
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

  function chemistrySpecials(state, piece) {
    const moves = [];
    const range = specialRangeFor(state, piece);
    for (let row = piece.row - range; row <= piece.row + range; row += 1) {
      for (let col = piece.col - range; col <= piece.col + range; col += 1) {
        const distance = Math.abs(row - piece.row) + Math.abs(col - piece.col);
        if (!inBounds(row, col) || distance === 0 || distance > range) continue;
        if (pieceAt(state, row, col) || hasHazard(state, row, col) || decoyAt(state, row, col)) continue;
        moves.push({ type: "special", special: "hazard", pieceId: piece.id, from: { row: piece.row, col: piece.col }, to: { row, col } });
      }
    }
    return moves;
  }

  function targetedSpecials(state, piece, range, targetTeam, special) {
    const moves = [];
    for (let row = piece.row - range; row <= piece.row + range; row += 1) {
      for (let col = piece.col - range; col <= piece.col + range; col += 1) {
        const distance = Math.abs(row - piece.row) + Math.abs(col - piece.col);
        if (!inBounds(row, col) || distance === 0 || distance > range) continue;
        const target = pieceAt(state, row, col);
        if (!target || target.team !== targetTeam) continue;
        moves.push({ type: "special", special, pieceId: piece.id, targetId: target.id, from: { row: piece.row, col: piece.col }, to: { row, col } });
      }
    }
    return moves;
  }

  function lineSpecials(state, piece, dirs, range, special) {
    return lineAttacks(state, piece, dirs, 1, range).map((move) => ({ ...move, type: "special", special, targetId: move.captureId, captureId: null, captureDecoy: false }));
  }

  function decoySpecials(state, piece) {
    const moves = [];
    for (const [dr, dc] of DIRECTIONS) {
      const row = piece.row + dr;
      const col = piece.col + dc;
      if (!inBounds(row, col) || hasHazard(state, row, col) || pieceAt(state, row, col) || decoyAt(state, row, col)) continue;
      moves.push({ type: "special", special: "decoy", pieceId: piece.id, from: { row: piece.row, col: piece.col }, to: { row, col } });
    }
    return moves;
  }

  function jumpMoves(state, piece, dirs) {
    const moves = [];
    for (const [dr, dc] of dirs) {
      const midRow = piece.row + dr;
      const midCol = piece.col + dc;
      const row = piece.row + dr * 2;
      const col = piece.col + dc * 2;
      if (!inBounds(row, col) || hasHazard(state, row, col)) continue;
      if (!pieceAt(state, midRow, midCol) && !decoyAt(state, midRow, midCol)) continue;
      const target = pieceAt(state, row, col);
      const decoy = decoyAt(state, row, col);
      if (target && target.team === piece.team) continue;
      if (decoy && decoy.team === piece.team) continue;
      if ((target || decoy) && hasStatus(piece, "noCapture")) continue;
      moves.push(makeMove(piece, row, col, { captureId: target && target.team !== piece.team ? target.id : null, captureDecoy: Boolean(decoy && decoy.team !== piece.team) }));
    }
    return moves;
  }

  function generatePieceMoves(state, piece) {
    if (!piece || piece.captured || isFinished(state) || hasStatus(piece, "stopped")) return [];
    const forward = piece.team === "blue" ? -1 : 1;
    const enemy = piece.team === "blue" ? "red" : "blue";
    const club = CLUBS[piece.club];
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
      moves = stepMoves(state, piece, [[forward, 0], [forward, -1], [forward, 1]], moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: true });
      moves.push(...stepMoves(state, piece, [[0, -1], [0, 1]], 1, { canMove: true, canCapture: true, slide: false }));
    } else if (piece.club === "chemistry") {
      moves = stepMoves(state, piece, ORTHOGONAL, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: false });
      moves.push(...chemistrySpecials(state, piece));
    } else if (piece.club === "broadcast") {
      moves = conversionMoves(state, piece, ORTHOGONAL, moveLimitFor(state, piece), false);
    } else if (piece.club === "newspaper") {
      moves = conversionMoves(state, piece, ORTHOGONAL, moveLimitFor(state, piece), true);
    } else if (piece.club === "art") {
      moves = stepMoves(state, piece, DIAGONAL, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: false });
      moves.push(...decoySpecials(state, piece));
    } else if (piece.club === "drama") {
      moves = stepMoves(state, piece, DIRECTIONS, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: false });
      moves.push(...targetedSpecials(state, piece, specialRangeFor(state, piece), enemy, "noCapture"));
    } else if (piece.club === "pc") {
      moves = stepMoves(state, piece, DIAGONAL, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: false });
      moves.push(...lineSpecials(state, piece, ORTHOGONAL, specialRangeFor(state, piece), "stopped"));
    } else if (piece.club === "physics") {
      moves = stepMoves(state, piece, ORTHOGONAL, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: false });
      moves.push(...jumpMoves(state, piece, ORTHOGONAL));
    } else if (piece.club === "band") {
      moves = stepMoves(state, piece, DIAGONAL, moveLimitFor(state, piece), { canMove: true, canCapture: true, slide: false });
      moves.push(...targetedSpecials(state, piece, specialRangeFor(state, piece), piece.team, "guard"));
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
      moves.push(...targetedSpecials(state, piece, specialRangeFor(state, piece), piece.team, "guard"));
    }

    return moves.filter((move) => isPassable(state, piece, move.to.row, move.to.col) || move.type === "attack" || move.type === "special");
  }

  function generateLegalMoves(state, side) {
    return state.pieces
      .filter((piece) => piece.team === side && !piece.captured)
      .flatMap((piece) => generatePieceMoves(state, piece));
  }

  function removeDecoy(next, row, col) {
    next.hazards = next.hazards.filter((hazard) => !(hazard.kind === "decoy" && hazard.row === row && hazard.col === col));
  }

  function captureTarget(next, attacker, target) {
    if (!target || target.team === attacker.team) return;
    const guard = target.status.find((item) => item.type === "guard");
    if (guard) {
      target.status = target.status.filter((item) => item !== guard);
      return;
    }
    target.captured = true;
    next.captured[attacker.team].push(target.id);
    if (target.club === "president") next.winner = attacker.team;
  }

  function applyStatus(piece, type, turns) {
    if (!piece || piece.captured) return;
    piece.status = piece.status.filter((item) => item.type !== type);
    piece.status.push({ type, turns });
  }

  function tickEffects(next) {
    next.hazards = next.hazards
      .map((hazard) => ({ ...hazard, turns: hazard.turns - 1 }))
      .filter((hazard) => hazard.turns > 0);
    for (const piece of next.pieces) {
      piece.status = piece.status
        .map((item) => ({ ...item, turns: item.turns - 1 }))
        .filter((item) => item.turns > 0);
    }
  }

  function applyMove(state, move) {
    const next = cloneState(state);
    const piece = getPiece(next, move.pieceId);
    if (!piece || piece.captured || isFinished(next)) return next;
    const movingClub = piece.club;
    const movingTeam = piece.team;

    if (move.type === "special") {
      const target = move.targetId ? getPiece(next, move.targetId) : null;
      if (move.special === "hazard") {
        next.hazards.push({ kind: "hazard", row: move.to.row, col: move.to.col, team: piece.team, turns: 2 });
      } else if (move.special === "decoy") {
        next.hazards.push({ kind: "decoy", row: move.to.row, col: move.to.col, team: piece.team, turns: 3 });
      } else if (target) {
        applyStatus(target, move.special, 2);
      }
    } else if (move.type === "attack") {
      if (move.captureDecoy) {
        removeDecoy(next, move.to.row, move.to.col);
      } else if (move.convert) {
        const target = move.captureId ? getPiece(next, move.captureId) : pieceAt(next, move.to.row, move.to.col);
        if (target && target.club !== "president" && target.team !== piece.team) {
          target.originalTeam = target.originalTeam || target.team;
          target.team = piece.team;
          target.status = [];
        }
      } else {
        captureTarget(next, piece, move.captureId ? getPiece(next, move.captureId) : pieceAt(next, move.to.row, move.to.col));
      }
    } else {
      if (move.captureDecoy) removeDecoy(next, move.to.row, move.to.col);
      captureTarget(next, piece, move.captureId ? getPiece(next, move.captureId) : pieceAt(next, move.to.row, move.to.col));
      piece.row = move.to.row;
      piece.col = move.to.col;
      if (shouldPromote(piece, move.from.row, piece.row)) piece.promoted = true;
    }

    next.turn = piece.team === "blue" ? "red" : "blue";
    next.moveCount += 1;
    next.history.push({
      side: movingTeam,
      club: movingClub,
      pieceId: piece.id,
      type: move.type,
      special: move.special || null,
      fromRow: move.from.row,
      fromCol: move.from.col,
      toRow: move.to.row,
      toCol: move.to.col,
      captureId: move.captureId || null,
      targetId: move.targetId || null,
      captureDecoy: Boolean(move.captureDecoy),
      convert: Boolean(move.convert),
      promoted: piece.promoted || false
    });
    tickEffects(next);
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
