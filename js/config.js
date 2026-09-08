(function (global) {
  "use strict";

  const BOARD_CONFIG = {
    rows: 9,
    cols: 9
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
      icon: "👑",
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
      icon: "🏠",
      role: "pawn",
      value: 90,
      baseMove: 1,
      attackRange: 1,
      fieldTerrains: ["courtyard", "classroom"],
      specialText: "前方1マス。敵陣3段で成る"
    },
    track: {
      name: "陸上部",
      shortName: "陸",
      icon: "🏃",
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
      icon: "🏹",
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
      icon: "⚔️",
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
      icon: "🥋",
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
      icon: "🌊",
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
      icon: "🏉",
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
      icon: "🧪",
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
      icon: "📻",
      role: "support",
      value: 300,
      baseMove: 1,
      attackRange: 1,
      fieldTerrains: ["clubhouse"],
      specialRange: 2,
      specialText: "攻撃した会長以外の敵を味方にする"
    },
    newspaper: {
      name: "新聞部",
      shortName: "新",
      icon: "📰",
      role: "scout",
      value: 280,
      baseMove: 2,
      attackRange: 1,
      fieldTerrains: ["clubhouse"],
      specialRange: 2,
      specialText: "攻撃した会長以外の敵を味方にする"
    },
    art: {
      name: "美術部",
      shortName: "美",
      icon: "🎨",
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
      icon: "🎭",
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
      icon: "💻",
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
      icon: "⚛️",
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
      icon: "🎺",
      role: "morale",
      value: 320,
      baseMove: 1,
      attackRange: 1,
      fieldTerrains: ["clubhouse"],
      specialRange: 1,
      specialText: "味方1体に身代わり回避"
    },
    baseball: {
      name: "野球部",
      shortName: "野",
      icon: "🥎",
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
      icon: "⚽",
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
      icon: "🏀",
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
      icon: "🏐",
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
      weights: { material: 1, presidentSafety: 0.8, pressure: 0.6, mobility: 0.22, terrain: 0.28 }
    },
    gifted: {
      name: "工業科",
      weights: { material: 1, presidentSafety: 1, pressure: 0.8, mobility: 0.35, terrain: 0.45 }
    },
    science: {
      name: "理数科",
      weights: { material: 1, presidentSafety: 1.15, pressure: 0.95, mobility: 0.42, terrain: 0.65 }
    },
    cruel: {
      name: "体育科",
      weights: { material: 1, presidentSafety: 1.35, pressure: 1.15, mobility: 0.5, terrain: 0.65 }
    }
  };

  const CPU_DIFFICULTIES = {
    easy: { name: "初級", stars: "★", depth: 1, blunderRate: 0.1 },
    normal: { name: "中級", stars: "★★", depth: 2, blunderRate: 0.03 },
    hard: { name: "上級", stars: "★★★", depth: 2, blunderRate: 0 },
    expert: { name: "最上級", stars: "★★★★", depth: 3, blunderRate: 0 }
  };

  global.BukatsuConfig = { BOARD_CONFIG, TERRAIN, CLUBS, CPU_SCHOOLS, CPU_DIFFICULTIES };
})(globalThis);
