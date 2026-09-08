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
      attackRange: 1,
      fieldTerrains: ["classroom"],
      specialText: "捕獲されると敗北"
    },
    home: {
      name: "帰宅部",
      shortName: "帰",
      role: "pawn",
      value: 90,
      baseMove: 1,
      attackRange: 1,
      fieldTerrains: ["courtyard", "classroom"],
      promotionRule: "lastRank",
      promotedType: "narikin",
      specialText: "前方1マス。敵陣3段で成金"
    },
    track: {
      name: "陸上部",
      shortName: "陸",
      role: "mobile",
      value: 520,
      baseMove: 4,
      attackRange: 2,
      fieldTerrains: ["ground"],
      terrainBonus: { ground: { move: 2 } },
      specialText: "グラウンドで移動+2"
    },
    archery: {
      name: "弓道部",
      shortName: "弓",
      role: "ranged",
      value: 620,
      baseMove: 1,
      attackRange: 2,
      fieldTerrains: ["archeryRange"],
      minAttackRange: 2,
      specialText: "前方2マス射撃"
    },
    kendo: {
      name: "剣道部",
      shortName: "剣",
      role: "melee",
      value: 360,
      baseMove: 1,
      attackRange: 1,
      fieldTerrains: ["gym"],
      terrainBonus: { classroom: { move: 1 } },
      specialText: "後退なしの近接型"
    },
    judo: {
      name: "柔道部",
      shortName: "柔",
      role: "heavyShield",
      value: 410,
      baseMove: 1,
      attackRange: 1,
      fieldTerrains: ["gym"],
      shield: "heavy",
      specialText: "弓道攻撃を防ぐ重盾"
    },
    swim: {
      name: "水泳部",
      shortName: "水",
      role: "mobileShield",
      value: 380,
      baseMove: 1,
      attackRange: 1,
      fieldTerrains: ["pool"],
      shield: "light",
      terrainBonus: { pool: { move: 1 } },
      specialText: "プールで移動+1の軽盾"
    },
    rugby: {
      name: "ラグビー部",
      shortName: "ラ",
      role: "charge",
      value: 430,
      baseMove: 3,
      attackRange: 1,
      fieldTerrains: ["ground"],
      specialText: "前方3方向へ突撃"
    },
    chemistry: {
      name: "化学部",
      shortName: "化",
      role: "control",
      value: 340,
      baseMove: 1,
      attackRange: 1,
      fieldTerrains: ["lab"],
      specialRange: 2,
      terrainBonus: { lab: { specialRange: 1 } },
      specialText: "範囲内に立入禁止2手"
    },
    broadcast: {
      name: "放送部",
      shortName: "放",
      role: "support",
      value: 300,
      baseMove: 1,
      attackRange: 1,
      fieldTerrains: ["clubhouse"],
      specialRange: 2,
      specialText: "味方1体の射程/妨害+1"
    },
    newspaper: {
      name: "新聞部",
      shortName: "新",
      role: "scout",
      value: 280,
      baseMove: 2,
      attackRange: 1,
      fieldTerrains: ["clubhouse"],
      specialRange: 2,
      specialText: "敵1体を取材で捕獲不可"
    },
    art: {
      name: "美術部",
      shortName: "美",
      role: "decoy",
      value: 300,
      baseMove: 1,
      attackRange: 1,
      fieldTerrains: ["clubhouse"],
      specialRange: 1,
      specialText: "隣接マスにデコイ設置"
    },
    drama: {
      name: "演劇部",
      shortName: "演",
      role: "trick",
      value: 310,
      baseMove: 1,
      attackRange: 1,
      fieldTerrains: ["clubhouse"],
      specialRange: 1,
      specialText: "隣接敵の捕獲を1手封じる"
    },
    pc: {
      name: "パソコン部",
      shortName: "PC",
      role: "remoteControl",
      value: 360,
      baseMove: 1,
      attackRange: 1,
      fieldTerrains: ["classroom"],
      specialRange: 3,
      specialText: "直線3マスの敵を停止"
    },
    physics: {
      name: "物理部",
      shortName: "物",
      role: "jump",
      value: 370,
      baseMove: 1,
      attackRange: 1,
      fieldTerrains: ["lab"],
      specialText: "縦横で1駒飛び越え"
    },
    band: {
      name: "吹奏楽部",
      shortName: "吹",
      role: "morale",
      value: 320,
      baseMove: 1,
      attackRange: 1,
      fieldTerrains: ["clubhouse"],
      specialRange: 1,
      specialText: "味方1体に身代わり回避"
    },
    nurse: {
      name: "保健委員",
      shortName: "保",
      role: "cleanse",
      value: 300,
      baseMove: 1,
      attackRange: 1,
      fieldTerrains: ["classroom"],
      specialRange: 1,
      specialText: "隣接味方の状態回復"
    },
    baseball: {
      name: "野球部",
      shortName: "野",
      role: "midRange",
      value: 390,
      baseMove: 1,
      attackRange: 2,
      fieldTerrains: ["ground"],
      specialText: "縦横2マス先へ打撃"
    },
    soccer: {
      name: "サッカー部",
      shortName: "サ",
      role: "dribble",
      value: 360,
      baseMove: 2,
      attackRange: 1,
      fieldTerrains: ["ground"],
      specialText: "縦横2マスの機動力"
    },
    basketball: {
      name: "バスケ部",
      shortName: "バ",
      role: "leaper",
      value: 370,
      baseMove: 1,
      attackRange: 1,
      fieldTerrains: ["gym"],
      specialText: "縦横にジャンプ移動"
    },
    volleyball: {
      name: "バレー部",
      shortName: "バレ",
      role: "block",
      value: 330,
      baseMove: 1,
      attackRange: 1,
      fieldTerrains: ["gym"],
      shield: "light",
      specialRange: 1,
      specialText: "隣接味方をブロック保護"
    }
  };

  const CPU_SCHOOLS = {
    normal: {
      name: "普通科",
      stars: "★",
      depth: 1,
      blunderRate: 0.1,
      weights: { material: 1, presidentSafety: 0.8, pressure: 0.6, mobility: 0.22, terrain: 0.28 }
    },
    gifted: {
      name: "工業科",
      stars: "★★",
      depth: 2,
      blunderRate: 0.03,
      weights: { material: 1, presidentSafety: 1, pressure: 0.8, mobility: 0.35, terrain: 0.45 }
    },
    imperial: {
      name: "商業科",
      stars: "★★★",
      depth: 2,
      blunderRate: 0,
      weights: { material: 1, presidentSafety: 1.2, pressure: 1, mobility: 0.45, terrain: 0.55 }
    },
    science: {
      name: "理数科",
      stars: "★★★",
      depth: 2,
      blunderRate: 0,
      weights: { material: 1, presidentSafety: 1.15, pressure: 0.95, mobility: 0.42, terrain: 0.65 }
    },
    cruel: {
      name: "体育科",
      stars: "★★★★",
      depth: 3,
      blunderRate: 0,
      weights: { material: 1, presidentSafety: 1.35, pressure: 1.15, mobility: 0.5, terrain: 0.65 }
    }
  };

  global.BukatsuConfig = { BOARD_CONFIG, TERRAIN, CLUBS, CPU_SCHOOLS };
})(globalThis);
