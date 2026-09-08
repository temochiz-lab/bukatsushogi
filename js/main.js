(function (global) {
  "use strict";

  const { TERRAIN, CLUBS, CPU_SCHOOLS } = global.BukatsuConfig;
  const Rules = global.BukatsuRules;
  const Game = global.BukatsuGame;
  const Cpu = global.BukatsuCpu;

  const boardEl = document.getElementById("board");
  const moveTrail = document.getElementById("moveTrail");
  const checkBanner = document.getElementById("checkBanner");
  const resultDialog = document.getElementById("resultDialog");
  const resultTitle = document.getElementById("resultTitle");
  const resultMessage = document.getElementById("resultMessage");
  const statusText = document.getElementById("statusText");
  const selectionPanel = document.getElementById("selectionPanel");
  const turnStat = document.getElementById("turnStat");
  const blueCaptured = document.getElementById("blueCaptured");
  const redCaptured = document.getElementById("redCaptured");
  const moveHistory = document.getElementById("moveHistory");
  const spectatorButton = document.getElementById("spectatorButton");
  const restartButton = document.getElementById("restartButton");
  const schoolSelect = document.getElementById("schoolSelect");
  const clubLegend = document.getElementById("clubLegend");
  const deckSetup = document.getElementById("deckSetup");
  const deckButton = document.getElementById("deckButton");

  let state = Game.createGameState("normal");
  let mapBoard = state.board.map(({ pieceId, ...cell }) => cell);
  let setupComplete = false;
  let deckStep = "choice";
  let deckMode = null;
  let manualDeck = [];
  let selectedDeckClub = null;
  let draggedDeckClub = null;
  let storageMode = null;
  let storageDraftName = "";
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
  let resultDialogShownFor = null;
  let replayTimerId = null;
  let replayHistory = [];
  let replayIndex = 0;
  let resultFadeTimerId = null;

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


  function isNarikin(piece) {
    return piece && piece.club === "home" && piece.promoted;
  }

  function clubName(piece) {
    if (isNarikin(piece)) return "成金";
    const name = CLUBS[piece.club].name;
    return piece.promoted ? `${name}（成）` : name;
  }

  function clubShortName(piece) {
    return isNarikin(piece) ? "成" : CLUBS[piece.club].shortName;
  }

  function historyClubShortName(entry) {
    if (entry.club === "home" && entry.promoted) return "成";
    const shortName = CLUBS[entry.club].shortName;
    return entry.promoted ? `${shortName}+` : shortName;
  }
  function actionLabel(move) {
    if (move.type === "attack") return "射撃";
    if (move.type === "special") return "妨害";
    return move.captureId ? "捕獲" : "移動";
  }

  function movementDirections(key) {
    const dirs = {
      president: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
      home: [[-1, 0]],
      promotedHome: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, 0]],
      track: [[-1, 0], [0, -1], [0, 1], [1, 0]],
      archery: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
      kendo: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1]],
      judo: [[-1, 0], [0, -1], [0, 1], [1, 0]],
      swim: [[-1, 0], [0, -1], [0, 1], [1, 0]],
      rugby: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1]],
      chemistry: [[-1, 0], [0, -1], [0, 1], [1, 0]],
      broadcast: [[-1, 0], [0, -1], [0, 1], [1, 0]],
      newspaper: [[-1, 0], [0, -1], [0, 1], [1, 0]],
      art: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
      drama: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
      pc: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
      physics: [[-1, 0], [0, -1], [0, 1], [1, 0]],
      band: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
      nurse: [[-1, 0], [0, -1], [0, 1], [1, 0]],
      baseball: [[-1, 0], [0, -1], [0, 1], [1, 0]],
      soccer: [[-1, 0], [0, -1], [0, 1], [1, 0]],
      basketball: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]],
      volleyball: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1]]
    };
    return dirs[key] || [];
  }
  function movementDiagram(key) {
    const center = 18;
    const lines = movementDirections(key).map(([row, col]) => {
      const length = Math.hypot(row, col);
      const dx = col / length;
      const dy = row / length;
      const tipX = center + dx * 15;
      const tipY = center + dy * 15;
      const baseX = center + dx * 10;
      const baseY = center + dy * 10;
      const tailX = center + dx * 5;
      const tailY = center + dy * 5;
      const leftX = baseX + dy * 2.6;
      const leftY = baseY - dx * 2.6;
      const rightX = baseX - dy * 2.6;
      const rightY = baseY + dx * 2.6;
      return `<line class="move-diagram-line" x1="${tailX.toFixed(1)}" y1="${tailY.toFixed(1)}" x2="${baseX.toFixed(1)}" y2="${baseY.toFixed(1)}"></line><polygon class="move-diagram-head" points="${tipX.toFixed(1)},${tipY.toFixed(1)} ${leftX.toFixed(1)},${leftY.toFixed(1)} ${rightX.toFixed(1)},${rightY.toFixed(1)}"></polygon>`;
    }).join("");
    return `<svg class="move-diagram" viewBox="0 0 36 36" role="img" aria-label="進める方向">${lines}<circle class="move-diagram-core" cx="18" cy="18" r="5"></circle></svg>`;
  }
  function fieldText(club) {
    if (!club.fieldTerrains || club.fieldTerrains.length === 0) return "";
    const names = club.fieldTerrains.map((key) => TERRAIN[key].name).join("/");
    return `得意:${names}で移動2倍`;
  }

  function promotionText(key) {
    if (key === "promotedHome" || key === "president") return "";
    return key === "home" ? "敵陣3段で成金" : "敵陣3段で成り移動+1";
  }

  function detailText(key, club) {
    return [club.specialText, fieldText(club), promotionText(key)].filter(Boolean).join(" / ");
  }

  function resetGameForDeck(newMap = false) {
    if (newMap) mapBoard = global.BukatsuBoard.createBoard();
    const lineup = deckMode === "manual"
      ? global.BukatsuPieces.lineupFromClubKeys(manualDeck)
      : null;
    state = Game.createGameState(schoolSelect.value, lineup, mapBoard);
    cpuBusy = false;
    winnerSoundPlayedFor = null;
    clearAutoTimer();
    clearSelection();
    clearMoveTrail();
  }

  function completeDeckSetup(startAsSpectator = false) {
    setupComplete = true;
    spectatorMode = startAsSpectator;
    resetGameForDeck();
    renderDeckSetup();
    render();
    playStartSound();
    if (spectatorMode) scheduleSpectatorTurn(260);
  }

  const DECK_STORAGE_KEY = "bukatsu-decks-v1";

  function readSavedDecks() {
    try {
      const saved = JSON.parse(localStorage.getItem(DECK_STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved.slice(0, 3) : [];
    } catch (error) {
      return [];
    }
  }

  function writeSavedDecks(decks) {
    localStorage.setItem(DECK_STORAGE_KEY, JSON.stringify(decks.slice(0, 3)));
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      "\"": "&quot;"
    }[character]));
  }

  function fillEmptyDeckSlots() {
    const used = new Set(manualDeck.filter(Boolean));
    const candidates = global.BukatsuPieces.playableClubKeys().filter((key) => !used.has(key));
    for (let index = candidates.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [candidates[index], candidates[swapIndex]] = [candidates[swapIndex], candidates[index]];
    }
    manualDeck = manualDeck.map((clubKey) => clubKey || candidates.shift());
  }

  function saveCurrentDeck(slotIndex, name) {
    if (!manualDeck.every(Boolean)) return;
    const decks = readSavedDecks();
    decks[slotIndex] = {
      name: name.trim() || `デッキ${slotIndex + 1}`,
      clubs: [...manualDeck],
      savedAt: new Date().toISOString()
    };
    writeSavedDecks(decks);
    storageMode = null;
    storageDraftName = "";
    renderDeckSetup();
  }

  function loadDeck(slotIndex) {
    const entry = readSavedDecks()[slotIndex];
    const playable = new Set(global.BukatsuPieces.playableClubKeys());
    if (!entry || !Array.isArray(entry.clubs) || entry.clubs.length !== global.BukatsuPieces.playerDeckSlots.length || new Set(entry.clubs).size !== entry.clubs.length || entry.clubs.some((key) => !playable.has(key))) return;
    manualDeck = [...entry.clubs];
    storageMode = null;
    selectedDeckClub = null;
    renderDeckSetup();
  }

  function deleteSavedDeck(slotIndex) {
    const decks = readSavedDecks();
    decks.splice(slotIndex, 1);
    writeSavedDecks(decks);
    renderDeckSetup();
  }

  function storagePanelHtml() {
    const decks = readSavedDecks();
    const rows = Array.from({ length: 3 }, (_, index) => {
      const entry = decks[index];
      const title = entry ? escapeHtml(entry.name) : "未登録";
      const date = entry && entry.savedAt ? new Date(entry.savedAt).toLocaleDateString("ja-JP") : "";
      const action = storageMode === "save"
        ? `<button type="button" data-storage-save="${index}"${manualDeck.every(Boolean) ? "" : " disabled"}>保存</button>`
        : entry ? `<button type="button" data-storage-load="${index}">読込</button><button type="button" class="text-button" data-storage-delete="${index}">削除</button>` : "";
      return `<div class="deck-storage-row"><div><strong>${title}</strong><small>${date}</small></div>${action}</div>`;
    }).join("");
    return `<div class="deck-storage"><div class="deck-storage-head"><strong>${storageMode === "save" ? "デッキを保存" : "デッキを読込"}</strong><button type="button" class="text-button" data-storage-action="close">閉じる</button></div>${storageMode === "save" ? `<label class="deck-name-field">デッキ名<input id="deckNameInput" type="text" maxlength="20" value="${escapeHtml(storageDraftName)}" placeholder="例：守備型"></label>` : ""}<div class="deck-storage-list">${rows}</div></div>`;
  }  function renderDeckSetup() {
    deckButton.hidden = true;
    deckButton.disabled = true;
    if (setupComplete) {
      deckSetup.classList.add("hidden");
      return;
    }

    deckSetup.classList.remove("hidden");
    if (deckStep === "choice") {
      deckSetup.innerHTML = `
        <div class="deck-choice">
          <div><h2>先手の編成</h2><p>会長と帰宅部は固定。残りの部活を決めて対局を始めます。</p></div>
          <div class="deck-choice-actions">
            <button type="button" data-deck-action="auto">自動実行</button>
            <button type="button" data-deck-action="manual-start">手動実行</button>
            <button type="button" data-deck-action="manual">編成</button>
          </div>
        </div>`;
      deckSetup.querySelector('[data-deck-action="auto"]').addEventListener("click", () => {
        deckMode = "auto";
        completeDeckSetup(true);
      });
      deckSetup.querySelector('[data-deck-action="manual-start"]').addEventListener("click", () => {
        deckMode = "auto";
        completeDeckSetup(false);
      });
      deckSetup.querySelector('[data-deck-action="manual"]').addEventListener("click", () => {
        deckMode = "manual";
        deckStep = "manual";
        manualDeck = Array(global.BukatsuPieces.playerDeckSlots.length).fill(null);
        selectedDeckClub = null;
        renderDeckSetup();
      });
      return;
    }

    const slots = global.BukatsuPieces.playerDeckSlots.map((slot, index) => {
      const clubKey = manualDeck[index];
      const club = clubKey ? CLUBS[clubKey] : null;
      const lineName = slot.line === "backLine" ? "後列" : "中列";
      return `<div class="deck-slot-wrap" style="grid-column:${slot.col + 1};grid-row:${slot.line === "backLine" ? 3 : 2}"><span>${lineName}</span><button type="button" class="deck-slot${club ? " filled" : ""}" data-deck-slot="${index}">${club ? `<strong>${club.shortName}</strong><small>${club.name}</small>` : "空き"}</button>${club ? `<button type="button" class="deck-slot-clear" data-deck-clear="${index}" aria-label="${club.name}を外す">×</button>` : ""}</div>`;
    }).join("");
    const palette = global.BukatsuPieces.playableClubKeys().map((key) => {
      const club = CLUBS[key];
      const used = manualDeck.includes(key);
      return `<button type="button" class="deck-card${used ? " used" : ""}${selectedDeckClub === key ? " selected" : ""}" draggable="${!used}" data-deck-card="${key}"${used ? " disabled" : ""}><span class="club-chip">${club.shortName}</span><span class="deck-card-name">${club.name}</span><span class="deck-card-icon">${movementDiagram(key)}</span></button>`;
    }).join("");

    deckSetup.innerHTML = `
      <div class="deck-builder-head"><div><h2>先手の編成を選ぶ</h2><p>右の部活をドラッグして空き枠へ。会長・帰宅部は固定です。</p></div><div class="deck-builder-head-actions"><button type="button" class="text-button" data-storage-action="save">保存</button><button type="button" class="text-button" data-storage-action="load">読込</button><button type="button" class="text-button" data-deck-action="back">戻る</button></div></div>
      <div class="deck-builder">
        <div class="deck-slots"><div class="deck-board-grid"><div class="deck-fixed-piece" style="grid-column:5;grid-row:3"><strong>会長</strong><small>固定</small></div>${slots}<div class="deck-home-line" style="grid-row:1">${Array.from({ length: 9 }, () => `<span class="deck-fixed-home"><strong>帰</strong><small>帰宅部</small></span>`).join("")}</div></div></div>
        <div class="deck-palette"><h3>部活</h3><div class="deck-card-grid">${palette}</div></div>
      </div>
      <div class="deck-action-row"><span>${manualDeck.filter(Boolean).length} / ${global.BukatsuPieces.playerDeckSlots.length}</span><button type="button" data-deck-action="start">空きはランダム補充して決定</button></div>${storageMode ? storagePanelHtml() : ""}`;

    deckSetup.querySelector('[data-deck-action="back"]').addEventListener("click", () => {
      deckStep = "choice";
      selectedDeckClub = null;
      renderDeckSetup();
    });

deckSetup.querySelectorAll("[data-storage-action]").forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.storageAction;
        if (action === "save" || action === "load") storageMode = action;
        if (action === "close") storageMode = null;
        renderDeckSetup();
      });
    });
    const deckNameInput = deckSetup.querySelector("#deckNameInput");
    if (deckNameInput) {
      deckNameInput.addEventListener("input", () => {
        storageDraftName = deckNameInput.value;
      });
    }
    deckSetup.querySelectorAll("[data-storage-save]").forEach((button) => {
      button.addEventListener("click", () => saveCurrentDeck(Number(button.dataset.storageSave), deckNameInput ? deckNameInput.value : ""));
    });
    deckSetup.querySelectorAll("[data-storage-load]").forEach((button) => {
      button.addEventListener("click", () => loadDeck(Number(button.dataset.storageLoad)));
    });
    deckSetup.querySelectorAll("[data-storage-delete]").forEach((button) => {
      button.addEventListener("click", () => deleteSavedDeck(Number(button.dataset.storageDelete)));
    });
    deckSetup.querySelector('[data-deck-action="start"]').addEventListener("click", () => {
      fillEmptyDeckSlots();
      completeDeckSetup();
    });
    deckSetup.querySelectorAll("[data-deck-card]").forEach((card) => {
      card.addEventListener("click", () => {
        selectedDeckClub = selectedDeckClub === card.dataset.deckCard ? null : card.dataset.deckCard;
        renderDeckSetup();
      });
      card.addEventListener("dragstart", (event) => {
        draggedDeckClub = card.dataset.deckCard;
        event.dataTransfer.setData("text/plain", draggedDeckClub);
      });
    });
    deckSetup.querySelectorAll("[data-deck-slot]").forEach((slot) => {
      slot.addEventListener("click", () => {
        const club = selectedDeckClub || draggedDeckClub;
        if (club) assignDeckClub(Number(slot.dataset.deckSlot), club);
      });
      slot.addEventListener("dragover", (event) => event.preventDefault());
      slot.addEventListener("drop", (event) => {
        event.preventDefault();
        assignDeckClub(Number(slot.dataset.deckSlot), event.dataTransfer.getData("text/plain") || draggedDeckClub);
        draggedDeckClub = null;
      });
    });
    deckSetup.querySelectorAll("[data-deck-clear]").forEach((button) => {
      button.addEventListener("click", () => {
        manualDeck[Number(button.dataset.deckClear)] = null;
        selectedDeckClub = null;
        renderDeckSetup();
      });
    });
  }

  function assignDeckClub(index, clubKey) {
    if (!global.BukatsuPieces.playableClubKeys().includes(clubKey)) return;
    const previousIndex = manualDeck.indexOf(clubKey);
    if (previousIndex !== -1 && previousIndex !== index) manualDeck[previousIndex] = null;
    manualDeck[index] = clubKey;
    selectedDeckClub = null;
    renderDeckSetup();
  }

  function openDeckSetup() {
    clearAutoTimer();
    cpuBusy = false;
    spectatorMode = false;
    setupComplete = false;
    deckStep = "choice";
    selectedDeckClub = null;
    renderDeckSetup();
    render();
  }
  function renderLegends() {
const clubEntries = Object.entries(CLUBS).concat([["promotedHome", { name: "成金", shortName: "成", specialText: "帰宅部が敵陣3段で成る" }]]);
    clubLegend.innerHTML = clubEntries.map(([key, club]) => (
      `<div class="legend-row club-row"><span class="club-chip">${club.shortName}</span><span class="club-name">${club.name}</span><span class="move-hint">${movementDiagram(key)}</span><span class="club-special">${detailText(key, club) || "-"}</span></div>`
    )).join("");
  }

  function renderSchoolOptions() {
    schoolSelect.innerHTML = Object.entries(CPU_SCHOOLS).map(([key, school]) => (
      `<option value="${key}">${school.name} ${school.stars}</option>`
    )).join("");
    schoolSelect.value = "normal";
  }

  function updateSpectatorButton() {
    spectatorButton.textContent = spectatorMode ? "手動操作" : "自動実行";
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
        marker.textContent = hazard.kind === "decoy" ? "偽" : "×";
        cellEl.appendChild(marker);
      }

      const piece = Rules.pieceAt(state, cell.row, cell.col);
      if (piece) {
        const pieceEl = document.createElement("span");
        pieceEl.className = `piece ${piece.team}${piece.promoted ? " promoted" : ""}`;
        pieceEl.title = `${Game.sideName(piece.team)} ${clubName(piece)}`;
        pieceEl.innerHTML = `<small>${clubShortName(piece)}</small>`;
        cellEl.appendChild(pieceEl);
      }

      cellEl.addEventListener("click", () => handleCellClick(cell.row, cell.col));
      cellEl.disabled = !setupComplete || Rules.isFinished(state) || cpuBusy;
      boardEl.appendChild(cellEl);
    }
  }

  function renderStatus() {
        if (!setupComplete) {
      statusText.textContent = "編成を選択してください";
      turnStat.textContent = "-";
      blueCaptured.textContent = "0";
      redCaptured.textContent = "0";
      return;
    }
    const winner = Rules.getWinner(state);
    if (state.drawReason) {
      statusText.textContent = "千日手。引き分けです。";
    } else if (winner) {
      statusText.textContent = `${Game.sideName(winner)}が生徒会長を捕獲。決着です。`;
    } else if (cpuBusy) {
      statusText.textContent = spectatorMode ? `${Game.sideName(state.turn)}が考え中` : `${schoolConfig().name}が考え中`;
    } else {
      statusText.textContent = spectatorMode ? "自動実行中" : state.turn === "blue" ? "あなたの手番です" : "CPUの手番です";
    }

    turnStat.textContent = Game.sideName(state.turn);
    blueCaptured.textContent = String(state.captured.blue.length);
    redCaptured.textContent = String(state.captured.red.length);
  }

  function historyNotation(entry) {
    const coord = `${entry.toCol + 1}${entry.toRow + 1}`;
    const club = historyClubShortName(entry);
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

  function stopReplay() {
    if (replayTimerId) {
      window.clearTimeout(replayTimerId);
      replayTimerId = null;
    }
    replayHistory = [];
    replayIndex = 0;
  }

  function openResultDialog(winner) {
    if (resultDialogShownFor === winner || !resultDialog) return;
    resultDialogShownFor = winner;
    replayHistory = state.history.map((entry) => ({ ...entry }));
    resultTitle.textContent = winner === "draw" ? "千日手" : winner === "blue" ? "勝利" : "敗北";
    resultMessage.textContent = winner === "draw" ? "同じ局面が4回現れました。引き分けです。" : winner === "blue" ? "生徒会長を守り切りました。" : "生徒会長を捕獲されました。";
    resultDialog.hidden = true;
    resultDialog.classList.remove("visible");
  }

  function startNewGame() {
    resultDialog.hidden = true;
    resultDialog.classList.remove("visible");
    stopReplay();
    setupComplete = false;
    deckStep = "choice";
    deckMode = null;
    manualDeck = [];
    selectedDeckClub = null;
    storageMode = null;
    storageDraftName = "";
    resultDialogShownFor = null;
    mapBoard = global.BukatsuBoard.createBoard();
    state = Game.createGameState(schoolSelect.value, null, mapBoard);
    cpuBusy = false;
    spectatorMode = false;
    clearSelection();
    clearMoveTrail();
    renderDeckSetup();
    render();
  }

  function startReplay() {
    if (!replayHistory.length) return;
    resultDialog.hidden = true;
    resultDialog.classList.remove("visible");
    if (replayTimerId) window.clearTimeout(replayTimerId);
    const lineup = deckMode === "manual"
      ? global.BukatsuPieces.lineupFromClubKeys(manualDeck)
      : null;
    state = Game.createGameState(schoolSelect.value, lineup, mapBoard);
    resultDialogShownFor = null;
    replayIndex = 0;
    cpuBusy = true;
    clearSelection();
    clearMoveTrail();
    render();
    replayTimerId = window.setTimeout(playReplayStep, 420);
  }

  function playReplayStep() {
    replayTimerId = null;
    if (replayIndex >= replayHistory.length) {
      cpuBusy = false;
      render();
      return;
    }
    const entry = replayHistory[replayIndex];
    const piece = entry.pieceId
      ? Rules.getPiece(state, entry.pieceId)
      : state.pieces.find((item) => item.team === entry.side && item.club === entry.club && !item.captured && item.row === entry.fromRow && item.col === entry.fromCol);
    if (piece) {
      const move = {
        pieceId: piece.id,
        type: entry.type,
        special: entry.special,
        from: { row: entry.fromRow, col: entry.fromCol },
        to: { row: entry.toRow, col: entry.toCol },
        captureId: entry.captureId,
        targetId: entry.targetId,
        captureDecoy: entry.captureDecoy
      };
      state = Rules.applyMove(state, move);
      showMoveTrail(move, piece.team);
    }
    replayIndex += 1;
    render();
    replayTimerId = window.setTimeout(playReplayStep, 420);
  }
  function renderCheckBanner() {
    const winner = Rules.getWinner(state);
    if (winner || state.drawReason) {
      if (checkTimerId) {
        window.clearTimeout(checkTimerId);
        checkTimerId = null;
      }
      const resultKind = state.drawReason ? "draw" : winner;
      const resultLabel = resultKind === "draw" ? "千日手" : resultKind === "blue" ? "勝利" : "敗北";
      const resultAlreadyShown = resultDialogShownFor === resultKind;
      checkBanner.innerHTML = `<strong class="result-banner-title">${resultLabel}</strong><div class="result-banner-actions"><button type="button" data-result-action="new">新規</button><button type="button" data-result-action="replay">棋譜再現</button></div>`;
      checkBanner.classList.remove("blue", "red", "result");
      if (!state.drawReason) checkBanner.classList.add("visible", "result", winner === "blue" ? "blue" : "red");
      else checkBanner.classList.add("visible");
      if (!resultAlreadyShown && !state.drawReason) {
        checkBanner.classList.remove("result-faded");
        if (resultFadeTimerId) window.clearTimeout(resultFadeTimerId);
        resultFadeTimerId = window.setTimeout(() => {
          checkBanner.classList.add("result-faded");
          resultFadeTimerId = null;
        }, 3000);
      }
      openResultDialog(resultKind);
      checkBanner.querySelector(`[data-result-action="new"]`).addEventListener("click", startNewGame);
      checkBanner.querySelector(`[data-result-action="replay"]`).addEventListener("click", startReplay);
      visibleCheckSide = null;
      hiddenCheckSide = null;
      return;
    }

    const blueInCheck = Rules.isSideInCheck(state, "blue");
    const redInCheck = Rules.isSideInCheck(state, "red");
    const checkedSide = blueInCheck ? "blue" : redInCheck ? "red" : null;

    if (!checkedSide) {
      checkBanner.classList.remove("visible", "blue", "red", "result", "result-faded");
      if (resultFadeTimerId) {
        window.clearTimeout(resultFadeTimerId);
        resultFadeTimerId = null;
      }
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

    const checkingSide = checkedSide === "blue" ? "red" : "blue";
    checkBanner.textContent = "王手";
    checkBanner.classList.remove("blue", "red");
    checkBanner.classList.add("visible", checkingSide);

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
        if (!setupComplete) {
      selectionPanel.textContent = "編成を選択してください";
      return;
    }
    if (!selectedPieceId) {
      selectionPanel.textContent = spectatorMode ? "自動実行中" : state.turn === "blue" ? "あなたの駒を選択" : "CPUの手番";
      return;
    }
    const piece = Rules.getPiece(state, selectedPieceId);
    if (!piece) return;
    const moveText = selectedMoves.length === 0
      ? "合法手なし"
      : selectedMoves.map((move) => `${actionLabel(move)} ${move.to.row + 1}-${move.to.col + 1}`).slice(0, 8).join(" / ");
    selectionPanel.innerHTML = `<strong>${clubName(piece)}</strong><br>${Game.sideName(piece.team)}<br>${moveText}`;
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
    if (!Rules.isFinished(state) && state.turn === "red") {
      runAutoTurn("red");
    }
  }

  function handleCellClick(row, col) {
        if (!setupComplete || cpuBusy || spectatorMode || Rules.isFinished(state) || state.turn !== "blue") return;

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
    if (!spectatorMode || cpuBusy || Rules.isFinished(state)) return;
    autoTimerId = window.setTimeout(() => {
      autoTimerId = null;
      runAutoTurn(state.turn);
    }, delay);
  }

  function runAutoTurn(side) {
    if (Rules.isFinished(state) || state.turn !== side) return;
    cpuBusy = true;
    render();
    clearAutoTimer();
    autoTimerId = window.setTimeout(() => {
      autoTimerId = null;
      if (Rules.isFinished(state) || state.turn !== side) {
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
      if (spectatorMode && !Rules.isFinished(state)) {
        scheduleSpectatorTurn(520);
      }
    }, spectatorMode ? 520 : 220);
  }

  function setSpectatorMode(enabled) {
        if (!setupComplete) return;
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
    } else if (!Rules.isFinished(state) && state.turn === "red") {
      runAutoTurn("red");
    }
  }

  restartButton.addEventListener("click", () => {
    if (!setupComplete) return;
    resetGameForDeck(true);
    render();
    playSound("start");
    if (spectatorMode) scheduleSpectatorTurn(360);
  });

  schoolSelect.addEventListener("change", () => {
    if (!setupComplete) return;
    resetGameForDeck(true);
    render();
    if (spectatorMode) scheduleSpectatorTurn(260);
  });

  deckButton.addEventListener("click", openDeckSetup);

  spectatorButton.addEventListener("click", () => {
    setSpectatorMode(!spectatorMode);
  });

  resultDialog.querySelector('[data-result-action="new"]').addEventListener("click", startNewGame);
  resultDialog.querySelector('[data-result-action="replay"]').addEventListener("click", startReplay);
  renderSchoolOptions();
  renderLegends();
  renderDeckSetup();
  updateSpectatorButton();
  render();
})(globalThis);
