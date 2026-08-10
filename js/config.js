(function (global) {
  "use strict";

  const BOARD_CONFIG = {
    rows: 9,
    cols: 9,
    promotionRule: null,
    promotedType: null
  };

  const TERRAIN = {
    ground: { name: "グラウンド", blocksLine: false, moveCost: 1 },
    classroom: { name: "校舎", blocksLine: true, moveCost: 1 },
    gym: { name: "体育館", blocksLine: false, moveCost: 1 },
    pool: { name: "プール", blocksLine: false, moveCost: 2 },
    lab: { name: "理科室", blocksLine: false, moveCost: 1 },
    archeryRange: { name: "弓道場", blocksLine: false, moveCost: 1 },
    courtyard: { name: "中庭", blocksLine: false, moveCost: 1 },
    clubhouse: { name: "部室棟", blocksLine: false, moveCost: 1 },
    tennis: { name: "テニス", blocksLine: false, moveCost: 1 }
  };

  const CLUBS = {
    president: {
      name: "生徒会長",
      shortName: "会",
      role: "king",
      value: 10000,
      baseMove: 1,
      attackRange: 1
    },
    home: {
      name: "帰宅部",
      shortName: "帰",
      role: "pawn",
      value: 90,
      baseMove: 1,
      attackRange: 1,
      promotionRule: null,
      promotedType: null
    },
    track: {
      name: "陸上部",
      shortName: "陸",
      role: "mobile",
      value: 520,
      baseMove: 4,
      attackRange: 2,
      terrainBonus: { ground: { move: 2 } }
    },
    archery: {
      name: "弓道部",
      shortName: "弓",
      role: "ranged",
      value: 620,
      baseMove: 1,
      attackRange: 5,
      minAttackRange: 2,
      terrainBonus: { archeryRange: { range: 1 }, ground: { range: 1 } }
    },
    kendo: {
      name: "剣道部",
      shortName: "剣",
      role: "melee",
      value: 360,
      baseMove: 1,
      attackRange: 1,
      terrainBonus: { classroom: { move: 1 } }
    },
    judo: {
      name: "柔道部",
      shortName: "柔",
      role: "heavyShield",
      value: 410,
      baseMove: 1,
      attackRange: 1,
      shield: "heavy"
    },
    swim: {
      name: "水泳部",
      shortName: "水",
      role: "mobileShield",
      value: 380,
      baseMove: 2,
      attackRange: 1,
      shield: "light",
      terrainBonus: { pool: { move: 2 } }
    },
    rugby: {
      name: "ラグビー部",
      shortName: "ラ",
      role: "charge",
      value: 430,
      baseMove: 3,
      attackRange: 1
    },
    chemistry: {
      name: "化学部",
      shortName: "化",
      role: "control",
      value: 340,
      baseMove: 1,
      attackRange: 1,
      specialRange: 2,
      terrainBonus: { lab: { specialRange: 1 } }
    }
  };

  const CPU_SCHOOLS = {
    normal: {
      name: "普通高校",
      stars: "★",
      depth: 1,
      blunderRate: 0.1,
      weights: { material: 1, presidentSafety: 0.8, pressure: 0.6, mobility: 0.22, terrain: 0.28 }
    },
    gifted: {
      name: "英才高校",
      stars: "★★",
      depth: 2,
      blunderRate: 0.03,
      weights: { material: 1, presidentSafety: 1, pressure: 0.8, mobility: 0.35, terrain: 0.45 }
    },
    imperial: {
      name: "帝国大学付属高校",
      stars: "★★★",
      depth: 2,
      blunderRate: 0,
      weights: { material: 1, presidentSafety: 1.2, pressure: 1, mobility: 0.45, terrain: 0.55 }
    },
    cruel: {
      name: "極悪高校",
      stars: "★★★★",
      depth: 3,
      blunderRate: 0,
      weights: { material: 1, presidentSafety: 1.35, pressure: 1.15, mobility: 0.5, terrain: 0.65 }
    }
  };

  global.BukatsuConfig = { BOARD_CONFIG, TERRAIN, CLUBS, CPU_SCHOOLS };
})(globalThis);
