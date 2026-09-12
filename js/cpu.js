(function (global) {
  "use strict";

  const { BOARD_CONFIG, CLUBS } = global.BukatsuConfig;
  const Rules = global.BukatsuRules;
  const YIELD_INTERVAL_MS = 12;
  const DEFENSIVE_CLUBS = new Set(["home", "kendo", "judo", "swim"]);
  const ASSAULT_CLUBS = new Set(["track", "rugby", "soccer", "basketball", "volleyball", "kendo"]);
  const RANGED_CLUBS = new Set(["archery", "baseball", "physics"]);
  const FORMATION_STRATEGIES = new Set(["yagura", "bougin", "shikenbisha", "anaguma"]);
  const SEARCH_TIMEOUT = {};

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

  function strategyPositionScore(position, side, strategy, piece = null, target = null) {
    if (!position || !strategy) return 0;
    const maxRow = BOARD_CONFIG.rows - 1;
    const maxCol = BOARD_CONFIG.cols - 1;
    const homeRow = side === "blue" ? maxRow : 0;
    const supportRow = side === "blue" ? maxRow - 1 : 1;
    const progress = side === "blue" ? maxRow - position.row : position.row;
    const club = piece ? piece.club : null;
    if (strategy === "charge") {
      if (!target) return 0;
      const chaseWeight = club === "president" ? 4 : 24;
      return (BOARD_CONFIG.rows + BOARD_CONFIG.cols - distance(position, target)) * chaseWeight;
    }
    if (strategy === "left") return (maxCol - position.col) * 8;
    if (strategy === "right") return position.col * 8;
    if (strategy === "yagura") {
      if (club === "president") return 180 - Math.abs(position.row - homeRow) * 34 - Math.abs(position.col - 4) * 24;
      if (DEFENSIVE_CLUBS.has(club)) return 120 - Math.abs(position.row - supportRow) * 18 - Math.abs(position.col - 4) * 14;
      return progress * 7 - Math.abs(position.col - 4) * 4;
    }
    if (strategy === "bougin") {
      const attackFile = side === "blue" ? 1 : maxCol - 1;
      if (club === "president") return 80 - Math.abs(position.row - homeRow) * 24;
      const fileBonus = 100 - Math.abs(position.col - attackFile) * (ASSAULT_CLUBS.has(club) ? 22 : 8);
      return fileBonus + progress * (ASSAULT_CLUBS.has(club) ? 18 : 7);
    }
    if (strategy === "shikenbisha") {
      const fourthFile = side === "blue" ? 3 : maxCol - 3;
      if (club === "president") return 90 - Math.abs(position.row - homeRow) * 26;
      const fileBonus = 100 - Math.abs(position.col - fourthFile) * (RANGED_CLUBS.has(club) ? 26 : 9);
      return fileBonus + progress * (RANGED_CLUBS.has(club) ? 12 : 7);
    }
    if (strategy === "anaguma") {
      const cornerCol = side === "blue" ? maxCol : 0;
      const cornerDistance = Math.abs(position.row - homeRow) + Math.abs(position.col - cornerCol);
      if (club === "president") return 240 - cornerDistance * 38;
      if (DEFENSIVE_CLUBS.has(club)) {
        const guardDistance = Math.abs(position.row - supportRow) + Math.abs(position.col - cornerCol);
        return 150 - guardDistance * 22;
      }
      return progress * 6;
    }
    return 0;
  }

  function isStrategyComplete(state, side, strategy) {
    if (!FORMATION_STRATEGIES.has(strategy)) return false;
    const pieces = state.pieces.filter((piece) => piece.team === side && !piece.captured);
    const ownMoves = state.history.filter((entry) => entry.side === side).length;
    if (ownMoves >= 12) return true;
    if (ownMoves < 4) return false;

    const maxRow = BOARD_CONFIG.rows - 1;
    const maxCol = BOARD_CONFIG.cols - 1;
    const homeRow = side === "blue" ? maxRow : 0;
    const president = pieces.find((piece) => piece.club === "president");
    if (!president) return true;

    if (strategy === "yagura") {
      const guards = pieces.filter((piece) => DEFENSIVE_CLUBS.has(piece.club)
        && Math.abs(piece.row - homeRow) + Math.abs(piece.col - 4) <= 3).length;
      return president.row === homeRow && Math.abs(president.col - 4) <= 1 && guards >= 3;
    }
    if (strategy === "anaguma") {
      const cornerCol = side === "blue" ? maxCol : 0;
      const guards = pieces.filter((piece) => DEFENSIVE_CLUBS.has(piece.club)
        && Math.abs(piece.row - homeRow) + Math.abs(piece.col - cornerCol) <= 3).length;
      return Math.abs(president.row - homeRow) + Math.abs(president.col - cornerCol) <= 1 && guards >= 2;
    }
    if (strategy === "bougin") {
      const attackFile = side === "blue" ? 1 : maxCol - 1;
      const attackers = pieces.filter((piece) => ASSAULT_CLUBS.has(piece.club));
      const required = Math.min(2, attackers.length);
      const formed = attackers.filter((piece) => Math.abs(piece.col - attackFile) <= 1).length;
      const advanced = attackers.some((piece) => (side === "blue" ? maxRow - piece.row : piece.row) >= 3);
      return required > 0 && formed >= required && advanced;
    }

    const fourthFile = side === "blue" ? 3 : maxCol - 3;
    const ranged = pieces.filter((piece) => RANGED_CLUBS.has(piece.club));
    const formationPieces = ranged.length > 0 ? ranged : pieces.filter((piece) => piece.club !== "president");
    const required = Math.min(2, formationPieces.length);
    const formed = formationPieces.filter((piece) => Math.abs(piece.col - fourthFile) <= 1).length;
    return required > 0 && formed >= required;
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
      if (piece.team === side) score += strategyPositionScore(piece, side, school.strategy, piece, enemyPresident);
    }

    if (ownPresident && enemyPresident) {
      const ownDanger = Rules.generateLegalMoves(state, enemy).filter((move) => move.captureId === ownPresident.id).length;
      const enemyDanger = Rules.generateLegalMoves(state, side).filter((move) => move.captureId === enemyPresident.id).length;
      score -= ownDanger * 180 * school.weights.presidentSafety;
      const attackWeight = school.strategy === "charge" ? 4 : 1;
      score += enemyDanger * 180 * school.weights.pressure * attackWeight;
      score += (18 - distance(ownPresident, enemyPresident)) * school.weights.pressure;
    }

    score += Rules.generateLegalMoves(state, side).length * 6 * school.weights.mobility;
    score -= Rules.generateLegalMoves(state, enemy).length * 4 * school.weights.mobility;
    const reserveCount = nonHomeReserveCount(state, side);
    if (reserveCount >= 5) score -= reserveCount * 80;
    return score;
  }

  function nonHomeReserveCount(state, side) {
    return (state.captured[side] || []).filter((pieceId) => {
      const piece = Rules.getPiece(state, pieceId);
      return piece && piece.club !== "home" && piece.club !== "president";
    }).length;
  }

  function orderedMoves(state, side) {
    const prioritizeDrops = nonHomeReserveCount(state, side) >= 5;
    return checkResponseMoves(state, side, Rules.generateLegalMoves(state, side)).sort((a, b) => {
      const av = a.captureId ? CLUBS[Rules.getPiece(state, a.captureId).club].value : 0;
      const bv = b.captureId ? CLUBS[Rules.getPiece(state, b.captureId).club].value : 0;
      const aPiece = Rules.getPiece(state, a.pieceId);
      const bPiece = Rules.getPiece(state, b.pieceId);
      const aDrop = prioritizeDrops && a.type === "drop" && aPiece && aPiece.club !== "home" ? 10000 : 0;
      const bDrop = prioritizeDrops && b.type === "drop" && bPiece && bPiece.club !== "home" ? 10000 : 0;
      return (bDrop + bv) - (aDrop + av);
    });
  }

  function checkResponseMoves(state, side, moves) {
    if (!Rules.isSideInCheck(state, side)) return moves;
    const responses = moves.filter((move) => !Rules.isSideInCheck(Rules.applyMove(state, move), side));
    return responses.length > 0 ? responses : moves;
  }

  function immediateWinningMove(state, side, moves = Rules.generateLegalMoves(state, side)) {
    return moves.find((move) => {
      const target = move.captureId ? Rules.getPiece(state, move.captureId) : null;
      return target && target.team !== side && target.club === "president";
    }) || null;
  }

  function doomedPresidentMove(state, side, moves = Rules.generateLegalMoves(state, side)) {
    if (!Rules.isSideInCheck(state, side)) return null;
    const responses = moves.filter((move) => !Rules.isSideInCheck(Rules.applyMove(state, move), side));
    if (responses.length > 0) return null;
    const president = findPresident(state, side);
    return president ? moves.find((move) => move.pieceId === president.id) || null : null;
  }

  function isSafePresidentMove(state, side, move) {
    const next = Rules.applyMove(state, move);
    if (Rules.getWinner(next) === side) return true;
    const president = findPresident(next, side);
    if (!president) return false;
    const enemy = side === "blue" ? "red" : "blue";
    return !Rules.generateLegalMoves(next, enemy).some((reply) => reply.captureId === president.id);
  }

  function chooseExpertPresidentMove(state, side, proposedMove, moves, school) {
    const piece = proposedMove ? Rules.getPiece(state, proposedMove.pieceId) : null;
    if (!piece || piece.club !== "president") return proposedMove;
    const presidentMoves = moves.filter((move) => move.pieceId === piece.id);
    if (presidentMoves.length === 0) return proposedMove;
    const safeMoves = presidentMoves.filter((move) => isSafePresidentMove(state, side, move));
    if (safeMoves.length === 0) return presidentMoves[Math.floor(Math.random() * presidentMoves.length)];
    return safeMoves
      .map((move) => ({ move, score: evaluateBoard(Rules.applyMove(state, move), side, school) }))
      .sort((a, b) => b.score - a.score)[0].move;
  }

  function allOutChargeMoves(state, moves, side) {
    const enemy = side === "blue" ? "red" : "blue";
    const checkingMoves = moves.filter((move) => Rules.isSideInCheck(Rules.applyMove(state, move), enemy));
    return checkingMoves.length > 0 ? checkingMoves : moves;
  }

  function simpleMoveScore(state, move, side, school) {
    const piece = Rules.getPiece(state, move.pieceId);
    const target = move.captureId ? Rules.getPiece(state, move.captureId) : null;
    const enemy = side === "blue" ? "red" : "blue";
    const enemyPresident = findPresident(state, enemy);
    let score = 0;

    if (target) {
      if (target.club === "president") return 1000000;
      score += CLUBS[target.club].value * (move.convert ? 2 : 1);
    }
    if (move.type === "drop" && piece) {
      score += CLUBS[piece.club].value * 0.08;
      if (piece.club !== "home" && nonHomeReserveCount(state, side) >= 5) score += 10000;
    }
    if (move.type === "move" && piece && piece.club !== "president" && !piece.promoted && move.to
      && ((side === "blue" && move.to.row <= 2) || (side === "red" && move.to.row >= 6))) {
      score += 80;
    }
    if (enemyPresident && move.to) score += (18 - distance(move.to, enemyPresident)) * 3;
    if ((move.type === "move" || move.type === "drop" || move.convert) && move.to) {
      const destinationScore = strategyPositionScore(move.to, side, school.strategy, piece, enemyPresident);
      const originScore = move.type === "drop" ? 0 : strategyPositionScore(piece, side, school.strategy, piece, enemyPresident);
      score += destinationScore - originScore;
    }
    return score;
  }

  function chooseSimpleMove(state, side, school) {
    const checked = Rules.isSideInCheck(state, side);
    const legalMoves = Rules.generateLegalMoves(state, side);
    const winningMove = immediateWinningMove(state, side, legalMoves);
    if (winningMove) return chooseExpertPresidentMove(state, side, winningMove, legalMoves, school);
    const doomedMove = doomedPresidentMove(state, side, legalMoves);
    if (doomedMove) return chooseExpertPresidentMove(state, side, doomedMove, legalMoves, school);
    let candidates = checkResponseMoves(state, side, legalMoves);
    if (school.allOutCharge && !checked) candidates = allOutChargeMoves(state, candidates, side);
    const moves = candidates
      .map((move) => ({ move, score: simpleMoveScore(state, move, side, school) }))
      .sort((a, b) => b.score - a.score);
    if (moves.length === 0) return null;
    const windowSize = Math.min(moves.length, school.choiceWindow || 1);
    const index = Math.random() < school.blunderRate ? Math.floor(Math.random() * windowSize) : 0;
    return chooseExpertPresidentMove(state, side, moves[index].move, legalMoves, school);
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

  function createYieldController() {
    let lastYieldAt = performance.now();
    return async function yieldToBrowser() {
      if (performance.now() - lastYieldAt < YIELD_INTERVAL_MS) return;
      await new Promise((resolve) => setTimeout(resolve, 0));
      lastYieldAt = performance.now();
    };
  }

  async function minimaxAsync(state, depth, alpha, beta, maximizing, side, school, yieldToBrowser, deadline = Infinity) {
    await yieldToBrowser();
    if (performance.now() >= deadline) throw SEARCH_TIMEOUT;
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
        const result = await minimaxAsync(Rules.applyMove(state, move), depth - 1, alpha, beta, false, side, school, yieldToBrowser, deadline);
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
      const result = await minimaxAsync(Rules.applyMove(state, move), depth - 1, alpha, beta, true, side, school, yieldToBrowser, deadline);
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
    const winningMove = immediateWinningMove(state, side, moves);
    if (winningMove) return chooseExpertPresidentMove(state, side, winningMove, moves, school);
    const doomedMove = doomedPresidentMove(state, side, moves);
    if (doomedMove) return chooseExpertPresidentMove(state, side, doomedMove, moves, school);
    if (Math.random() < school.blunderRate) {
      const move = moves[Math.floor(Math.random() * Math.min(moves.length, 8))];
      return chooseExpertPresidentMove(state, side, move, moves, school);
    }
    const move = minimax(state, school.depth, -Infinity, Infinity, true, side, school).move;
    return chooseExpertPresidentMove(state, side, move, moves, school);
  }

  async function chooseCpuMoveAsync(state, side, school) {
    if (school.algorithm === "simple") return chooseSimpleMove(state, side, school);
    const deadline = performance.now() + (school.maxThinkMs || 9000);
    const moves = orderedMoves(state, side);
    if (moves.length === 0) return null;
    const winningMove = immediateWinningMove(state, side, moves);
    if (winningMove) return chooseExpertPresidentMove(state, side, winningMove, moves, school);
    const doomedMove = doomedPresidentMove(state, side, moves);
    if (doomedMove) return chooseExpertPresidentMove(state, side, doomedMove, moves, school);
    if (Math.random() < school.blunderRate) {
      const move = moves[Math.floor(Math.random() * Math.min(moves.length, 8))];
      return chooseExpertPresidentMove(state, side, move, moves, school);
    }
    const yieldToBrowser = createYieldController();
    let bestMove = moves[0];
    for (let depth = 1; depth <= school.depth; depth += 1) {
      try {
        const result = await minimaxAsync(state, depth, -Infinity, Infinity, true, side, school, yieldToBrowser, deadline);
        if (result.move) bestMove = result.move;
      } catch (error) {
        if (error !== SEARCH_TIMEOUT) throw error;
        break;
      }
      if (performance.now() >= deadline) break;
    }
    return chooseExpertPresidentMove(state, side, bestMove, moves, school);
  }

  global.BukatsuCpu = { evaluateBoard, minimax, chooseCpuMove, chooseCpuMoveAsync, chooseSimpleMove, strategyPositionScore, checkResponseMoves, allOutChargeMoves, immediateWinningMove, doomedPresidentMove, isSafePresidentMove, chooseExpertPresidentMove, nonHomeReserveCount, isStrategyComplete };
})(globalThis);
