(function (global) {
  "use strict";

  const { CLUBS } = global.BukatsuConfig;
  const Rules = global.BukatsuRules;

  function findPresident(state, side) {
    return state.pieces.find((piece) => piece.team === side && piece.club === "president" && !piece.captured);
  }

  function distance(a, b) {
    return Math.abs(a.row - b.row) + Math.abs(a.col - b.col);
  }

  function terrainScore(state, piece) {
    const terrain = Rules.terrainAt(state, piece.row, piece.col);
    const bonus = CLUBS[piece.club].terrainBonus && CLUBS[piece.club].terrainBonus[terrain];
    return bonus ? 24 : 0;
  }

  function evaluateBoard(state, side, school) {
    const winner = Rules.getWinner(state);
    if (winner === side) return 1000000;
    if (winner && winner !== side) return -1000000;

    const enemy = side === "blue" ? "red" : "blue";
    const ownPresident = findPresident(state, side);
    const enemyPresident = findPresident(state, enemy);
    let score = 0;

    for (const piece of state.pieces) {
      if (piece.captured) continue;
      const sign = piece.team === side ? 1 : -1;
      score += sign * CLUBS[piece.club].value * school.weights.material;
      score += sign * terrainScore(state, piece) * school.weights.terrain;
    }

    if (ownPresident && enemyPresident) {
      const ownDanger = Rules.generateLegalMoves(state, enemy).filter((move) => move.captureId === ownPresident.id).length;
      const enemyDanger = Rules.generateLegalMoves(state, side).filter((move) => move.captureId === enemyPresident.id).length;
      score -= ownDanger * 180 * school.weights.presidentSafety;
      score += enemyDanger * 180 * school.weights.pressure;
      score += (18 - distance(ownPresident, enemyPresident)) * school.weights.pressure;
    }

    score += Rules.generateLegalMoves(state, side).length * 6 * school.weights.mobility;
    score -= Rules.generateLegalMoves(state, enemy).length * 4 * school.weights.mobility;
    return score;
  }

  function orderedMoves(state, side) {
    return Rules.generateLegalMoves(state, side).sort((a, b) => {
      const av = a.captureId ? CLUBS[Rules.getPiece(state, a.captureId).club].value : 0;
      const bv = b.captureId ? CLUBS[Rules.getPiece(state, b.captureId).club].value : 0;
      return bv - av;
    });
  }

  function simpleMoveScore(state, move, side) {
    const piece = Rules.getPiece(state, move.pieceId);
    const target = move.captureId ? Rules.getPiece(state, move.captureId) : null;
    const enemy = side === "blue" ? "red" : "blue";
    const enemyPresident = findPresident(state, enemy);
    let score = 0;

    if (target) {
      if (target.club === "president") return 1000000;
      score += CLUBS[target.club].value * (move.convert ? 2 : 1);
    }
    if (move.type === "drop" && piece) score += CLUBS[piece.club].value * 0.08;
    if (move.type === "move" && piece && piece.club !== "president" && !piece.promoted && move.to
      && ((side === "blue" && move.to.row <= 2) || (side === "red" && move.to.row >= 6))) {
      score += 80;
    }
    if (enemyPresident && move.to) score += (18 - distance(move.to, enemyPresident)) * 3;
    return score;
  }

  function chooseSimpleMove(state, side, school) {
    const moves = Rules.generateLegalMoves(state, side)
      .map((move) => ({ move, score: simpleMoveScore(state, move, side) }))
      .sort((a, b) => b.score - a.score);
    if (moves.length === 0) return null;
    const windowSize = Math.min(moves.length, school.choiceWindow || 1);
    const index = Math.random() < school.blunderRate ? Math.floor(Math.random() * windowSize) : 0;
    return moves[index].move;
  }

  function minimax(state, depth, alpha, beta, maximizing, side, school) {
    const winner = Rules.getWinner(state);
    if (depth === 0 || winner) {
      return { score: evaluateBoard(state, side, school), move: null };
    }

    const currentSide = maximizing ? side : side === "blue" ? "red" : "blue";
    const moves = orderedMoves(state, currentSide);
    if (moves.length === 0) {
      return { score: evaluateBoard(state, side, school), move: null };
    }

    let bestMove = moves[0];
    if (maximizing) {
      let bestScore = -Infinity;
      for (const move of moves) {
        const result = minimax(Rules.applyMove(state, move), depth - 1, alpha, beta, false, side, school);
        if (result.score > bestScore) {
          bestScore = result.score;
          bestMove = move;
        }
        alpha = Math.max(alpha, bestScore);
        if (beta <= alpha) break;
      }
      return { score: bestScore, move: bestMove };
    }

    let bestScore = Infinity;
    for (const move of moves) {
      const result = minimax(Rules.applyMove(state, move), depth - 1, alpha, beta, true, side, school);
      if (result.score < bestScore) {
        bestScore = result.score;
        bestMove = move;
      }
      beta = Math.min(beta, bestScore);
      if (beta <= alpha) break;
    }
    return { score: bestScore, move: bestMove };
  }

  function chooseCpuMove(state, side, school) {
    if (school.algorithm === "simple") return chooseSimpleMove(state, side, school);
    const moves = orderedMoves(state, side);
    if (moves.length === 0) return null;
    if (Math.random() < school.blunderRate) {
      return moves[Math.floor(Math.random() * Math.min(moves.length, 8))];
    }
    return minimax(state, school.depth, -Infinity, Infinity, true, side, school).move;
  }

  global.BukatsuCpu = { evaluateBoard, minimax, chooseCpuMove, chooseSimpleMove };
})(globalThis);
