(function (global) {
  "use strict";

  const { TERRAIN, CLUBS, CPU_SCHOOLS } = global.BukatsuConfig;
  const Rules = global.BukatsuRules;
  const Game = global.BukatsuGame;
  const Cpu = global.BukatsuCpu;

  const boardEl = document.getElementById("board");
  const moveTrail = document.getElementById("moveTrail");
  const checkBanner = document.getElementById("checkBanner");
  const statusText = document.getElementById("statusText");
  const selectionPanel = document.getElementById("selectionPanel");
  const turnStat = document.getElementById("turnStat");
  const blueCaptured = document.getElementById("blueCaptured");
  const redCaptured = document.getElementById("redCaptured");
  const moveHistory = document.getElementById("moveHistory");
  const spectatorButton = document.getElementById("spectatorButton");
  const restartButton = document.getElementById("restartButton");
  const schoolSelect = document.getElementById("schoolSelect");
  const terrainLegend = document.getElementById("terrainLegend");
  const clubLegend = document.getElementById("clubLegend");

  let state = Game.createGameState();
  let selectedPieceId = null;
  let selectedMoves = [];
  let cpuBusy = false;
  let spectatorMode = false;
  let autoTimerId = null;
  let lastTrail = null;
  let trailTimerId = null;
  let visibleCheckSide = null;
  let hiddenCheckSide = null;
  let checkTimerId = null;
  let startSoundPlayed = false;
  let winnerSoundPlayedFor = null;

  const SOUND_FILES = {
    start: "和太鼓でドドン.mp3",
    capture: "爆発2.mp3",
    move: "小パンチ.mp3",
    finish: "シャキーン1.mp3"
  };

  const sounds = Object.fromEntries(Object.entries(SOUND_FILES).map(([key, fileName]) => {
    const audio = new Audio(`se/${encodeURIComponent(fileName)}`);
    audio.preload = "auto";
    return [key, audio];
  }));

  function playSound(key) {
    const source = sounds[key];
    if (!source) return;
    const audio = source.cloneNode();
    audio.volume = 0.85;
    const playPromise = audio.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  }

  function playStartSound() {
    if (startSoundPlayed) return;
    startSoundPlayed = true;
    playSound("start");
  }

  function playMoveSound(move, winner) {
    if (move.captureId) {
      playSound("capture");
    } else {
      playSound("move");
    }

    if (winner && winnerSoundPlayedFor !== winner) {
      winnerSoundPlayedFor = winner;
      window.setTimeout(() => playSound("finish"), move.captureId ? 160 : 0);
    }
  }

  function schoolConfig() {
    return CPU_SCHOOLS[schoolSelect.value] || CPU_SCHOOLS.normal;
  }

  function actionLabel(move) {
    if (move.type === "attack") return "射撃";
    if (move.type === "special") return "妨害";
    return move.captureId ? "捕獲" : "移動";
  }

  function renderLegends() {
    terrainLegend.innerHTML = Object.entries(TERRAIN).map(([key, terrain]) => (
      `<div class="legend-row"><span class="swatch cell" data-terrain="${key}"></span><span>${terrain.name}</span></div>`
    )).join("");

    clubLegend.innerHTML = Object.entries(CLUBS).map(([, club]) => (
      `<div class="legend-row"><span class="club-chip">${club.shortName}</span><span>${club.name}</span></div>`
    )).join("");
  }

  function renderSchoolOptions() {
    schoolSelect.innerHTML = Object.entries(CPU_SCHOOLS).map(([key, school]) => (
      `<option value="${key}">${school.name} ${school.stars}</option>`
    )).join("");
    schoolSelect.value = "normal";
  }

  function updateSpectatorButton() {
    spectatorButton.textContent = spectatorMode ? "観戦中" : "観戦モード";
    spectatorButton.classList.toggle("active", spectatorMode);
    spectatorButton.setAttribute("aria-pressed", String(spectatorMode));
  }

  function renderBoard() {
    const winner = Rules.getWinner(state);
    boardEl.innerHTML = "";

    for (const cell of state.board) {
      const cellEl = document.createElement("button");
      cellEl.type = "button";
      cellEl.className = "cell";
      cellEl.dataset.row = String(cell.row);
      cellEl.dataset.col = String(cell.col);
      cellEl.dataset.terrain = cell.terrain;
      cellEl.dataset.label = TERRAIN[cell.terrain].name;

      const legal = selectedMoves.find((move) => move.to.row === cell.row && move.to.col === cell.col);
      if (legal) {
        cellEl.classList.add(legal.type === "special" ? "legal-special" : legal.captureId || legal.type === "attack" ? "legal-attack" : "legal-move");
      }
      if (selectedPieceId) {
        const selected = Rules.getPiece(state, selectedPieceId);
        if (selected && selected.row === cell.row && selected.col === cell.col) cellEl.classList.add("selected");
      }

      const hazard = state.hazards.find((item) => item.row === cell.row && item.col === cell.col);
      if (hazard) {
        const marker = document.createElement("span");
        marker.className = "hazard-marker";
        marker.textContent = "×";
        cellEl.appendChild(marker);
      }

      const piece = Rules.pieceAt(state, cell.row, cell.col);
      if (piece) {
        const pieceEl = document.createElement("span");
        pieceEl.className = `piece ${piece.team}`;
        pieceEl.title = `${Game.sideName(piece.team)} ${CLUBS[piece.club].name}`;
        pieceEl.innerHTML = `<small>${CLUBS[piece.club].shortName}</small>`;
        cellEl.appendChild(pieceEl);
      }

      cellEl.addEventListener("click", () => handleCellClick(cell.row, cell.col));
      cellEl.disabled = Boolean(winner) || cpuBusy;
      boardEl.appendChild(cellEl);
    }
  }

  function renderStatus() {
    const winner = Rules.getWinner(state);
    if (winner) {
      statusText.textContent = `${Game.sideName(winner)}が生徒会長を捕獲。決着です。`;
    } else if (cpuBusy) {
      statusText.textContent = spectatorMode ? `${Game.sideName(state.turn)}が考え中` : `${schoolConfig().name}が考え中`;
    } else {
      statusText.textContent = spectatorMode ? "観戦モードです" : state.turn === "blue" ? "あなたの手番です" : "CPUの手番です";
    }

    turnStat.textContent = Game.sideName(state.turn);
    blueCaptured.textContent = String(state.captured.blue.length);
    redCaptured.textContent = String(state.captured.red.length);
  }

  function historyNotation(entry) {
    const coord = `${entry.toCol + 1}${entry.toRow + 1}`;
    const club = CLUBS[entry.club].shortName;
    const suffix = entry.type === "special" ? "*" : entry.captureId ? "x" : "";
    return `${coord}${club}${suffix}`;
  }

  function renderHistory() {
    if (state.history.length === 0) {
      moveHistory.innerHTML = '<li><span class="move-side">まだ手なし</span><span class="move-notation">-</span></li>';
      return;
    }

    moveHistory.innerHTML = state.history.slice().reverse().map((entry) => {
      const side = entry.side === "blue" ? "先手" : "後手";
      return `<li><span class="move-side">${side}</span><span class="move-notation">${historyNotation(entry)}</span></li>`;
    }).join("");
  }

  function renderCheckBanner() {
    const winner = Rules.getWinner(state);
    if (winner) {
      if (checkTimerId) {
        window.clearTimeout(checkTimerId);
        checkTimerId = null;
      }
      checkBanner.textContent = winner === "blue" ? "勝利" : "敗北";
      checkBanner.classList.remove("blue", "red");
      checkBanner.classList.add("visible", winner === "blue" ? "blue" : "red");
      visibleCheckSide = null;
      hiddenCheckSide = null;
      return;
    }

    const blueInCheck = Rules.isSideInCheck(state, "blue");
    const redInCheck = Rules.isSideInCheck(state, "red");
    const checkedSide = blueInCheck ? "blue" : redInCheck ? "red" : null;

    if (!checkedSide) {
      checkBanner.classList.remove("visible", "blue", "red");
      checkBanner.textContent = "";
      visibleCheckSide = null;
      hiddenCheckSide = null;
      if (checkTimerId) {
        window.clearTimeout(checkTimerId);
        checkTimerId = null;
      }
      return;
    }

    if (hiddenCheckSide === checkedSide) return;

    checkBanner.textContent = "王手";
    checkBanner.classList.remove("blue", "red");
    checkBanner.classList.add("visible", checkedSide);

    if (visibleCheckSide !== checkedSide) {
      visibleCheckSide = checkedSide;
      if (checkTimerId) window.clearTimeout(checkTimerId);
      checkTimerId = window.setTimeout(() => {
        checkBanner.classList.remove("visible");
        checkBanner.textContent = "";
        hiddenCheckSide = checkedSide;
        checkTimerId = null;
      }, 2000);
    }
  }

  function clearMoveTrail() {
    moveTrail.classList.remove("visible");
    lastTrail = null;
    if (trailTimerId) {
      window.clearTimeout(trailTimerId);
      trailTimerId = null;
    }
  }

  function showMoveTrail(move, team) {
    lastTrail = { from: move.from, to: move.to, team };
    if (trailTimerId) window.clearTimeout(trailTimerId);
    renderMoveTrail();
    trailTimerId = window.setTimeout(clearMoveTrail, 1000);
  }

  function renderMoveTrail() {
    if (!lastTrail) {
      moveTrail.classList.remove("visible");
      return;
    }

    const fromCell = boardEl.querySelector(`[data-row="${lastTrail.from.row}"][data-col="${lastTrail.from.col}"]`);
    const toCell = boardEl.querySelector(`[data-row="${lastTrail.to.row}"][data-col="${lastTrail.to.col}"]`);
    if (!fromCell || !toCell) {
      moveTrail.classList.remove("visible");
      return;
    }

    const wrapRect = boardEl.parentElement.getBoundingClientRect();
    const fromRect = fromCell.getBoundingClientRect();
    const toRect = toCell.getBoundingClientRect();
    const fromX = fromRect.left - wrapRect.left + fromRect.width / 2;
    const fromY = fromRect.top - wrapRect.top + fromRect.height / 2;
    const toX = toRect.left - wrapRect.left + toRect.width / 2;
    const toY = toRect.top - wrapRect.top + toRect.height / 2;
    const dx = toX - fromX;
    const dy = toY - fromY;
    const length = Math.max(0, Math.hypot(dx, dy) - 18);
    const angle = Math.atan2(dy, dx) * 180 / Math.PI;

    moveTrail.style.left = `${fromX}px`;
    moveTrail.style.top = `${fromY}px`;
    moveTrail.style.setProperty("--trail-length", `${length}px`);
    moveTrail.style.setProperty("--trail-angle", `${angle}deg`);
    moveTrail.style.setProperty("--trail-color", lastTrail.team === "blue" ? "var(--blue)" : "var(--red)");
    moveTrail.classList.add("visible");
  }

  function renderSelection() {
    if (!selectedPieceId) {
      selectionPanel.textContent = spectatorMode ? "CPU同士で対局中" : state.turn === "blue" ? "あなたの駒を選択" : "CPUの手番";
      return;
    }
    const piece = Rules.getPiece(state, selectedPieceId);
    if (!piece) return;
    const moveText = selectedMoves.length === 0
      ? "合法手なし"
      : selectedMoves.map((move) => `${actionLabel(move)} ${move.to.row + 1}-${move.to.col + 1}`).slice(0, 8).join(" / ");
    selectionPanel.innerHTML = `<strong>${CLUBS[piece.club].name}</strong><br>${Game.sideName(piece.team)}<br>${moveText}`;
  }

  function render() {
    state.board = global.BukatsuBoard.hydrateBoardPieces(state.board, state.pieces);
    renderBoard();
    renderStatus();
    renderSelection();
    renderHistory();
    renderMoveTrail();
    renderCheckBanner();
    updateSpectatorButton();
  }

  function selectPiece(piece) {
    selectedPieceId = piece.id;
    selectedMoves = Rules.generatePieceMoves(state, piece);
    render();
  }

  function clearSelection() {
    selectedPieceId = null;
    selectedMoves = [];
  }

  function commitMove(move) {
    const piece = Rules.getPiece(state, move.pieceId);
    state = Rules.applyMove(state, move);
    const winner = Rules.getWinner(state);
    clearSelection();
    render();
    showMoveTrail(move, piece ? piece.team : "blue");
    playMoveSound(move, winner);
    if (!Rules.getWinner(state) && state.turn === "red") {
      runAutoTurn("red");
    }
  }

  function handleCellClick(row, col) {
    if (cpuBusy || spectatorMode || Rules.getWinner(state) || state.turn !== "blue") return;

    const legal = selectedMoves.find((move) => move.to.row === row && move.to.col === col);
    const selected = selectedPieceId ? Rules.getPiece(state, selectedPieceId) : null;
    if (legal && selected && selected.team === "blue") {
      commitMove(legal);
      return;
    }

    const piece = Rules.pieceAt(state, row, col);
    if (piece) {
      selectPiece(piece);
      return;
    }

    clearSelection();
    render();
  }

  function clearAutoTimer() {
    if (autoTimerId) {
      window.clearTimeout(autoTimerId);
      autoTimerId = null;
    }
  }

  function scheduleSpectatorTurn(delay) {
    clearAutoTimer();
    if (!spectatorMode || cpuBusy || Rules.getWinner(state)) return;
    autoTimerId = window.setTimeout(() => {
      autoTimerId = null;
      runAutoTurn(state.turn);
    }, delay);
  }

  function runAutoTurn(side) {
    if (Rules.getWinner(state) || state.turn !== side) return;
    cpuBusy = true;
    render();
    clearAutoTimer();
    autoTimerId = window.setTimeout(() => {
      autoTimerId = null;
      if (Rules.getWinner(state) || state.turn !== side) {
        cpuBusy = false;
        render();
        return;
      }
      const move = Cpu.chooseCpuMove(state, side, schoolConfig());
      if (move) {
        const piece = Rules.getPiece(state, move.pieceId);
        state = Rules.applyMove(state, move);
        const winner = Rules.getWinner(state);
        showMoveTrail(move, piece ? piece.team : side);
        playMoveSound(move, winner);
      } else {
        state.turn = side === "blue" ? "red" : "blue";
      }
      cpuBusy = false;
      clearSelection();
      render();
      if (spectatorMode && !Rules.getWinner(state)) {
        scheduleSpectatorTurn(520);
      }
    }, spectatorMode ? 520 : 220);
  }

  function setSpectatorMode(enabled) {
    spectatorMode = enabled;
    clearSelection();
    if (!enabled) {
      clearAutoTimer();
      cpuBusy = false;
    }
    render();
    if (enabled) {
      playStartSound();
      scheduleSpectatorTurn(260);
    } else if (!Rules.getWinner(state) && state.turn === "red") {
      runAutoTurn("red");
    }
  }

  restartButton.addEventListener("click", () => {
    state = Game.createGameState();
    cpuBusy = false;
    winnerSoundPlayedFor = null;
    clearAutoTimer();
    clearSelection();
    clearMoveTrail();
    render();
    playSound("start");
    if (spectatorMode) scheduleSpectatorTurn(360);
  });

  schoolSelect.addEventListener("change", () => {
    clearSelection();
    clearMoveTrail();
    render();
    if (spectatorMode) scheduleSpectatorTurn(260);
  });

  spectatorButton.addEventListener("click", () => {
    setSpectatorMode(!spectatorMode);
  });

  renderSchoolOptions();
  renderLegends();
  updateSpectatorButton();
  render();
  window.setTimeout(playStartSound, 120);
  window.addEventListener("pointerdown", playStartSound, { once: true });
})(globalThis);
