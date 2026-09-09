(function (global) {
  "use strict";

  function createPiece(id, team, club, row, col) {
    return { id, team, originalTeam: team, club, row, col, promoted: false };
  }

  const homeCols = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const playerBackCols = [0, 1, 2, 3, 5, 6, 7, 8];
  const playerMiddleCols = [1, 4, 7];
  const playerFixedBackLine = [["president", 4]];
  const playerDeckSlots = playerBackCols.map((col) => ({ line: "backLine", row: 8, col }))
    .concat(playerMiddleCols.map((col) => ({ line: "middleLine", row: 7, col })));

  const playerBackLine = [
    ["swim", 0],
    ["chemistry", 1],
    ["judo", 2],
    ["kendo", 3],
    ["president", 4],
    ["kendo", 5],
    ["judo", 6],
    ["chemistry", 7],
    ["swim", 8]
  ];
  const playerMiddleLine = [
    ["track", 1],
    ["rugby", 4],
    ["archery", 7]
  ];

  const cpuLineups = {
    normal: {
      backLine: playerBackLine,
      middleLine: [["archery", 1], ["rugby", 4], ["track", 7]]
    },
    gifted: {
      backLine: [["pc", 0], ["physics", 1], ["chemistry", 2], ["art", 3], ["president", 4], ["art", 5], ["chemistry", 6], ["physics", 7], ["pc", 8]],
      middleLine: [["basketball", 1], ["baseball", 4], ["volleyball", 7]]
    },
    science: {
      backLine: [["physics", 0], ["chemistry", 1], ["pc", 2], ["archery", 3], ["president", 4], ["archery", 5], ["pc", 6], ["chemistry", 7], ["physics", 8]],
      middleLine: [["physics", 1], ["chemistry", 4], ["art", 7]]
    },
    cruel: {
      backLine: [["volleyball", 0], ["swim", 1], ["judo", 2], ["kendo", 3], ["president", 4], ["kendo", 5], ["basketball", 6], ["soccer", 7], ["volleyball", 8]],
      middleLine: [["track", 1], ["rugby", 4], ["baseball", 7]]
    },
    commercial: {
      backLine: [["pc", 0], ["broadcast", 1], ["newspaper", 2], ["art", 3], ["president", 4], ["art", 5], ["newspaper", 6], ["broadcast", 7], ["pc", 8]],
      middleLine: [["drama", 1], ["band", 4], ["basketball", 7]]
    },
    agriculture: {
      backLine: [["chemistry", 0], ["track", 1], ["judo", 2], ["rugby", 3], ["president", 4], ["rugby", 5], ["judo", 6], ["track", 7], ["chemistry", 8]],
      middleLine: [["baseball", 1], ["physics", 4], ["volleyball", 7]]
    }
  };

  function shuffle(items) {
    const next = [...items];
    for (let index = next.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
    }
    return next;
  }

  function playableClubKeys() {
    return Object.keys(global.BukatsuConfig.CLUBS).filter((club) => club !== "home" && club !== "president");
  }

  function lineupFromClubKeys(clubKeys) {
    return {
      backLine: playerFixedBackLine.concat(playerBackCols.map((col, index) => [clubKeys[index], col])),
      middleLine: playerMiddleCols.map((col, index) => [clubKeys[playerBackCols.length + index], col])
    };
  }

  function randomPlayerLineup() {
    return lineupFromClubKeys(shuffle(playableClubKeys()).slice(0, playerDeckSlots.length));
  }

  function lineupForSchool(schoolKey) {
    const lineup = cpuLineups[schoolKey] || cpuLineups.normal;
    return {
      backLine: lineup.backLine,
      middleLine: lineup.middleLine,
      frontClub: global.BukatsuConfig.CPU_SCHOOLS[schoolKey]?.frontClub || "home"
    };
  }

  function normalizePlayerLineup(playerLineup) {
    if (!playerLineup || !Array.isArray(playerLineup.backLine) || !Array.isArray(playerLineup.middleLine)) {
      return randomPlayerLineup();
    }
    return {
      backLine: playerFixedBackLine.concat(playerLineup.backLine.filter(([club]) => club !== "president")),
      middleLine: playerLineup.middleLine,
      frontClub: playerLineup.frontClub || "home"
    };
  }

  function addTeam(pieces, team, homeRow, middleRow, backRow, middleLine, backLine, frontClub = "home") {
    for (const col of homeCols) {
      pieces.push(createPiece(`${team}-${frontClub}-front-${col}`, team, frontClub, homeRow, col));
    }

    for (const [club, col] of middleLine) {
      pieces.push(createPiece(`${team}-${club}-middle-${col}`, team, club, middleRow, col));
    }

    for (const [club, col] of backLine) {
      pieces.push(createPiece(`${team}-${club}-back-${col}`, team, club, backRow, col));
    }
  }

  function createInitialPieces(cpuSchoolKey, playerLineup) {
    const pieces = [];
    const cpuLineup = cpuLineups[cpuSchoolKey] || cpuLineups.normal;
    const cpuFrontClub = global.BukatsuConfig.CPU_SCHOOLS[cpuSchoolKey]?.frontClub || "home";
    const blueLineup = normalizePlayerLineup(playerLineup);
    addTeam(pieces, "blue", 6, 7, 8, blueLineup.middleLine, blueLineup.backLine, blueLineup.frontClub);
    addTeam(pieces, "red", 2, 1, 0, cpuLineup.middleLine, cpuLineup.backLine, cpuFrontClub);
    return pieces;
  }

  global.BukatsuPieces = {
    createInitialPieces,
    cpuLineups,
    playerDeckSlots,
    playableClubKeys,
    lineupFromClubKeys,
    lineupForSchool,
    randomPlayerLineup
  };
})(globalThis);
