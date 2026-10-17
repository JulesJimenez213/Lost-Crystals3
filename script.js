/* =========================================================
   THE LOST CRYSTAL - script.js   (version 3)
   A small top-down pixel-art adventure using HTML5 Canvas.

   NEW IN VERSION 3
     * SHOOTING ENEMY: the Dark Mage fires magic bolts. Dodge them, or
       swing your weapon to knock them out of the air!
     * FALLING ROCKS: a red circle warns you, then a rock crashes down.
       Step out of the circle before it lands!
     * BOSS ROOM: finish level 5, enter the portal and fight Zorgon, a giant
       alien who shoots and summons mini aliens.
     * VICTORY screen with "Play Again" and "Main Menu" buttons.

   FROM VERSION 2
     * 5 maps. Bring the crystal home and a PORTAL opens to the next map.
     * Enemies: slimes, bats and skeletons that wander and chase you.
     * Equipment: pick up a sword, shield, boots and more. Press SPACE to attack.

   HOW THE FILE IS ORGANIZED
      1. Constants and settings
      2. Equipment and enemy definitions
      3. The levels (maps, enemies, items, colours)
      4. Pixel-art sprites (drawn from text, no image files!)
      5. Loading a level
      6. Game state
      7. Sound effects (Web Audio API)
      8. Keyboard input
      9. Collision detection
     10. Update (game logic, runs every frame) - includes bullets,
         falling rocks and the boss
     11. Drawing (render)
     12. Start / restart / level changes / win / lose
     13. The game loop
   ========================================================= */


/* =========================================================
   1. CONSTANTS AND SETTINGS
   ========================================================= */
const TILE = 40;                 // one map square is 40 x 40 pixels
const PIXEL = 4;                 // one "art pixel" is 4 x 4 screen pixels
const COLS = 24;                 // map width  in tiles  (24 * 40 = 960)
const ROWS = 15;                 // map height in tiles  (15 * 40 = 600)
const WIDTH = COLS * TILE;       // 960
const HEIGHT = ROWS * TILE;      // 600

const PLAYER_SIZE = 24;          // collision box of the player AND of every enemy (24 x 24)
const PLAYER_SPEED = 150;        // movement speed in pixels per second
const INTERACT_DISTANCE = 64;    // how close you must be to the crystal to take it
const MAX_HP = 6;                // 6 health points = 3 hearts (1 heart = 2 points)

const ATTACK_TIME = 0.2;         // how long a sword swing lasts (seconds)
const ATTACK_COOLDOWN = 0.38;    // time before you can swing again
const INVULNERABLE_TIME = 1.0;   // after being hit you can't be hit again for 1 second

// The limited retro colour palette. Each letter is used by the sprite art below.
const PALETTE = {
  k: '#1b1b2f',   // outline (near black)
  d: '#1e5a34',   // dark green
  g: '#2e8b3e',   // green
  l: '#5dbb4a',   // light green
  n: '#5a3418',   // dark brown
  b: '#8b5a2b',   // brown
  t: '#d9b074',   // tan
  a: '#5c616b',   // dark gray
  s: '#8a8f98',   // gray
  w: '#c4c8d0',   // light gray
  r: '#d64541',   // red
  y: '#ffd23f',   // yellow
  p: '#ff8fb1',   // pink
  h: '#f5f5f5',   // white
  c: '#3ec8ff',   // crystal blue
  C: '#b4f0ff',   // crystal light blue
  v: '#8a5cff',   // purple
  f: '#f2c18d'    // skin
};


/* =========================================================
   2. EQUIPMENT AND ENEMY DEFINITIONS
   Want a stronger sword or a tougher monster? Change the numbers here!
   ========================================================= */

// Things the player can wear or hold. "slot" says where it goes.
const EQUIPMENT = {
  stick:      { slot: 'weapon', name: 'Wooden Stick',  damage: 1, reach: 30, colour: '#8b5a2b', tip: 'Weak, but better than nothing.' },
  sword:      { slot: 'weapon', name: 'Iron Sword',    damage: 2, reach: 40, colour: '#c4c8d0', tip: 'Damage 2, longer reach!' },
  magicSword: { slot: 'weapon', name: 'Crystal Blade', damage: 3, reach: 50, colour: '#b4f0ff', tip: 'Damage 3, huge reach!' },
  shield:     { slot: 'shield', name: 'Iron Shield',   defense: 1,           tip: 'You take 1 less damage.' },
  boots:      { slot: 'boots',  name: 'Swift Boots',   speedBonus: 0.35,     tip: 'You run 35% faster!' }
};

// Things lying on the ground that heal you.
const HEALING = {
  potion: { name: 'Health Potion', heal: 3 },
  heart:  { name: 'Heart',         heal: 2 }
};

// The monsters. chaseRange = how close you must be before they chase you.
const ENEMY_TYPES = {
  slime:    { name: 'Slime',    hp: 2, speed: 55, damage: 2, chaseRange: 150, dropChance: 0.35 },
  bat:      { name: 'Bat',      hp: 2, speed: 95, damage: 1, chaseRange: 210, dropChance: 0.25 },
  skeleton: { name: 'Skeleton', hp: 4, speed: 70, damage: 2, chaseRange: 220, dropChance: 0.50 },

  // NEW: the Dark Mage SHOOTS. It keeps its distance and fires a magic bolt at you.
  //   shootEvery = seconds between shots, shotSpeed = how fast the bolt flies (pixels/second)
  mage:     { name: 'Dark Mage', hp: 3, speed: 60, damage: 1, chaseRange: 330, dropChance: 0.40,
              ranged: true, shootEvery: 2.3, shotSpeed: 175, shotDamage: 1 },

  // NEW: the boss summons these little aliens. They are fast and always chase you.
  alien:    { name: 'Mini Alien', hp: 2, speed: 105, damage: 1, chaseRange: 2000, dropChance: 0.20 }
};


/* =========================================================
   3. THE LEVELS
   Each level has:
     name       - shown on the screen
     objective  - the goal text
     theme      - ground colours + a colour swap for the trees and bushes
     map        - 15 rows of 24 characters (see legend below)
     enemies    - which monster stands on which tile {type, col, row}
     items      - what lies on the ground {type, col, row}

   MAP LEGEND
     T = tree (solid)     R = rock (solid)     b = bush (solid)
     X = treasure chest (solid) - the crystal floats above it
     p = path             S = start pad (stone)
     O = the spot where the PORTAL appears (looks like grass until then)
     f = flowers (decoration)     . = plain grass
   ========================================================= */
const LEVELS = [

  /* ---------- LEVEL 1 ---------- */
  {
    name: 'The Whispering Forest',
    objective: 'Find the Lost Crystal!',
    theme: {
      grass: '#4ea64a', grassDark: '#3b8a3f', grassLight: '#6fc45a',
      path: '#d9b074', pathSpeck: '#c49a5c', pathEdge: '#a87b45',
      swap: null                                   // normal green trees
    },
    map: [
      'TTTTTTTTTTTTTTTTTTTTTTTT',
      'TT.f..TT...bT.TT..f...TT',
      'T..b.RT..f..T...T....XbT',
      'T.f..T.....RT..bT..f..TT',
      'T...RT..f....T..b.p.f..T',
      'T..b...TT...R.ppppp..T.T',
      'T.f...R..T..f.p...b..TTT',
      'T..TT...f..T..p..T..f..T',
      'T....R......T.p...R..b.T',
      'T..f..T..pppppp..T.....T',
      'T..O.T...p..R..f...T..bT',
      'T.SSS...Tp...T..b...f.TT',
      'TfSSSppppp..f...T...R..T',
      'T.SSS..b...T.....f...T.T',
      'TTTTTTTTTTTTTTTTTTTTTTTT'
    ],
    enemies: [
      { type: 'slime', col: 13, row: 12 },
      { type: 'slime', col: 12, row: 7 },
      { type: 'slime', col: 17, row: 8 },
      { type: 'slime', col: 19, row: 5 }
    ],
    items: [
      { type: 'sword',  col: 7,  row: 10 },
      { type: 'potion', col: 10, row: 6 }
    ]
  },

  /* ---------- LEVEL 2 ---------- */
  {
    name: 'The Autumn Glade',
    objective: 'Find the Autumn Crystal!',
    hazardEvery: 6,                              // a falling rock about every 6 seconds (0 = none)
    theme: {
      grass: '#b08d3c', grassDark: '#8f6f2b', grassLight: '#cfa94f',
      path: '#7b5a3a', pathSpeck: '#5a3d26', pathEdge: '#3f2a19',
      swap: { d: '#7a3b1d', g: '#c0562a', l: '#f2a03d' }       // orange autumn leaves
    },
    map: [
      'TTTTTTTTTTTTTTTTTTTTTTTT',
      'T.f....TT....T..R...TT.T',
      'T.X....bT..f..T....R..bT',
      'T...p...TT...f...T..f.TT',
      'TR..p..T..ppppppp..bT..T',
      'T.b.p.R.T.p....TT.f..R.T',
      'Tf..p..T.bp...R.....Tf.T',
      'T.T.p...Rfp..T...f...b.T',
      'T...ppppppp...T....R..bT',
      'T.b.....T.p.f...T...f..T',
      'T..T..R...p...f.....O..T',
      'T.b....T..p...R....SSS.T',
      'T.f.......pppppppppSSS.T',
      'T....T.b......T..f.SSS.T',
      'TTTTTTTTTTTTTTTTTTTTTTTT'
    ],
    enemies: [
      { type: 'slime', col: 13, row: 12 },
      { type: 'slime', col: 13, row: 8 },
      { type: 'slime', col: 14, row: 4 },
      { type: 'bat',   col: 6,  row: 6 },
      { type: 'bat',   col: 7,  row: 3 },
      { type: 'mage',  col: 17, row: 6 }         // NEW: a shooter!
    ],
    items: [
      { type: 'shield', col: 16, row: 4 },     // at the end of the side path
      { type: 'potion', col: 8,  row: 10 }
    ]
  },

  /* ---------- LEVEL 3 ---------- */
  {
    name: 'The Midnight Marsh',
    objective: 'Find the Midnight Crystal!',
    hazardEvery: 5,
    theme: {
      grass: '#34406e', grassDark: '#262f57', grassLight: '#46548f',
      path: '#6b6f85', pathSpeck: '#565a70', pathEdge: '#3d4054',
      swap: { d: '#2a1f4d', g: '#4b3a8a', l: '#7a63c4' }       // purple night trees
    },
    map: [
      'TTTTTTTTTTTTTTTTTTTTTTTT',
      'TSSS...bT....T..f...TR.T',
      'TSSSppppp.....T..f.R...T',
      'TSSS....p...p..Tb...f.TT',
      'T.O.T...p..Rp.T....T..bT',
      'Tf....R.p.T.p...f....R.T',
      'T..bT...p...p.T....b...T',
      'T.T.....ppppppppp...R..T',
      'T....R..p....T..p.f..b.T',
      'Tb....T.p..R...Tp...T..T',
      'T..f....p....R..p.....bT',
      'TR......p.T.T...p..f..RT',
      'T.b.....p......RpppppX.T',
      'T..T..R......T.f.....b.T',
      'TTTTTTTTTTTTTTTTTTTTTTTT'
    ],
    enemies: [
      { type: 'slime',    col: 8,  row: 10 },
      { type: 'skeleton', col: 10, row: 7 },
      { type: 'bat',      col: 12, row: 8 },
      { type: 'skeleton', col: 16, row: 9 },
      { type: 'bat',      col: 19, row: 11 },
      { type: 'skeleton', col: 18, row: 13 },
      { type: 'mage',     col: 17, row: 4 },
      { type: 'mage',     col: 6,  row: 11 }
    ],
    items: [
      { type: 'boots',      col: 8,  row: 12 },    // end of the south side path
      { type: 'magicSword', col: 12, row: 3 },     // end of the north side path
      { type: 'potion',     col: 14, row: 9 },
      { type: 'potion',     col: 19, row: 10 }
    ]
  }
];


// Levels 4 and 5 reuse the handcrafted map layouts with tougher enemy compositions
// and distinct late-game palettes, keeping every map fully playable.
LEVELS.push(
  {
    ...LEVELS[1],
    name: 'The Emberwood Ruins',
    objective: 'Find the Ember Crystal!',
    hazardEvery: 4.2,
    items: [                                     // (moved so nothing is inside a rock)
      { type: 'shield', col: 16, row: 4 },
      { type: 'potion', col: 8,  row: 9 }
    ],
    map: [
      'TTTTTTTTTTTTTTTTTTTTTTTT',
      'T......................T',
      'T.....R.....T.....R..X.T',
      'T..bb.R..f.....bb.R..p.T',
      'T.........pppppppppppp.T',
      'T..f..R..bp.T..........T',
      'T.....R...p.T...f.R....T',
      'T...b.R...p.......R.bb.T',
      'T...b.R...p.T.bb..R....T',
      'T.........p.T.....R....T',
      'T.OpppR.bbp.T..........T',
      'T.pppppppppp...f..R.bb.T',
      'T.SSSS..f...T..........T',
      'T......................T',
      'TTTTTTTTTTTTTTTTTTTTTTTT'
    ],
    theme: {
      grass: '#72513c', grassDark: '#52392f', grassLight: '#a36a42',
      path: '#c18b54', pathSpeck: '#9c633a', pathEdge: '#70452e',
      swap: { d: '#4f342d', g: '#9b4a2e', l: '#e58a3b' }
    },
    enemies: [
      { type: 'slime', col: 13, row: 12 }, { type: 'slime', col: 13, row: 8 },
      { type: 'slime', col: 14, row: 4 }, { type: 'bat', col: 5, row: 6 },
      { type: 'bat', col: 7, row: 3 }, { type: 'skeleton', col: 17, row: 8 },
      { type: 'skeleton', col: 19, row: 12 },
      { type: 'mage', col: 13, row: 2 }, { type: 'mage', col: 16, row: 11 }
    ]
  },
  {
    ...LEVELS[2],
    name: 'The Crystal Citadel',
    objective: 'Claim the Final Crystal!',
    hazardEvery: 3.4,
    items: [                                     // (moved so nothing is inside a rock)
      { type: 'boots',      col: 8,  row: 11 },
      { type: 'magicSword', col: 12, row: 2 },
      { type: 'potion',     col: 14, row: 9 },
      { type: 'potion',     col: 19, row: 10 }
    ],
    map: [
      'TTTTTTTTTTTTTTTTTTTTTTTT',
      'T......................T',
      'T.SSST....R....T....RX.T',
      'T.pppp.pb.R.bb.T.bpppp.T',
      'T.O..T.p..R.......p.R..T',
      'T..f.T.p....ppppp.p.R..T',
      'T....T.p..R.p..T.......T',
      'T....T.pb.R.p..T.f..R..T',
      'T......ppppppb.T..f.R..T',
      'T..f.T..f.R.........R..T',
      'T....T.........T.bb.R..T',
      'T..bbT....R.b..T.......T',
      'T.......b.R............T',
      'T......................T',
      'TTTTTTTTTTTTTTTTTTTTTTTT'
    ],
    theme: {
      grass: '#303b45', grassDark: '#202832', grassLight: '#526879',
      path: '#8c8796', pathSpeck: '#6d687a', pathEdge: '#494456',
      swap: { d: '#2a2540', g: '#51457c', l: '#a58be8' }
    },
    enemies: [
      { type: 'slime', col: 8, row: 10 }, { type: 'skeleton', col: 9, row: 7 },
      { type: 'bat', col: 12, row: 8 }, { type: 'skeleton', col: 16, row: 9 },
      { type: 'bat', col: 19, row: 11 }, { type: 'skeleton', col: 18, row: 13 },
      { type: 'skeleton', col: 4, row: 5 }, { type: 'bat', col: 14, row: 3 },
      { type: 'slime', col: 20, row: 6 },
      { type: 'mage', col: 11, row: 3 }, { type: 'mage', col: 17, row: 6 },
      { type: 'mage', col: 19, row: 9 }
    ]
  }
);

// Which map characters block movement?
const SOLID_TILES = ['T', 'R', 'b', 'X'];


/* ---------- THE BOSS ROOM (comes after level 5) ----------
   It uses the same kind of map as the other levels, so loadLevel() can load it.
   There is no chest or crystal here - just you and the boss!
   The rocks (R) are cover: bullets cannot fly through them.            */
const BOSS_LEVEL = {
  isBoss: true,
  name: 'The Alien Mothership',
  objective: 'Defeat Zorgon, the Alien Overlord!',
  hazardEvery: 4.5,
  theme: {
    grass: '#1b1838', grassDark: '#141230', grassLight: '#2a2552',
    path: '#3b3560', pathSpeck: '#2c2750', pathEdge: '#1b1838',
    swap: { d: '#0f4a4a', g: '#1f9a8a', l: '#6ff0c8' }          // glowing alien plants
  },
  map: [
    'TTTTTTTTTTTTTTTTTTTTTTTT',
    'T......................T',
    'T......................T',
    'T..R................R..T',
    'T......................T',
    'T......................T',
    'T.....R..........R.....T',
    'T......................T',
    'T......................T',
    'T.....R..........R.....T',
    'T......................T',
    'T......................T',
    'T.........SSSS.........T',
    'T.........SSSS.........T',
    'TTTTTTTTTTTTTTTTTTTTTTTT'
  ],
  enemies: [],
  items: [
    { type: 'potion', col: 2,  row: 12 },
    { type: 'potion', col: 21, row: 12 }
  ]
};

// Boss settings. Want an easier or harder fight? Change the numbers here!
const BOSS_DATA = {
  name: 'ZORGON, THE ALIEN OVERLORD',
  hp: 40,              // health. The Iron Sword (damage 2) needs 20 hits.
  size: 128,           // the boss is drawn 128 x 128 pixels - huge compared to the 40 px hero
  homeY: 92,           // how far from the top of the screen it hovers
  intro: 2.4,          // seconds of "entrance" at the start of the fight (it can't be hurt yet)
  contactDamage: 2,    // damage if you touch it
  shotDamage: 1,
  maxMinions: 4        // never more than this many mini aliens alive at once
};

// Normal levels live in the LEVELS list. The boss room is "level number 6".
function getLevel(index) {
  return index >= LEVELS.length ? BOSS_LEVEL : LEVELS[index];
}
function isBossRoom() {
  return levelIndex >= LEVELS.length;
}


/* =========================================================
   4. PIXEL-ART SPRITES
   Every sprite is 10 x 10 art pixels. Each letter is a colour from
   PALETTE above ('.' means transparent). We turn the text into a tiny
   hidden canvas once, then draw that canvas quickly every frame.
   ========================================================= */

// Scenery sprites: these get re-coloured for each level (autumn, night...)
const SCENERY_ART = {
  tree: [
    '...kkkk...',
    '..kllggk..',
    '.kllgggdk.',
    'kllgggdddk',
    'kgggdddddk',
    'kggddddddk',
    '.kddddddk.',
    '..kkbbkk..',
    '...knbk...',
    '..knnbbk..'
  ],
  rock: [
    '..........',
    '..........',
    '...kkkk...',
    '..kwwssk..',
    '.kwwsssak.',
    '.kwssssak.',
    'kwsssssaak',
    'ksssssaaak',
    'kkaaaaaakk',
    '.kkkkkkkk.'
  ],
  bush: [
    '..........',
    '..........',
    '..kkkkkk..',
    '.kllgglgk.',
    'kllgggggdk',
    'kgglgrgddk',
    'kggggdddkk',
    'kgdddddddk',
    '.kkddddkk.',
    '..kkkkkk..'
  ],
  flower: [
    '..........',
    '..........',
    '..........',
    '...p...h..',
    '..pyp.hyh.',
    '...p...h..',
    '...g...g..',
    '...g...g..',
    '..........',
    '..........'
  ]
};

// Sprites that keep the same colours in every level.
const FIXED_ART = {
  chestClosed: [
    '..........',
    '..........',
    '..kkkkkk..',
    '.kbbbbbbk.',
    'kbbnnnnbbk',
    'kkkkyykkkk',
    'kbbbyybbbk',
    'kbnbbbbnbk',
    'kbbbbbbbbk',
    'kkkkkkkkkk'
  ],
  chestOpen: [
    '..........',
    '..........',
    '.kkkkkkkk.',
    'kbbbbbbbbk',
    'kbbnnnnbbk',
    'kkkkkkkkkk',
    'kaaaaaaaak',
    'kbbbyybbbk',
    'kbbbbbbbbk',
    'kkkkkkkkkk'
  ],
  crystal: [
    '....kk....',
    '...kCCk...',
    '..kCCcck..',
    '.kCCcccck.',
    'kCcccccvvk',
    'kccccccvvk',
    '.kccccvvk.',
    '..kcccvk..',
    '...kcvk...',
    '....kk....'
  ],
  heart: [
    '..........',
    '.kkk..kkk.',
    'kpprkkrrrk',
    'kpprrrrrrk',
    'krrrrrrrrk',
    '.krrrrrrk.',
    '..krrrrk..',
    '...krrk...',
    '....kk....',
    '..........'
  ],
  potion: [
    '...kkkk...',
    '...kbbk...',
    '....kk....',
    '...khhk...',
    '..khhhhk..',
    '.kprrrrrk.',
    '.kprrrrrk.',
    '.krrrrrrk.',
    '..krrrrk..',
    '...kkkk...'
  ],
  // ----- equipment icons (also used on the ground and in the HUD) -----
  stick: [
    '....kk....',
    '...kbbk...',
    '...kbbk...',
    '...kbbk...',
    '...kbbk...',
    '...kbbk...',
    '...kbbk...',
    '...kbbk...',
    '...knnk...',
    '....kk....'
  ],
  sword: [
    '....kk....',
    '...kwwk...',
    '...kwwk...',
    '...kwwk...',
    '...kwwk...',
    '...kwwk...',
    '.kyyyyyyk.',
    '..kkbbkk..',
    '...kbbk...',
    '...kkkk...'
  ],
  magicSword: [
    '....kk....',
    '...kCck...',
    '...kCck...',
    '...kCck...',
    '...kCck...',
    '...kCck...',
    '.kvvvvvvk.',
    '..kkbbkk..',
    '...kbbk...',
    '...kkkk...'
  ],
  shield: [
    '.kkkkkkkk.',
    'kwwssssssk',
    'kwssrrsssk',
    'ksssrrsssk',
    'kssrrrrssk',
    'ksssrrsssk',
    '.kssrrssk.',
    '..kssssk..',
    '...kssk...',
    '....kk....'
  ],
  boots: [
    '..........',
    '..........',
    '..kyyk....',
    '..krrk....',
    '..krrk....',
    '..krrkkk..',
    '..krrrrrk.',
    '..krrrrrrk',
    '..kkkkkkkk',
    '..........'
  ],
  // ----- the portal (two frames that flicker) -----
  portalA: [
    '...kkkk...',
    '..kvvvvk..',
    '.kvccccvk.',
    'kvcCCCCcvk',
    'kvcChhCcvk',
    'kvcChhCcvk',
    'kvcCCCCcvk',
    '.kvccccvk.',
    '..kvvvvk..',
    '...kkkk...'
  ],
  portalB: [
    '...kkkk...',
    '..kvvvvk..',
    '.kvccccvk.',
    'kvchhhhcvk',
    'kvchCChcvk',
    'kvchCChcvk',
    'kvchhhhcvk',
    '.kvccccvk.',
    '..kvvvvk..',
    '...kkkk...'
  ]
};

// Monsters. Slimes and skeletons use one picture (we squash / bob it).
// Bats have two pictures: wings up and wings down.
const ENEMY_ART = {
  slime: [
    '..........',
    '..........',
    '...kkkk...',
    '..kpprrk..',
    '.kpprrrrrk',
    'kpprrrrrrk',
    'krhkrrhkrk',
    'krrrrrrrnk',
    'knnnnnnnnk',
    '.kkkkkkkk.'
  ],
  skeleton: [
    '...kkkk...',
    '..khhhhk..',
    '.khhhhhhk.',
    '.khrhhrhk.',
    '..khkkhk..',
    '.kkhhhhkk.',
    'kshkhhkhsk',
    '.kshhhhsk.',
    '..khkkhk..',
    '..kkk.kkk.'
  ],
  batUp: [
    '..........',
    'kk......kk',
    'kvk.kk.kvk',
    'kvvkvvkvvk',
    '.kvkyvykvk',
    '..kkvvkk..',
    '...kvvk...',
    '....kk....',
    '..........',
    '..........'
  ],
  batDown: [
    '..........',
    '..........',
    '....kk....',
    '..kkvvkk..',
    '.kvkyvykvk',
    'kvvkvvkvvk',
    'kvk.kk.kvk',
    'kk......kk',
    '..........',
    '..........'
  ],
  // NEW: the Dark Mage (shoots magic bolts). The blue eyes glow.
  mage: [
    '...kkkk...',
    '..kaaaak..',
    '.kaaaaaak.',
    '.kakkkkak.',
    '.kackkcak.',
    '..kaaaak..',
    '.kaaccaak.',
    'kaaaaaaaak',
    'kaaaaaaaak',
    '.kkkkkkkk.'
  ],
  // NEW: a little alien (the boss summons these)
  alien: [
    '.k......k.',
    '.yk....ky.',
    '..kkkkkk..',
    '.kllllllk.',
    'klkkllkklk',
    'klhkllkhlk',
    '.kllkkllk.',
    '..kkllkk..',
    '.kgk..kgk.',
    '.kk....kk.'
  ]
};

// NEW: the BOSS. It is 16 x 16 art pixels (the other sprites are 10 x 10).
// To save typing we only write the LEFT half. The code mirrors it to make
// the right half, so the boss is always perfectly symmetrical.
const BOSS_HALF = [
  '.yy.....',   // antenna ball
  '..k.....',   // antenna
  '...kkkkk',   // top of the head
  '..kllllg',
  '.kllgggg',
  '.klggggg',
  'klkkkkkg',   // eyes
  'klkhhhkg',
  'klkhrrkg',
  'klkhrrkg',
  '.kkkkkkg',
  '.kggkkkk',   // mouth
  '..kgkrrr',
  '..kdgkkk',
  '..kgggdd',   // body
  '.kgk.kgd'    // tentacles
];
const BOSS_ART = BOSS_HALF.map(row => row + row.split('').reverse().join(''));

// The hero. Body = top 8 rows. Legs = bottom 2 rows (two frames for walking).
const PLAYER_BODY = {
  down: [
    '...kkkk...',
    '..krrrrk..',
    '.krrrrrrk.',
    '.kffffffk.',
    '.kfkffkfk.',
    '..kffffk..',
    '.kyyyyyyk.',
    '.kybbbbyk.'
  ],
  up: [
    '...kkkk...',
    '..krrrrk..',
    '.krrrrrrk.',
    '.krrrrrrk.',
    '.knnnnnnk.',
    '..knnnnk..',
    '.kyyyyyyk.',
    '.kyyyyyyk.'
  ],
  right: [
    '...kkkk...',
    '..krrrrk..',
    '.krrrrrrrk',
    '.kffffffk.',
    '.kfffkffk.',
    '..kffffk..',
    '.kyyyyyyk.',
    '.kybbbbyk.'
  ]
};

const PLAYER_LEGS = [
  ['..kn..nk..', '..kk..kk..'],   // feet apart
  ['...knnk...', '...kkkk...']    // feet together
];

// Turn a list of text rows into a small canvas image.
//   flip      - mirror left-to-right (used for walking left)
//   tint      - if given, every coloured pixel becomes this colour (used for the white "hit flash")
//   overrides - optional {letter: colour} to re-colour parts (used for autumn / night trees)
function makeSprite(art, flip, tint, overrides) {
  const c = document.createElement('canvas');
  c.width = art[0].length * PIXEL;       // sprites are normally 10 x 10 art pixels (the boss is 16 x 16)
  c.height = art.length * PIXEL;
  const g = c.getContext('2d');
  for (let y = 0; y < art.length; y++) {
    const row = flip ? art[y].split('').reverse().join('') : art[y];
    for (let x = 0; x < row.length; x++) {
      const letter = row[x];
      if (letter === '.') continue;                       // '.' = transparent
      let colour = PALETTE[letter];
      if (overrides && overrides[letter]) colour = overrides[letter];
      if (tint) colour = tint;
      g.fillStyle = colour;
      g.fillRect(x * PIXEL, y * PIXEL, PIXEL, PIXEL);
    }
  }
  return c;
}

// ----- Build the sprites that never change (once, when the page loads) -----
const sprites = {};                    // everything we draw by name
for (const name in FIXED_ART) sprites[name] = makeSprite(FIXED_ART[name], false);
for (const name in ENEMY_ART) sprites[name] = makeSprite(ENEMY_ART[name], false);

// White copies of the monsters, shown for a split second when they are hit.
const flashSprites = {};
for (const name in ENEMY_ART) flashSprites[name] = makeSprite(ENEMY_ART[name], false, '#ffffff');

// The boss and its white "I got hit" copy
sprites.boss = makeSprite(BOSS_ART, false);
flashSprites.boss = makeSprite(BOSS_ART, false, '#ffffff');

const playerSprites = {
  down:  PLAYER_LEGS.map(legs => makeSprite(PLAYER_BODY.down.concat(legs), false)),
  up:    PLAYER_LEGS.map(legs => makeSprite(PLAYER_BODY.up.concat(legs), false)),
  right: PLAYER_LEGS.map(legs => makeSprite(PLAYER_BODY.right.concat(legs), false)),
  left:  PLAYER_LEGS.map(legs => makeSprite(PLAYER_BODY.right.concat(legs), true))
};

// ----- Scenery sprites are rebuilt for each level so they match its colours -----
function buildSceneSprites(theme) {
  for (const name in SCENERY_ART) {
    sprites[name] = makeSprite(SCENERY_ART[name], false, null, theme.swap);
  }
}


/* =========================================================
   5. LOADING A LEVEL
   These variables describe the level that is currently loaded.
   loadLevel() fills them in from the LEVELS list.
   ========================================================= */
let levelIndex = 0;
let difficulty = 'medium';
let audioVolume = 0.7, sfxVolume = 0.8, sfxEnabled = true;
let characterStyle = { gender:'male', hair:'brown', skin:'#f2c6a0', clothes:'#3977d5', accessory:'none' };
let nearChest = false, chestOpened = false;
let powerTimers = { speed:0, attack:0, invisibility:0, rotatingSword:0 };
const DIFFICULTIES = { easy: { hp: 0.75, count: 0.75, ambush: 0.75, damage: 0.75 }, medium: { hp: 1, count: 1, ambush: 1, damage: 1 }, hard: { hp: 1.45, count: 1.4, ambush: 1.4, damage: 1.3 }, insane: { hp: 2.1, count: 1.9, ambush: 2, damage: 1.7 } };
function difficultySettings() { return DIFFICULTIES[difficulty] || DIFFICULTIES.medium; }
let crystalSpots = [];
let crystalsCollected = 0;
let crystalsRequired = 3;
let MAP = LEVELS[0].map;
let theme = LEVELS[0].theme;
let chestTile = { col: 0, row: 0 };                       // where the chest is
let portalTile = { col: 0, row: 0 };                      // where the portal will appear
const startZone = { x1: 0, y1: 0, x2: 0, y2: 0 };         // pixel rectangle of the start pad
let crystalX = 0, crystalY = 0;                           // centre of the chest (pixels)
let portalX = 0, portalY = 0;                             // centre of the portal (pixels)
let SPAWN_X = 0, SPAWN_Y = 0;                             // where the player starts

let sceneObjects = [];     // trees, rocks, bushes and the chest
let enemies = [];          // the monsters alive in this level
let pickups = [];          // items lying on the ground
let projectiles = [];      // NEW: magic bolts and boss bullets flying through the air
let hazards = [];          // NEW: falling-rock danger zones
let hazardTimer = 0;       // NEW: countdown until the next falling rock
let boss = null;           // NEW: the alien boss (only exists in the boss room)

// Ground layer: drawn ONCE onto a hidden canvas, then copied every frame (fast!).
const bgCanvas = document.createElement('canvas');
bgCanvas.width = WIDTH;
bgCanvas.height = HEIGHT;

// A tiny repeatable "random" number from tile position, so the grass
// speckles look random but are the same every time.
function tileRandom(col, row, i) {
  let h = Math.imul(col + 1, 374761393) ^ Math.imul(row + 1, 668265263) ^ Math.imul(i + 1, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

function tileAt(col, row) {
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return ' ';
  return MAP[row][col];
}

function drawGrassTile(g, col, row) {
  const x = col * TILE, y = row * TILE;
  g.fillStyle = theme.grass;
  g.fillRect(x, y, TILE, TILE);
  for (let i = 0; i < 3; i++) {                    // three little speckles
    const px = Math.floor(tileRandom(col, row, i) * 9) * PIXEL;
    const py = Math.floor(tileRandom(col, row, i + 10) * 9) * PIXEL;
    g.fillStyle = (i % 2 === 0) ? theme.grassDark : theme.grassLight;
    g.fillRect(x + px, y + py, PIXEL, PIXEL);
  }
}

function drawPathTile(g, col, row) {
  const x = col * TILE, y = row * TILE;
  g.fillStyle = theme.path;
  g.fillRect(x, y, TILE, TILE);
  g.fillStyle = theme.pathSpeck;                   // pebbles
  for (let i = 0; i < 3; i++) {
    const px = Math.floor(tileRandom(col, row, i + 20) * 8) * PIXEL;
    const py = Math.floor(tileRandom(col, row, i + 30) * 8) * PIXEL;
    g.fillRect(x + px + PIXEL, y + py + PIXEL, PIXEL, PIXEL);
  }
  // Darker edge wherever the path touches grass
  const isPath = (c, r) => tileAt(c, r) === 'p' || tileAt(c, r) === 'S';
  g.fillStyle = theme.pathEdge;
  if (!isPath(col, row - 1)) g.fillRect(x, y, TILE, PIXEL);
  if (!isPath(col, row + 1)) g.fillRect(x, y + TILE - PIXEL, TILE, PIXEL);
  if (!isPath(col - 1, row)) g.fillRect(x, y, PIXEL, TILE);
  if (!isPath(col + 1, row)) g.fillRect(x + TILE - PIXEL, y, PIXEL, TILE);
}

function drawPadTile(g, col, row) {
  const x = col * TILE, y = row * TILE;
  g.fillStyle = PALETTE.a;                         // dark gaps between the stones
  g.fillRect(x, y, TILE, TILE);
  g.fillStyle = PALETTE.s;                         // the stone slab
  g.fillRect(x + PIXEL, y + PIXEL, TILE - 2 * PIXEL, TILE - 2 * PIXEL);
  g.fillStyle = PALETTE.w;                         // a light highlight on top
  g.fillRect(x + PIXEL, y + PIXEL, TILE - 3 * PIXEL, PIXEL);
}

function buildBackground() {
  const g = bgCanvas.getContext('2d');
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const ch = MAP[row][col];
      if (ch === 'p') drawPathTile(g, col, row);
      else if (ch === 'S') drawPadTile(g, col, row);
      else drawGrassTile(g, col, row);
      if (ch === 'f') g.drawImage(sprites.flower, col * TILE, row * TILE);
    }
  }

  // The boss room has no "START" label - just a glowing grid, like a spaceship floor.
  if (isBossRoom()) {
    g.strokeStyle = 'rgba(111, 240, 200, 0.10)';
    g.lineWidth = 2;
    for (let i = 1; i < COLS; i++) { g.beginPath(); g.moveTo(i * TILE, 0); g.lineTo(i * TILE, HEIGHT); g.stroke(); }
    for (let i = 1; i < ROWS; i++) { g.beginPath(); g.moveTo(0, i * TILE); g.lineTo(WIDTH, i * TILE); g.stroke(); }
    return;
  }

  // A yellow cross in the middle of the start pad, plus a "START" label
  const midX = (startZone.x1 + startZone.x2) / 2;
  const midY = (startZone.y1 + startZone.y2) / 2;
  const ex = midX - TILE / 2, ey = midY - TILE / 2;
  g.fillStyle = PALETTE.y;
  g.fillRect(ex + 4 * PIXEL, ey + PIXEL, 2 * PIXEL, 8 * PIXEL);
  g.fillRect(ex + PIXEL, ey + 4 * PIXEL, 8 * PIXEL, 2 * PIXEL);
  g.fillStyle = PALETTE.r;
  g.fillRect(ex + 4 * PIXEL, ey + 4 * PIXEL, 2 * PIXEL, 2 * PIXEL);

  g.font = 'bold 14px monospace';
  g.textAlign = 'center';
  g.fillStyle = PALETTE.k;
  g.fillText('START', midX + 1, startZone.y2 - 5);
  g.fillStyle = PALETTE.h;
  g.fillText('START', midX, startZone.y2 - 6);
}

// Make one monster. Every monster (level monsters, ambush monsters, mini aliens)
// is created here, so they all have the same properties.
function createEnemy(typeName, x, y, hp) {
  const type = ENEMY_TYPES[typeName];
  const startHp = Math.max(1, Math.ceil((hp || type.hp) * difficultySettings().hp));
  return {
    type: typeName,
    x: x, y: y,
    hp: startHp, maxHp: startHp,
    anim: Math.random() * 5,          // makes each monster animate out of sync
    dirX: 0, dirY: 0,                 // wander direction
    wanderTimer: Math.random(),       // time until it picks a new direction
    hitFlash: 0,                      // white flash timer
    kbX: 0, kbY: 0, kbTimer: 0,       // knockback after being hit
    shootTimer: 1.2 + Math.random() * 1.5,   // shooters: seconds until the next shot
    charging: false,                  // shooters glow just before they fire
    strafe: Math.random() < 0.5 ? 1 : -1     // shooters: which way they sidestep
  };
}

// Read a level's data, build its scenery, and place the monsters and items.
function loadLevel(index) {
  levelIndex = index;
  const level = getLevel(index);
  MAP = level.map;
  theme = level.theme;

  // 1. Find the important places in the map
  startZone.x1 = 9999; startZone.y1 = 9999; startZone.x2 = 0; startZone.y2 = 0;
  chestTile = { col: -5, row: -5 };          // the boss room has no chest and no portal,
  chestOpened = false; nearChest = false;
  powerTimers = { speed:0, attack:0, invisibility:0, rotatingSword:0 };
  portalTile = { col: -5, row: -5 };         // so park them off-screen
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const ch = MAP[row][col];
      if (ch === 'X') chestTile = { col: col, row: row };
      if (ch === 'O') portalTile = { col: col, row: row };
      if (ch === 'S') {
        startZone.x1 = Math.min(startZone.x1, col * TILE);
        startZone.y1 = Math.min(startZone.y1, row * TILE);
        startZone.x2 = Math.max(startZone.x2, (col + 1) * TILE);
        startZone.y2 = Math.max(startZone.y2, (row + 1) * TILE);
      }
    }
  }
  crystalX = chestTile.col * TILE + TILE / 2;
  crystalY = chestTile.row * TILE + TILE / 2;
  portalX = portalTile.col * TILE + TILE / 2;
  portalY = portalTile.row * TILE + TILE / 2;
  SPAWN_X = (startZone.x1 + startZone.x2) / 2 - PLAYER_SIZE / 2;
  SPAWN_Y = (startZone.y1 + startZone.y2) / 2 - PLAYER_SIZE / 2;

  // Scatter the required crystals across walkable tiles, away from the start pad.
  crystalsRequired = [3, 5, 7, 9, 11][Math.min(index, 4)] || 3;
  crystalsCollected = 0;
  crystalSpots = [];
  const crystalCandidates = [];
  for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) {
    if (SOLID_TILES.includes(MAP[r][c]) || MAP[r][c] === 'X' || MAP[r][c] === 'O' || MAP[r][c] === 'S') continue;
    const x = c * TILE + TILE / 2, y = r * TILE + TILE / 2;
    const inStart = x >= startZone.x1 - TILE && x <= startZone.x2 + TILE && y >= startZone.y1 - TILE && y <= startZone.y2 + TILE;
    if (!inStart) crystalCandidates.push({ x, y, collected: false });
  }
  // Shuffle candidates so each run spreads the crystals around the map.
  for (let i = crystalCandidates.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [crystalCandidates[i], crystalCandidates[j]] = [crystalCandidates[j], crystalCandidates[i]]; }
  const chosen = [];
  for (const spot of crystalCandidates) {
    if (chosen.every(other => Math.hypot(other.x - spot.x, other.y - spot.y) >= TILE * 2.2)) chosen.push(spot);
    if (chosen.length >= crystalsRequired) break;
  }
  // On unusually crowded maps, fill any remaining slots with available candidates.
  for (const spot of crystalCandidates) { if (chosen.length >= crystalsRequired) break; if (!chosen.includes(spot)) chosen.push(spot); }
  crystalSpots = chosen;
  if (crystalSpots.length) { crystalX = crystalSpots[0].x; crystalY = crystalSpots[0].y; }

  // 2. Colours, ground and solid objects (trees, rocks, bushes, chest)
  buildSceneSprites(theme);
  buildBackground();
  sceneObjects = [];
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const ch = MAP[row][col];
      let type = null;
      if (ch === 'T') type = 'tree';
      else if (ch === 'R') type = 'rock';
      else if (ch === 'b') type = 'bush';
      else if (ch === 'X') type = 'chest';
      if (type) {
        sceneObjects.push({ type: type, x: col * TILE, y: row * TILE, sortY: (row + 1) * TILE });
      }
    }
  }
  // Objects higher up the screen come first, so lower ones are drawn on top.
  sceneObjects.sort((a, b) => a.sortY - b.sortY);

  // 3. Monsters
  const baseEnemies = level.enemies;
  const extraCount = Math.max(0, Math.round(baseEnemies.length * (difficultySettings().count - 1)));
  enemies = baseEnemies.map(function (e) {
    return createEnemy(e.type,
                       e.col * TILE + (TILE - PLAYER_SIZE) / 2,
                       e.row * TILE + (TILE - PLAYER_SIZE) / 2);
  });
  // Higher difficulties add extra monsters at safe, walkable map locations.
  if (extraCount > 0) {
    const openTiles = [];
    for (let r = 1; r < ROWS - 1; r++) for (let c = 1; c < COLS - 1; c++) {
      if (!SOLID_TILES.includes(MAP[r][c]) && !['X','O','S'].includes(MAP[r][c])) openTiles.push({c,r});
    }
    for (let i = 0; i < extraCount && openTiles.length; i++) {
      const tile = openTiles.splice(Math.floor(Math.random() * openTiles.length), 1)[0];
      const types = ['slime','bat','skeleton','mage'];
      const type = types[Math.min(types.length - 1, Math.floor(Math.random() * (difficulty === 'insane' ? 4 : 3)))];
      enemies.push(createEnemy(type, tile.c * TILE + (TILE - PLAYER_SIZE) / 2, tile.r * TILE + (TILE - PLAYER_SIZE) / 2));
    }
  }

  // 4. Items on the ground
  pickups = level.items.map(function (item) {
    return { type: item.type, x: item.col * TILE + TILE / 2, y: item.row * TILE + TILE / 2, bob: Math.random() * 6 };
  });

  // 5. Bullets, falling rocks and the boss start fresh in every level
  projectiles = [];
  hazards = [];
  hazardTimer = (level.hazardEvery || 0) + 1;      // the first rock never comes straight away
  boss = level.isBoss ? createBoss() : null;
}


/* =========================================================
   6. GAME STATE
   ========================================================= */
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;       // keep the pixels sharp

// Page elements we update
const startScreen = document.getElementById('startScreen');
const winScreen = document.getElementById('winScreen');
const loseScreen = document.getElementById('loseScreen');
const levelText = document.getElementById('levelText');
const objectiveText = document.getElementById('objectiveText');
const messageText = document.getElementById('messageText');
const finalTime = document.getElementById('finalTime');
const finalKills = document.getElementById('finalKills');

// 'menu' = start screen, 'playing' = game running, 'transition' = fading between maps,
// 'bossDying' = the boss is exploding, 'won' = victory screen, 'lost' = game over screen
let state = 'menu';

// The hero
const player = {
  x: 0, y: 0,
  hp: MAX_HP,
  invuln: 0,                         // seconds of "can't be hurt" left
  kbX: 0, kbY: 0, kbTimer: 0,        // knockback after being hit
  attackTimer: 0,                    // > 0 while the sword is swinging
  cooldown: 0                        // > 0 while waiting to swing again
};
let facing = 'down';                 // 'up', 'down', 'left' or 'right'
let isMoving = false;
let walkTimer = 0;                   // counts up while walking (drives the walk animation)

// What the hero is wearing. Gear is kept when you travel through a portal.
let equipment = { weapon: 'stick', shield: null, boots: null };
let equipmentAtLevelStart = { weapon: 'stick', shield: null, boots: null };   // used by "Try Again"
let attackHits = [];                 // monsters already hit by the current swing

// Goals
let crystalWaveSpawned = false;       // extra ambush happens once per level
let hasCrystal = false;              // carrying the crystal?
let crystalDelivered = false;        // brought it back to the start pad?
let nearCrystal = false;             // close enough to take it?
let portalActive = false;            // is the portal open?
let portalAge = 0;                   // seconds since the portal opened

// Timing and score
let startTime = 0;                   // when the whole run began (ms)
let levelStartTime = 0;              // when the current level began (ms)
let elapsed = 0;                     // seconds since the run began
let kills = 0;                       // monsters defeated

// Effects
let particles = [];                  // sparkle bits
let flashTimer = 0;                  // white screen flash
const FLASH_TIME = 0.35;
let bossDeathTimer = 0;              // NEW: how long the boss explosion lasts
let bossBurstTimer = 0;              // NEW: time until the next little explosion
let fireworkTimer = 0;               // NEW: fireworks on the victory screen
let hurtTimer = 0;                   // red screen flash when the hero is hit
let toastText = '';                  // short pop-up message (like "Equipped Iron Sword!")
let toastTimer = 0;
let bannerTimer = 0;                 // big "Level 2" title at the start of a level
let bannerTitle = '';
let bannerSub = '';

// Fade between maps
let transitionPhase = 'out';         // 'out' = fading to black, 'in' = fading back
let transitionTimer = 0;
const FADE_TIME = 0.6;

let lastMessage = '';                // remembers the last message so we only update the page when it changes

const MESSAGES = {
  explore: 'Follow the winding path. Press SPACE to fight monsters!',
  hint: 'Hint: the crystal chest is far from the start. Keep exploring...',
  near: 'The crystal glows brightly! Press E to take it.',
  carry: 'You have the crystal! Hurry back to the stone pad.',
  portal: 'A portal opened near the start pad! Step into it.',
  finalPortal: 'The final portal is open... something BIG is waiting inside. Step in!',
  boss: 'Dodge the bullets and red circles. Hit Zorgon with SPACE and beat his mini aliens!'
};

// Which "enter the portal" message fits this level?
function portalMessage() {
  return levelIndex === LEVELS.length - 1 ? MESSAGES.finalPortal : MESSAGES.portal;
}


/* =========================================================
   7. SOUND EFFECTS (Web Audio API)
   We make beeps with an oscillator - no sound files needed.
   Browsers only allow sound after the player clicks something,
   so the audio is created when the Play button is pressed.
   ========================================================= */
let audioCtx = null;

function initAudio() {
  try {
    if (!audioCtx) {
      const AudioClass = window.AudioContext || window.webkitAudioContext;
      if (AudioClass) audioCtx = new AudioClass();
    }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
  } catch (error) {
    audioCtx = null;      // no sound is fine - the game still works
  }
}

// Play one beep: frequency (pitch), delay in seconds, length in seconds
function playTone(frequency, delay, duration, type, volume) {
  if (!audioCtx || !sfxEnabled) return;
  const t = audioCtx.currentTime + delay;
  const oscillator = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  oscillator.type = type || 'square';                       // square = retro 8-bit sound
  oscillator.frequency.setValueAtTime(frequency, t);
  gain.gain.setValueAtTime((volume || 0.07) * audioVolume * sfxVolume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);   // fade out
  oscillator.connect(gain);
  gain.connect(audioCtx.destination);
  oscillator.start(t);
  oscillator.stop(t + duration);
}

function playCollectSound() { [523, 659, 784, 1047].forEach((n, i) => playTone(n, i * 0.08, 0.2)); }
function playWinSound()     { [523, 659, 784, 1047, 784, 1047, 1319].forEach((n, i) => playTone(n, i * 0.12, 0.25)); }
function playSwingSound()   { playTone(300, 0, 0.08, 'sawtooth', 0.04); }
function playHitSound()     { playTone(180, 0, 0.1, 'square', 0.08); }
function playKillSound()    { playTone(400, 0, 0.07); playTone(250, 0.07, 0.1); }
function playHurtSound()    { playTone(160, 0, 0.18, 'sawtooth', 0.09); playTone(110, 0.1, 0.2, 'sawtooth', 0.09); }
function playPickupSound()  { playTone(660, 0, 0.09); playTone(880, 0.09, 0.14); }
function playPortalOpenSound() { [330, 440, 554, 659, 880].forEach((n, i) => playTone(n, i * 0.09, 0.3, 'triangle', 0.09)); }
function playPortalEnterSound() { [880, 659, 554, 440, 330].forEach((n, i) => playTone(n, i * 0.07, 0.25, 'triangle', 0.09)); }
function playLoseSound()    { [392, 330, 262, 196].forEach((n, i) => playTone(n, i * 0.18, 0.3, 'square', 0.07)); }
function playShootSound()   { playTone(520, 0, 0.07, 'square', 0.04); playTone(340, 0.05, 0.08, 'square', 0.04); }
function playBossShootSound() { playTone(210, 0, 0.12, 'sawtooth', 0.07); playTone(150, 0.06, 0.14, 'sawtooth', 0.06); }
function playDeflectSound() { playTone(900, 0, 0.05, 'square', 0.04); }
function playRockSound()    { playTone(90, 0, 0.22, 'sawtooth', 0.1); playTone(60, 0.05, 0.2, 'square', 0.08); }
function playSummonSound()  { [300, 380, 460, 560].forEach((n, i) => playTone(n, i * 0.07, 0.16, 'triangle', 0.08)); }
function playBossRoarSound() { [180, 140, 110, 90].forEach((n, i) => playTone(n, i * 0.1, 0.25, 'sawtooth', 0.09)); }
function playBossDieSound() { for (let i = 0; i < 10; i++) playTone(400 - i * 30, i * 0.14, 0.2, 'sawtooth', 0.08); }
function playVictorySound() { [523, 659, 784, 1047, 1319, 1047, 1319, 1568].forEach((n, i) => playTone(n, i * 0.13, 0.28)); }


/* =========================================================
   8. KEYBOARD INPUT
   We remember which keys are held down in a Set.
   ========================================================= */
const keysDown = new Set();

const GAME_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
const ATTACK_KEYS = ['Space', 'KeyJ'];

window.addEventListener('keydown', function (event) {
  if (GAME_KEYS.includes(event.code)) {
    keysDown.add(event.code);
    event.preventDefault();                 // stop the arrow keys from scrolling the page
  } else if (ATTACK_KEYS.includes(event.code)) {
    keysDown.add(event.code);
    if (state === 'playing') event.preventDefault();   // stop Space from scrolling the page
  } else if (event.code === 'KeyE' && !event.repeat) {
    interact();                             // E was pressed once
  }
});

window.addEventListener('keyup', function (event) {
  keysDown.delete(event.code);
});

// If the browser window loses focus, forget held keys (avoids "stuck" movement)
window.addEventListener('blur', function () {
  keysDown.clear();
});

// Is any of these keys held down?
function anyDown(codes) {
  return codes.some(code => keysDown.has(code));
}


/* =========================================================
   9. COLLISION DETECTION
   The hero and every monster are 24 x 24 boxes. A box is smaller than a
   40 x 40 tile, so checking its four corners is enough to know if it
   touches a solid tile.
   ========================================================= */

// Is this single pixel inside a solid tile (or outside the map)?
function isSolidAt(px, py) {
  const col = Math.floor(px / TILE);
  const row = Math.floor(py / TILE);
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return true;   // outside the map
  return SOLID_TILES.includes(MAP[row][col]);
}

// Would a box at (x, y) overlap anything solid?
function collides(x, y) {
  const right = x + PLAYER_SIZE - 1;
  const bottom = y + PLAYER_SIZE - 1;
  return isSolidAt(x, y) || isSolidAt(right, y) ||
         isSolidAt(x, bottom) || isSolidAt(right, bottom);
}

// Move any box (hero or monster), checking X and Y separately.
// Doing it separately lets things slide along walls instead of getting stuck.
function moveBox(box, moveX, moveY) {
  if (!collides(box.x + moveX, box.y)) box.x += moveX;
  if (!collides(box.x, box.y + moveY)) box.y += moveY;
}

// Do two rectangles overlap?
function overlaps(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}


/* =========================================================
   10. UPDATE (game logic, runs every frame)
   dt = "delta time" = seconds since the last frame. Multiplying speed by dt
   makes the game run at the same speed on slow and fast computers.
   ========================================================= */
function update(dt) {
  updateParticles(dt);
  if (flashTimer > 0) flashTimer -= dt;
  if (hurtTimer > 0) hurtTimer -= dt;
  if (toastTimer > 0) toastTimer -= dt;
  for (const key of Object.keys(powerTimers)) powerTimers[key] = Math.max(0, powerTimers[key] - dt);

  if (state === 'transition') { updateTransition(dt); return; }
  if (state === 'bossDying') { updateBossDeath(dt); return; }
  if (state === 'won') { updateFireworks(dt); return; }
  if (state !== 'playing') return;

  if (bannerTimer > 0) bannerTimer -= dt;
  elapsed = (performance.now() - startTime) / 1000;

  updatePlayer(dt);
  updateRotatingSword(dt);
  updateEnemies(dt);
  if (state !== 'playing') return;           // the hero may have been defeated
  updateBoss(dt);
  if (state !== 'playing') return;
  updateProjectiles(dt);
  if (state !== 'playing') return;
  updateHazards(dt);
  if (state !== 'playing') return;
  updatePickups();
  updatePortal(dt);
  checkGoal();
  updateHelperMessage();
}

/* ---------- The hero ---------- */
function updatePlayer(dt) {
  if (player.invuln > 0) player.invuln -= dt;
  if (player.cooldown > 0) player.cooldown -= dt;

  // --- Knocked back? Then slide away from the monster and skip normal controls ---
  if (player.kbTimer > 0) {
    player.kbTimer -= dt;
    moveBox(player, player.kbX * dt, player.kbY * dt);
    isMoving = false;
  } else {
    // --- Read the keys ---
    let dx = 0, dy = 0;
    if (anyDown(['KeyA', 'ArrowLeft'])) dx -= 1;
    if (anyDown(['KeyD', 'ArrowRight'])) dx += 1;
    if (anyDown(['KeyW', 'ArrowUp'])) dy -= 1;
    if (anyDown(['KeyS', 'ArrowDown'])) dy += 1;

    isMoving = (dx !== 0 || dy !== 0);

    if (isMoving) {
      // Which way is the hero facing? (sideways wins on diagonals)
      if (dx !== 0) facing = dx < 0 ? 'left' : 'right';
      else facing = dy < 0 ? 'up' : 'down';

      // Diagonal movement would be faster, so shrink it to keep the speed even.
      if (dx !== 0 && dy !== 0) { dx *= 0.7071; dy *= 0.7071; }

      let speed = PLAYER_SPEED;
      if (equipment.boots) speed *= 1 + EQUIPMENT.boots.speedBonus;     // boots make us faster
      if (powerTimers.speed > 0) speed *= 1.45;
      moveBox(player, dx * speed * dt, dy * speed * dt);
      walkTimer += dt;
    } else {
      walkTimer = 0;
    }
  }

  // --- Sword swing ---
  if (anyDown(ATTACK_KEYS) && player.cooldown <= 0 && player.attackTimer <= 0) startAttack();
  if (player.attackTimer > 0) {
    player.attackTimer -= dt;
    applyAttackDamage();
  }
}

// The rotating sword deals contact damage while circling the player.
// Each enemy has its own short hit cooldown so it damages reliably without
// deleting an enemy in a single frame.
function updateRotatingSword(dt) {
  if (powerTimers.rotatingSword <= 0) return;
  const angle = performance.now() / 130;
  const sx = player.x + 12 + Math.cos(angle) * 29;
  const sy = player.y + 12 + Math.sin(angle) * 29;
  for (const enemy of enemies.slice()) {
    enemy.rotatingSwordCooldown = Math.max(0, (enemy.rotatingSwordCooldown || 0) - dt);
    const ex = enemy.x + PLAYER_SIZE / 2;
    const ey = enemy.y + PLAYER_SIZE / 2;
    if (enemy.rotatingSwordCooldown <= 0 && Math.hypot(ex - sx, ey - sy) < 20) {
      enemy.rotatingSwordCooldown = 0.45;
      hurtEnemy(enemy, 2);
      spawnBurst(sx, sy, 3);
    }
  }
}

// The area in front of the hero that the weapon can hit.
function getAttackRect() {
  const reach = EQUIPMENT[equipment.weapon].reach;
  const cx = player.x + PLAYER_SIZE / 2;
  const cy = player.y + PLAYER_SIZE / 2;
  const width = 44;                                    // how wide the swing is
  if (facing === 'right') return { x: cx + 4, y: cy - width / 2, w: reach, h: width };
  if (facing === 'left')  return { x: cx - 4 - reach, y: cy - width / 2, w: reach, h: width };
  if (facing === 'up')    return { x: cx - width / 2, y: cy - 4 - reach, w: width, h: reach };
  return { x: cx - width / 2, y: cy + 4, w: width, h: reach };             // down
}

function startAttack() {
  player.attackTimer = ATTACK_TIME;
  player.cooldown = powerTimers.attack > 0 ? ATTACK_COOLDOWN * 0.5 : ATTACK_COOLDOWN;
  attackHits = [];                                     // nobody has been hit by this swing yet
  playSwingSound();
}

// Check every monster against the swing area. Each monster is only hit once per swing.
function applyAttackDamage() {
  const area = getAttackRect();
  const weapon = EQUIPMENT[equipment.weapon];
  for (const enemy of enemies.slice()) {          // slice() = a copy, because killed monsters leave the list
    if (attackHits.includes(enemy)) continue;
    if (overlaps(area.x, area.y, area.w, area.h, enemy.x, enemy.y, PLAYER_SIZE, PLAYER_SIZE)) {
      attackHits.push(enemy);
      hurtEnemy(enemy, weapon.damage);
    }
  }

  // NEW: the swing can hit the boss (once per swing)...
  if (boss && boss.introTimer <= 0 && !attackHits.includes(boss)) {
    const r = bossRect();
    if (overlaps(area.x, area.y, area.w, area.h, r.x, r.y, r.w, r.h)) {
      attackHits.push(boss);
      hurtBoss(weapon.damage);
    }
  }

  // NEW: ...and knock enemy bullets out of the air
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    if (overlaps(area.x, area.y, area.w, area.h, p.x - p.r, p.y - p.r, p.r * 2, p.r * 2)) {
      spawnBurst(p.x, p.y, 6, [p.colour, PALETTE.h]);
      projectiles.splice(i, 1);
      playDeflectSound();
    }
  }
}

function hurtEnemy(enemy, damage) {
  enemy.hp -= damage;
  enemy.hitFlash = 0.12;

  // Push the monster away from the hero
  const dx = (enemy.x + 12) - (player.x + 12);
  const dy = (enemy.y + 12) - (player.y + 12);
  const len = Math.hypot(dx, dy) || 1;
  enemy.kbX = (dx / len) * 260;
  enemy.kbY = (dy / len) * 260;
  enemy.kbTimer = 0.15;

  if (enemy.hp <= 0) {
    killEnemy(enemy);
  } else {
    playHitSound();
    spawnBurst(enemy.x + 12, enemy.y + 12, 6);
  }
}

function killEnemy(enemy) {
  const index = enemies.indexOf(enemy);
  if (index >= 0) enemies.splice(index, 1);
  kills++;
  playKillSound();
  spawnBurst(enemy.x + 12, enemy.y + 12, 16);

  // Sometimes a monster drops a heart
  if (Math.random() < ENEMY_TYPES[enemy.type].dropChance) {
    pickups.push({ type: 'heart', x: enemy.x + 12, y: enemy.y + 12, bob: 0 });
  }
}

function damagePlayer(amount, fromX, fromY) {
  if (powerTimers.invisibility > 0) return;
  // A shield takes off some of the damage, but you always take at least 1.
  const defense = equipment.shield ? EQUIPMENT.shield.defense : 0;
  const damage = Math.max(1, amount - defense);
  player.hp -= damage;
  player.invuln = INVULNERABLE_TIME;
  hurtTimer = 0.25;
  playHurtSound();

  // Knock the hero away from the monster
  const dx = (player.x + 12) - fromX;
  const dy = (player.y + 12) - fromY;
  const len = Math.hypot(dx, dy) || 1;
  player.kbX = (dx / len) * 240;
  player.kbY = (dy / len) * 240;
  player.kbTimer = 0.15;

  if (player.hp <= 0) {
    player.hp = 0;
    loseGame();
  }
}

/* ---------- Monsters ---------- */
function updateEnemies(dt) {
  const pcx = player.x + PLAYER_SIZE / 2;
  const pcy = player.y + PLAYER_SIZE / 2;

  for (const enemy of enemies) {
    const type = ENEMY_TYPES[enemy.type];
    enemy.anim += dt;
    if (enemy.hitFlash > 0) enemy.hitFlash -= dt;

    // Being knocked back? Slide, then skip the rest.
    if (enemy.kbTimer > 0) {
      enemy.kbTimer -= dt;
      moveBox(enemy, enemy.kbX * dt, enemy.kbY * dt);
      continue;
    }

    const ecx = enemy.x + PLAYER_SIZE / 2;
    const ecy = enemy.y + PLAYER_SIZE / 2;
    const dx = pcx - ecx;
    const dy = pcy - ecy;
    const dist = Math.hypot(dx, dy);

    enemy.charging = false;
    let vx = 0, vy = 0;
    if (type.ranged && dist < type.chaseRange && dist > 0) {
      // --- SHOOTER: keep some distance, sidestep, and fire bolts at the hero ---
      const ideal = 170;                                      // the distance it likes to keep
      if (dist > ideal + 40) {                                // too far: come closer
        vx = (dx / dist) * type.speed;
        vy = (dy / dist) * type.speed;
      } else if (dist < ideal - 40) {                         // too close: back away
        vx = -(dx / dist) * type.speed;
        vy = -(dy / dist) * type.speed;
      } else {                                                // just right: sidestep
        vx = (-dy / dist) * type.speed * 0.7 * enemy.strafe;
        vy = (dx / dist) * type.speed * 0.7 * enemy.strafe;
      }
      enemy.wanderTimer -= dt;                                // change sidestep direction now and then
      if (enemy.wanderTimer <= 0) {
        enemy.strafe *= -1;
        enemy.wanderTimer = 1.5 + Math.random() * 1.5;
      }

      enemy.shootTimer -= dt;
      enemy.charging = enemy.shootTimer < 0.5;                // glows for half a second = your warning!
      if (enemy.shootTimer <= 0) {
        fireBullet(ecx, ecy, Math.atan2(dy, dx), type.shotSpeed, type.shotDamage, false);
        playShootSound();
        enemy.shootTimer = type.shootEvery + Math.random() * 0.8;
        enemy.charging = false;
      }
    } else if (dist < type.chaseRange && dist > 0) {
      // --- CHASE: walk straight toward the hero ---
      let speed = type.speed;
      if (enemy.type === 'slime') speed *= 0.4 + 0.9 * Math.abs(Math.sin(enemy.anim * 4));  // hop along
      vx = (dx / dist) * speed;
      vy = (dy / dist) * speed;
      if (enemy.type === 'bat') {                       // bats flutter side to side
        vx += Math.sin(enemy.anim * 9) * 45;
        vy += Math.cos(enemy.anim * 7) * 45;
      }
    } else {
      // --- WANDER: pick a random direction every second or two ---
      enemy.wanderTimer -= dt;
      if (enemy.wanderTimer <= 0) {
        const angle = Math.random() * Math.PI * 2;
        const stand = Math.random() < 0.3;              // sometimes just stand still
        enemy.dirX = stand ? 0 : Math.cos(angle);
        enemy.dirY = stand ? 0 : Math.sin(angle);
        enemy.wanderTimer = 1 + Math.random() * 1.5;
      }
      vx = enemy.dirX * type.speed * 0.4;
      vy = enemy.dirY * type.speed * 0.4;
    }
    moveBox(enemy, vx * dt, vy * dt);

    // --- Touching the hero hurts! ---
    if (player.invuln <= 0 &&
        overlaps(player.x, player.y, PLAYER_SIZE, PLAYER_SIZE, enemy.x, enemy.y, PLAYER_SIZE, PLAYER_SIZE)) {
      damagePlayer(type.damage, ecx, ecy);
      if (state !== 'playing') return;                  // the hero was defeated
    }
  }
}

/* ---------- Items on the ground ---------- */
function updatePickups() {
  const pcx = player.x + PLAYER_SIZE / 2;
  const pcy = player.y + PLAYER_SIZE / 2;

  for (let i = pickups.length - 1; i >= 0; i--) {
    const item = pickups[i];
    if (Math.hypot(pcx - item.x, pcy - item.y) > 28) continue;       // too far away

    if (EQUIPMENT[item.type]) {
      equipItem(item.type);                                           // gear: wear it
      pickups.splice(i, 1);
    } else if (HEALING[item.type]) {
      if (player.hp < MAX_HP) {                                       // healing: only if hurt
        player.hp = Math.min(MAX_HP, player.hp + HEALING[item.type].heal);
        showToast(HEALING[item.type].name + '! Health restored.');
        playPickupSound();
        spawnBurst(item.x, item.y, 10);
        pickups.splice(i, 1);
      }
    }
  }
}

function equipItem(key) {
  const item = EQUIPMENT[key];
  equipment[item.slot] = key;                    // put it in the matching slot
  showToast('Equipped ' + item.name + '! ' + item.tip);
  playPickupSound();
  spawnBurst(player.x + 12, player.y + 12, 18);
}

function showToast(text) {
  toastText = text;
  toastTimer = 3;
}

/* ---------- The portal ---------- */
function updatePortal(dt) {
  if (!portalActive) return;
  portalAge += dt;

  // Walk into the portal (after it has finished appearing) to go to the next map
  const pcx = player.x + PLAYER_SIZE / 2;
  const pcy = player.y + PLAYER_SIZE / 2;
  if (portalAge > 0.6 && Math.hypot(pcx - portalX, pcy - portalY) < 24) {
    beginTransition();
  }
}

function beginTransition() {
  state = 'transition';
  transitionPhase = 'out';
  transitionTimer = 0;
  isMoving = false;
  playPortalEnterSound();
  spawnBurst(portalX, portalY, 30);
}

function updateTransition(dt) {
  transitionTimer += dt;
  if (transitionPhase === 'out' && transitionTimer >= FADE_TIME) {
    // The screen is black: swap to the next map
    player.hp = MAX_HP;                       // the portal heals you
    startLevel(levelIndex + 1);
    transitionPhase = 'in';
    transitionTimer = 0;
  } else if (transitionPhase === 'in' && transitionTimer >= FADE_TIME) {
    state = 'playing';
  }
}

/* ---------- Goals: crystal and start pad ---------- */
function checkGoal() {
  if (isBossRoom()) { nearCrystal = false; return; }
  const pcx = player.x + PLAYER_SIZE / 2;
  const pcy = player.y + PLAYER_SIZE / 2;
  let nearest = null, nearestDistance = Infinity;
  for (const spot of crystalSpots) {
    if (spot.collected) continue;
    const distance = Math.hypot(pcx - spot.x, pcy - spot.y);
    if (distance < nearestDistance) { nearest = spot; nearestDistance = distance; }
  }
  nearCrystal = !!nearest && nearestDistance <= INTERACT_DISTANCE;
  const chestCenterX = chestTile.col * TILE + TILE / 2, chestCenterY = chestTile.row * TILE + TILE / 2;
  nearChest = !chestOpened && chestTile.col >= 0 && Math.hypot(pcx - chestCenterX, pcy - chestCenterY) <= INTERACT_DISTANCE;
  if (nearest) { crystalX = nearest.x; crystalY = nearest.y; }

  // The starting pad only completes the level after every required crystal is collected.
  if (!portalActive && crystalsCollected >= crystalsRequired &&
      pcx > startZone.x1 && pcx < startZone.x2 &&
      pcy > startZone.y1 && pcy < startZone.y2) completeLevel();
}

// The crystal is home. Open the portal to the next map.
function completeLevel() {
  hasCrystal = false;
  crystalDelivered = true;
  portalActive = true;
  portalAge = 0;
  objectiveText.textContent = 'Enter the portal!';
  setMessage(portalMessage());
  showToast(levelIndex === LEVELS.length - 1 ? 'Level 5 complete! A strange portal opened...'
                                            : 'Level complete! A portal has opened.');
  playPortalOpenSound();
  flashTimer = FLASH_TIME;
  spawnBurst(portalX, portalY, 36);
}

// Treasure chests grant one random permanent gear upgrade or temporary power-up.
function openTreasureChest() {
  chestOpened = true; nearChest = false;
  const obj = sceneObjects.find(o => o.type === 'chest'); if (obj) obj.opened = true;
  const rewards = [
    { name:'Iron Sword', run:() => { equipment.weapon='sword'; } },
    { name:'Iron Armor', run:() => { equipment.shield='shield'; } },
    { name:'Swift Boots', run:() => { equipment.boots='boots'; } },
    { name:'Movement Speed Boost', run:() => { powerTimers.speed=24; } },
    { name:'Attack Speed Boost', run:() => { powerTimers.attack=24; } },
    { name:'Invisibility', run:() => { powerTimers.invisibility=12; player.invuln=Math.max(player.invuln,1.2); } },
    { name:'Rotating Sword', run:() => { powerTimers.rotatingSword=24; } }
  ];
  const reward = rewards[Math.floor(Math.random()*rewards.length)]; reward.run();
  showToast('Chest reward: '+reward.name+'!'); playPickupSound();
  spawnBurst(chestTile.col*TILE+TILE/2, chestTile.row*TILE+TILE/2, 20);
}

// Called when the E key is pressed.
function interact() {
  if (state !== 'playing') return;
  if (nearChest && !chestOpened) { openTreasureChest(); return; }
  if (!nearCrystal) return;
  const pcx = player.x + PLAYER_SIZE / 2, pcy = player.y + PLAYER_SIZE / 2;
  const target = crystalSpots.filter(spot => !spot.collected).sort((a,b) => Math.hypot(pcx-a.x,pcy-a.y)-Math.hypot(pcx-b.x,pcy-b.y))[0];
  if (!target) return;
  target.collected = true;
  crystalsCollected++;
  crystalX = target.x; crystalY = target.y;
  nearCrystal = false;
  objectiveText.textContent = crystalsCollected >= crystalsRequired ? 'Return to the starting point!' : `Collect crystals: ${crystalsCollected}/${crystalsRequired}`;
  setMessage(crystalsCollected >= crystalsRequired ? 'All crystals found! Return to the starting pad.' : 'Crystal collected! Search the forest for the remaining crystals.');

  // The first crystal triggers an ambush; tougher difficulties send a larger wave.
  if (!crystalWaveSpawned) {
    crystalWaveSpawned = true;
    const waveTypes = levelIndex >= 3 ? ['skeleton', 'bat', 'skeleton', 'mage', 'slime', 'bat', 'mage', 'skeleton']
                     : levelIndex >= 2 ? ['slime', 'bat', 'skeleton', 'mage']
                     : levelIndex >= 1 ? ['slime', 'bat', 'skeleton', 'slime']
                     : ['slime', 'slime', 'bat'];
    const waveSpawns = [
      [3,3],[20,3],[3,11],[20,11],[10,2],[15,12],[7,7],[17,6]
    ];
    const scaledWaveTypes = waveTypes.slice();
    const extraAmbush = Math.round(waveTypes.length * (difficultySettings().ambush - 1));
    for (let i = 0; i < extraAmbush; i++) scaledWaveTypes.push(waveTypes[i % waveTypes.length]);
    scaledWaveTypes.forEach((type, i) => {
      const [wantedCol, wantedRow] = waveSpawns[i % waveSpawns.length];
      // Search outward for a walkable tile. Some maps have trees/rocks at the
      // preferred ambush coordinates; spawning there traps the monster inside scenery.
      let col = wantedCol, row = wantedRow;
      const isWalkableSpawn = (c, r) => {
        if (c < 1 || r < 1 || c >= COLS - 1 || r >= ROWS - 1) return false;
        if (SOLID_TILES.includes(MAP[r][c])) return false;
        const x = c * TILE + (TILE - PLAYER_SIZE) / 2;
        const y = r * TILE + (TILE - PLAYER_SIZE) / 2;
        return !collides(x, y) && Math.hypot(x - player.x, y - player.y) > TILE * 2;
      };
      if (!isWalkableSpawn(col, row)) {
        let found = false;
        for (let radius = 1; radius < Math.max(COLS, ROWS) && !found; radius++) {
          for (let r = Math.max(1, wantedRow - radius); r <= Math.min(ROWS - 2, wantedRow + radius) && !found; r++) {
            for (let c = Math.max(1, wantedCol - radius); c <= Math.min(COLS - 2, wantedCol + radius); c++) {
              if (Math.max(Math.abs(c - wantedCol), Math.abs(r - wantedRow)) !== radius) continue;
              if (isWalkableSpawn(c, r)) { col = c; row = r; found = true; break; }
            }
          }
        }
      }
      if (!isWalkableSpawn(col, row)) return;
      const baseHp = ENEMY_TYPES[type].hp;
      const scaledHp = Math.ceil(baseHp * (1 + levelIndex * 0.32) * 1.15);
      enemies.push(createEnemy(type,
                               col * TILE + (TILE - PLAYER_SIZE) / 2,
                               row * TILE + (TILE - PLAYER_SIZE) / 2,
                               scaledHp));
    });
    showToast('AMBUSH! More monsters are coming!');
    setMessage('The crystal awakened the monsters! Fight your way home!');
  }

  playCollectSound();
  flashTimer = FLASH_TIME;
  spawnBurst(crystalX, crystalY - 20, 28);
}

function updateHelperMessage() {
  if (isBossRoom()) setMessage(MESSAGES.boss);
  else if (portalActive) setMessage(portalMessage());
  else if (crystalsCollected >= crystalsRequired) setMessage('All crystals found! Return to the starting pad.');
  else if (nearCrystal) setMessage('A crystal is nearby! Press E to collect it.');
  else if ((performance.now() - levelStartTime) / 1000 > 45) setMessage(MESSAGES.hint);
  else setMessage(MESSAGES.explore);
}

// Only touch the page when the text really changes.
function setMessage(text) {
  if (text !== lastMessage) {
    messageText.textContent = text;
    lastMessage = text;
  }
}

/* =========================================================
   NEW: BULLETS, FALLING ROCKS AND THE BOSS
   ========================================================= */

/* ---------- Bullets ----------
   A bullet is a little object that flies in a straight line.
   If it touches a tree or rock it disappears. If it touches you, you get hurt.
   Your weapon swing can destroy bullets (see applyAttackDamage).        */
function fireBullet(x, y, angle, speed, damage, isBossShot) {
  projectiles.push({
    x: x, y: y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: isBossShot ? 8 : 6,                                   // radius (pixels)
    damage: damage,
    life: 5,                                                 // disappears after 5 seconds
    colour: isBossShot ? '#9dff4a' : '#ff5ea8',              // boss = green, mage = pink
    glow: isBossShot ? 'rgba(157, 255, 74, 0.35)' : 'rgba(255, 94, 168, 0.35)'
  });
}

function updateProjectiles(dt) {
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const p = projectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;

    // Hit a tree, rock or the edge of the map? Pop!
    if (p.life <= 0 || isSolidAt(p.x, p.y)) {
      if (p.life > 0) spawnBurst(p.x, p.y, 5, [p.colour, PALETTE.h]);
      projectiles.splice(i, 1);
      continue;
    }

    // Hit the hero?
    if (player.invuln <= 0 &&
        overlaps(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2, player.x, player.y, PLAYER_SIZE, PLAYER_SIZE)) {
      projectiles.splice(i, 1);
      spawnBurst(p.x, p.y, 8, [p.colour, PALETTE.h]);
      damagePlayer(p.damage, p.x - p.vx * 0.05, p.y - p.vy * 0.05);     // knock the hero the way the bullet flew
      if (state !== 'playing') return;
    }
  }
}

/* ---------- Falling rocks ----------
   1. A red circle appears on the ground (the WARNING).
   2. A rock falls from the sky for HAZARD_WARN seconds.
   3. It lands. If you are still inside the circle, it hurts!        */
const HAZARD_WARN = 1.2;          // seconds between the warning and the crash
const HAZARD_RADIUS = 38;         // size of the danger circle (pixels)
const HAZARD_DAMAGE = 2;
const ROCK_COLOURS = ['#8a8f98', '#c4c8d0', '#5c616b', '#d9b074'];

function updateHazards(dt) {
  // --- Create new rocks from time to time ---
  let every = getLevel(levelIndex).hazardEvery || 0;
  if (boss && boss.phase === 2) every = 2.6;                 // the angry boss drops rocks faster
  const bossReady = !boss || boss.introTimer <= 0;           // wait until the boss has finished flying in
  if (every > 0 && bossReady) {
    hazardTimer -= dt;
    if (hazardTimer <= 0) {
      hazardTimer = every * (0.8 + Math.random() * 0.4);
      spawnHazard();
    }
  }

  // --- Update the rocks that already exist ---
  const pcx = player.x + PLAYER_SIZE / 2;
  const pcy = player.y + PLAYER_SIZE / 2;
  for (let i = hazards.length - 1; i >= 0; i--) {
    const h = hazards[i];
    if (!h.hit) {
      h.t += dt;
      if (h.t >= HAZARD_WARN) {                              // CRASH!
        h.hit = true;
        h.boom = 0.35;
        playRockSound();
        spawnBurst(h.x, h.y, 16, ROCK_COLOURS);
        if (player.invuln <= 0 && Math.hypot(pcx - h.x, pcy - h.y) < HAZARD_RADIUS + 4) {
          damagePlayer(HAZARD_DAMAGE, h.x, h.y);
          if (state !== 'playing') return;
        }
      }
    } else {
      h.boom -= dt;
      if (h.boom <= 0) hazards.splice(i, 1);                 // the dust has cleared
    }
  }
}

// Pick a spot near the hero (often right on top of the hero!) for the next rock.
function spawnHazard() {
  const pcx = player.x + PLAYER_SIZE / 2;
  const pcy = player.y + PLAYER_SIZE / 2;
  for (let tries = 0; tries < 10; tries++) {
    const onTarget = Math.random() < 0.6;                    // 60%: aimed right at the hero
    const angle = Math.random() * Math.PI * 2;
    const distance = onTarget ? 0 : 50 + Math.random() * 110;
    const x = pcx + Math.cos(angle) * distance;
    const y = pcy + Math.sin(angle) * distance;
    if (x < TILE * 1.5 || x > WIDTH - TILE * 1.5) continue;  // stay inside the map
    if (y < TILE * 2 || y > HEIGHT - TILE * 1.5) continue;
    if (isSolidAt(x, y)) continue;                           // not on a tree or rock
    hazards.push({ x: x, y: y, t: 0, hit: false, boom: 0 });
    return;
  }
}

/* ---------- The boss: Zorgon ---------- */
function createBoss() {
  return {
    x: WIDTH / 2 - BOSS_DATA.size / 2,
    y: BOSS_DATA.homeY - 220,              // starts above the screen and flies in
    hp: BOSS_DATA.hp, maxHp: BOSS_DATA.hp,
    phase: 1,                              // phase 2 starts at half health: he gets ANGRY
    introTimer: BOSS_DATA.intro,
    t: 0,                                  // time since the fight began (animation)
    moveT: 0,                              // time spent moving (drives the left-right sweep)
    hitFlash: 0,
    shootTimer: 1.5,                       // time until the next spread of bullets
    ringTimer: 5,                          // time until the next ring of bullets (phase 2 only)
    spawnTimer: 4,                         // time until the next mini aliens
    summoned: false
  };
}

// The part of the boss that can be hit or can hurt you (a bit smaller than the picture).
function bossRect() {
  return { x: boss.x + 14, y: boss.y + 8, w: BOSS_DATA.size - 28, h: BOSS_DATA.size - 20 };
}

function updateBoss(dt) {
  if (!boss) return;
  const b = boss;
  b.t += dt;
  if (b.hitFlash > 0) b.hitFlash -= dt;

  // --- Entrance: fly down from above. Can't be hurt and doesn't attack yet. ---
  if (b.introTimer > 0) {
    b.introTimer -= dt;
    const k = Math.max(0, b.introTimer / BOSS_DATA.intro);          // 1 -> 0
    b.x = WIDTH / 2 - BOSS_DATA.size / 2;
    b.y = BOSS_DATA.homeY - k * 220;
    if (b.introTimer <= 0) playBossRoarSound();
    return;
  }

  const enraged = b.phase === 2;

  // --- Movement: sweeps left and right (faster when enraged), bobbing up and down ---
  b.moveT += dt;
  b.x = WIDTH / 2 - BOSS_DATA.size / 2 + Math.sin(b.moveT * (enraged ? 1.15 : 0.75)) * 300;
  b.y = BOSS_DATA.homeY + Math.sin(b.moveT * 1.7) * 10 + (enraged ? (Math.sin(b.moveT * 0.6) + 1) * 30 : 0);

  const cx = b.x + BOSS_DATA.size / 2;
  const cy = b.y + BOSS_DATA.size * 0.62;                           // roughly where the mouth is

  // --- Attack 1: a fan of bullets aimed at the hero (3 bullets, or 5 when enraged) ---
  b.shootTimer -= dt;
  if (b.shootTimer <= 0) {
    const aim = Math.atan2(player.y + PLAYER_SIZE / 2 - cy, player.x + PLAYER_SIZE / 2 - cx);
    const count = enraged ? 5 : 3;
    for (let i = 0; i < count; i++) {
      const angle = aim + (i - (count - 1) / 2) * 0.26;             // spread them out
      fireBullet(cx, cy, angle, enraged ? 215 : 195, BOSS_DATA.shotDamage, true);
    }
    playBossShootSound();
    b.shootTimer = enraged ? 1.5 : 2.1;
  }

  // --- Attack 2 (enraged only): a ring of bullets in every direction ---
  if (enraged) {
    b.ringTimer -= dt;
    if (b.ringTimer <= 0) {
      const spin = Math.random() * Math.PI;
      for (let i = 0; i < 14; i++) {
        fireBullet(cx, cy, spin + (Math.PI * 2 * i) / 14, 125, BOSS_DATA.shotDamage, true);
      }
      playBossShootSound();
      b.ringTimer = 5.5;
    }
  }

  // --- Attack 3: summon mini aliens from time to time ---
  b.spawnTimer -= dt;
  if (b.spawnTimer <= 0) {
    summonMinions(cx, cy);
    b.spawnTimer = enraged ? 6 : 8;
  }

  // --- Touching the boss hurts ---
  const r = bossRect();
  if (player.invuln <= 0 && overlaps(player.x, player.y, PLAYER_SIZE, PLAYER_SIZE, r.x, r.y, r.w, r.h)) {
    damagePlayer(BOSS_DATA.contactDamage, cx, cy);
  }
}

// Spawn little aliens next to the boss (but never more than maxMinions at once).
function summonMinions(cx, cy) {
  const alive = enemies.filter(e => e.type === 'alien').length;
  const wanted = Math.min(boss.phase === 2 ? 3 : 2, BOSS_DATA.maxMinions - alive);
  if (wanted <= 0) return;
  for (let i = 0; i < wanted; i++) {
    const offset = (i - (wanted - 1) / 2) * 80;
    let x = Math.max(TILE + 4, Math.min(WIDTH - TILE - PLAYER_SIZE - 4, cx + offset - PLAYER_SIZE / 2));
    let y = Math.max(TILE * 2, Math.min(HEIGHT - 120, cy + 50));
    while (collides(x, y) && y < HEIGHT - 120) y += TILE;            // not inside a wall
    enemies.push(createEnemy('alien', x, y));
    spawnBurst(x + 12, y + 12, 14, ['#9dff4a', '#6ff0c8', PALETTE.h]);
  }
  playSummonSound();
  if (!boss.summoned) {
    boss.summoned = true;
    showToast('Zorgon summons mini aliens!');
  }
}

function hurtBoss(damage) {
  if (!boss || state !== 'playing') return;
  boss.hp -= damage;
  boss.hitFlash = 0.1;
  playHitSound();
  const r = bossRect();
  spawnBurst(r.x + r.w / 2, r.y + r.h / 2, 8, ['#9dff4a', PALETTE.h]);

  if (boss.hp <= 0) {
    boss.hp = 0;
    startBossDeath();
  } else if (boss.phase === 1 && boss.hp <= boss.maxHp / 2) {
    // Half health: the boss gets ANGRY (more bullets, faster, more falling rocks)
    boss.phase = 2;
    boss.spawnTimer = 1;
    boss.ringTimer = 2;
    flashTimer = FLASH_TIME;
    showToast('Zorgon is ENRAGED!');
    playBossRoarSound();
  }
}

// The boss was defeated: a short explosion show, then the victory screen.
function startBossDeath() {
  state = 'bossDying';
  bossDeathTimer = 2.8;
  bossBurstTimer = 0;
  projectiles = [];
  hazards = [];
  for (const e of enemies) spawnBurst(e.x + 12, e.y + 12, 12, ['#9dff4a', PALETTE.h]);
  kills += enemies.length + 1;               // the mini aliens and the boss count as kills
  enemies = [];
  player.attackTimer = 0;
  isMoving = false;
  keysDown.clear();
  flashTimer = FLASH_TIME;
  playBossDieSound();
}

function updateBossDeath(dt) {
  bossDeathTimer -= dt;
  boss.hitFlash = Math.floor(bossDeathTimer * 14) % 2 === 0 ? 0.1 : 0;   // flicker white

  bossBurstTimer -= dt;
  if (bossBurstTimer <= 0) {                                              // little explosions all over him
    bossBurstTimer = 0.12;
    spawnBurst(boss.x + 10 + Math.random() * (BOSS_DATA.size - 20),
               boss.y + 10 + Math.random() * (BOSS_DATA.size - 20),
               12, ['#9dff4a', PALETTE.y, PALETTE.r, PALETTE.h]);
  }

  if (bossDeathTimer <= 0) {
    boss = null;
    winGame();
  }
}

// Fireworks while the victory screen is showing.
function updateFireworks(dt) {
  fireworkTimer -= dt;
  if (fireworkTimer <= 0) {
    fireworkTimer = 0.3;
    spawnBurst(80 + Math.random() * (WIDTH - 160), 80 + Math.random() * 260, 26,
               [PALETTE.y, PALETTE.r, PALETTE.c, PALETTE.p, PALETTE.h, '#9dff4a']);
  }
}

/* ---------- Particles (sparkle effects) ---------- */

// Shoot a burst of small squares outward from a point.
// (You can pass your own list of colours, otherwise the crystal colours are used.)
function spawnBurst(x, y, count, customColours) {
  const colours = customColours || [PALETTE.C, PALETTE.c, PALETTE.y, PALETTE.h];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const speed = 60 + Math.random() * 140;
    particles.push({
      x: x, y: y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.6 + Math.random() * 0.5,
      maxLife: 1.1,
      colour: colours[i % colours.length]
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);          // remove finished particles
    } else {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;                    // slow down a little
      p.vy *= 0.97;
    }
  }
}


/* =========================================================
   11. DRAWING (render)
   ========================================================= */
function render(time) {
  // 1. Ground (copied from the hidden background canvas)
  ctx.drawImage(bgCanvas, 0, 0);

  // 2. Danger circles and items lying on the ground
  drawHazardWarnings();
  drawPickups(time);

  // 3. Everything that stands up (trees, rocks, monsters, the portal, the hero)
  //    is drawn from the top of the screen to the bottom, so things lower on
  //    the screen overlap things higher up. This gives a simple 3D look.
  const movers = [{ kind: 'player', sortY: player.y + PLAYER_SIZE }];
  for (const enemy of enemies) movers.push({ kind: 'enemy', enemy: enemy, sortY: enemy.y + PLAYER_SIZE });
  if (portalActive) movers.push({ kind: 'portal', sortY: portalTile.row * TILE + TILE });
  if (boss) movers.push({ kind: 'boss', sortY: boss.y + BOSS_DATA.size - 10 });
  movers.sort((a, b) => a.sortY - b.sortY);

  let next = 0;
  for (const obj of sceneObjects) {
    while (next < movers.length && movers[next].sortY < obj.sortY) drawMover(movers[next++], time);
    drawSceneObject(obj);
  }
  while (next < movers.length) drawMover(movers[next++], time);

  // 4. Draw every uncollected crystal in the level.
  if (!isBossRoom()) {
    for (const spot of crystalSpots) if (!spot.collected) drawCrystalAt(spot, time);
  }

  // 5. Bullets, falling rocks, sword swing, effects and interface drawn on top
  drawProjectiles();
  drawFallingRocks();
  if (player.attackTimer > 0) drawSlash();
  drawParticles();
  drawFlash();
  drawCanvasHud();
  drawBossBar();

  if (state === 'playing' && nearCrystal) {
    drawBubble('Press E to collect', player.x + PLAYER_SIZE / 2, Math.max(48, player.y - 56));
  }
  drawToast();
  drawBanner();
  drawTransition();
}

function drawMover(mover, time) {
  if (mover.kind === 'player') drawPlayer();
  else if (mover.kind === 'enemy') drawEnemy(mover.enemy);
  else if (mover.kind === 'boss') drawBoss(time);
  else drawPortal(time);
}

function drawSceneObject(obj) {
  let sprite;
  if (obj.type === 'chest') sprite = (obj.opened || chestOpened) ? sprites.chestOpen : sprites.chestClosed;
  else sprite = sprites[obj.type];
  ctx.drawImage(sprite, obj.x, obj.y);
}

function drawPlayer() {
  // Blink while the hero can't be hurt (skip every other 0.1 second)
  if (player.invuln > 0 && Math.floor(player.invuln * 10) % 2 === 0) return;

  // Alternate between the two leg frames every 0.12 seconds while walking
  const frame = isMoving ? Math.floor(walkTimer / 0.12) % 2 : 0;
  const bob = (isMoving && frame === 1) ? -PIXEL : 0;     // tiny hop while walking

  // The sprite (40 x 40) is bigger than the collision box (24 x 24),
  // so shift it so its feet line up with the bottom of the box.
  const drawX = Math.round(player.x - (TILE - PLAYER_SIZE) / 2);
  const drawY = Math.round(player.y - (TILE - PLAYER_SIZE));

  // Shadow under the feet
  ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
  ctx.fillRect(Math.round(player.x) + 2, Math.round(player.y) + PLAYER_SIZE - 8, PLAYER_SIZE - 4, 8);

  ctx.drawImage(playerSprites[facing][frame], drawX, drawY + bob);
  // Custom colours/accessories are layered over the base pixel sprite.
  const px = drawX, py = drawY + bob;
  ctx.fillStyle = characterStyle.clothes; ctx.fillRect(px + 12, py + 20, 16, 10);
  ctx.fillStyle = characterStyle.skin; ctx.fillRect(px + 12, py + 10, 16, 9);
  const hairColours = { brown:'#754323', black:'#24202a', blonde:'#f1cf58', red:'#c84b32', blue:'#42c9ed' };
  ctx.fillStyle = hairColours[characterStyle.hair] || hairColours.brown;
  ctx.fillRect(px + 10, py + 7, 20, 6);
  if (characterStyle.gender === 'female') { ctx.fillRect(px + 8, py + 10, 4, 12); ctx.fillRect(px + 28, py + 10, 4, 12); }
  if (characterStyle.accessory === 'wings') {
    ctx.fillStyle = '#d7f4ff'; ctx.fillRect(px + 1, py + 19, 9, 4); ctx.fillRect(px + 3, py + 14, 6, 5); ctx.fillRect(px + 30, py + 19, 9, 4); ctx.fillRect(px + 31, py + 14, 6, 5);
  } else if (characterStyle.accessory === 'crown') {
    ctx.fillStyle = '#ffd23f'; ctx.fillRect(px + 13, py + 3, 14, 4); ctx.fillRect(px + 13, py, 3, 4); ctx.fillRect(px + 19, py - 2, 3, 6); ctx.fillRect(px + 24, py, 3, 4);
  } else if (characterStyle.accessory === 'halo') { ctx.strokeStyle = '#ffe879'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(px + 20, py + 2, 10, 3, 0, 0, Math.PI * 2); ctx.stroke(); }
  else if (characterStyle.accessory === 'eyepatch') { ctx.fillStyle = '#25202b'; ctx.fillRect(px + 20, py + 12, 6, 3); }
  if (powerTimers.rotatingSword > 0) {
    const a = performance.now() / 130; const sx = player.x + 12 + Math.cos(a) * 29, sy = player.y + 12 + Math.sin(a) * 29;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(a); ctx.fillStyle = '#e8f7ff'; ctx.fillRect(-3, -13, 6, 22); ctx.fillStyle = '#ffd23f'; ctx.fillRect(-7, 5, 14, 4); ctx.restore();
  }
}

function drawEnemy(enemy) {
  const x = Math.round(enemy.x - (TILE - PLAYER_SIZE) / 2);
  let y = Math.round(enemy.y - (TILE - PLAYER_SIZE));
  const flash = enemy.hitFlash > 0;

  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.fillRect(Math.round(enemy.x) + 2, Math.round(enemy.y) + PLAYER_SIZE - 8, PLAYER_SIZE - 4, 8);

  if (enemy.type === 'slime') {
    // Squash and stretch to look like it's bouncing
    const squish = Math.floor(enemy.anim * 4) % 2 === 0;
    const sprite = flash ? flashSprites.slime : sprites.slime;
    ctx.drawImage(sprite, x, y + (squish ? 4 : 0), TILE, squish ? 36 : 40);
  } else if (enemy.type === 'bat') {
    y -= 10 + Math.round(Math.sin(enemy.anim * 5) * 3);    // bats hover above the ground
    const flap = Math.floor(enemy.anim * 8) % 2 === 0;
    const name = flap ? 'batUp' : 'batDown';
    ctx.drawImage(flash ? flashSprites[name] : sprites[name], x, y);
  } else if (enemy.type === 'mage') {
    // The mage glows pink just before it shoots - that is your warning to move!
    if (enemy.charging) {
      ctx.fillStyle = 'rgba(255, 94, 168, 0.35)';
      ctx.beginPath();
      ctx.arc(enemy.x + PLAYER_SIZE / 2, enemy.y + PLAYER_SIZE / 2 - 4, 22 + Math.sin(enemy.anim * 30) * 3, 0, Math.PI * 2);
      ctx.fill();
    }
    const bob = Math.floor(enemy.anim * 3) % 2 === 0 ? 0 : -PIXEL;   // floats gently
    ctx.drawImage(flash ? flashSprites.mage : sprites.mage, x, y + bob);
  } else if (enemy.type === 'alien') {
    const bob = Math.floor(enemy.anim * 8) % 2 === 0 ? 0 : -PIXEL;   // scurries quickly
    ctx.drawImage(flash ? flashSprites.alien : sprites.alien, x, y + bob);
  } else {
    const bob = Math.floor(enemy.anim * 5) % 2 === 0 ? 0 : -PIXEL;   // skeleton bobs while walking
    ctx.drawImage(flash ? flashSprites.skeleton : sprites.skeleton, x, y + bob);
  }

  // Small health bar once the monster is hurt
  if (enemy.hp < enemy.maxHp) {
    const barY = y + 2;
    ctx.fillStyle = PALETTE.k;
    ctx.fillRect(x + 8 - 2, barY - 2, PLAYER_SIZE + 4, 8);
    ctx.fillStyle = '#7a1f1f';
    ctx.fillRect(x + 8, barY, PLAYER_SIZE, 4);
    ctx.fillStyle = PALETTE.r;
    ctx.fillRect(x + 8, barY, Math.round(PLAYER_SIZE * enemy.hp / enemy.maxHp), 4);
  }
}

// NEW: the red warning circles on the ground (and the dust ring after the rock lands)
function drawHazardWarnings() {
  for (const h of hazards) {
    if (h.hit) {
      const k = h.boom / 0.35;                               // 1 -> 0
      ctx.strokeStyle = 'rgba(255, 255, 255, ' + (0.7 * k) + ')';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(h.x, h.y, HAZARD_RADIUS * (1.9 - k * 0.9), 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    const k = h.t / HAZARD_WARN;                             // 0 -> 1: the closer to 1, the closer the crash
    ctx.fillStyle = 'rgba(214, 69, 65, ' + (0.15 + 0.3 * k) + ')';
    ctx.beginPath();
    ctx.arc(h.x, h.y, HAZARD_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = Math.floor(h.t * 12) % 2 === 0 ? '#ff5a46' : '#ffd23f';   // blinking edge
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(h.x, h.y, HAZARD_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';            // a ring that shrinks as the rock gets closer
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(h.x, h.y, HAZARD_RADIUS * (1 - k), 0, Math.PI * 2);
    ctx.stroke();
  }
}

// NEW: the rock itself, falling from the top of the screen onto the circle
function drawFallingRocks() {
  for (const h of hazards) {
    if (h.hit) continue;
    const fall = 1 - h.t / HAZARD_WARN;                      // 1 = high up, 0 = landed
    ctx.drawImage(sprites.rock, h.x - 24, h.y - 40 - fall * fall * 380, 48, 48);
  }
}

// NEW: magic bolts and boss bullets
function drawProjectiles() {
  for (const p of projectiles) {
    ctx.fillStyle = p.glow;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r + 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.colour;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.h;                               // bright white centre
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 0.45, 0, Math.PI * 2);
    ctx.fill();
  }
}

// NEW: draw the big alien boss
function drawBoss(time) {
  const b = boss;
  const size = BOSS_DATA.size;
  const bob = Math.round(Math.sin(b.t * 3) * 4);             // hovers up and down
  let shakeX = 0, shakeY = 0;
  if (state === 'bossDying') {                               // shudders while exploding
    shakeX = Math.round((Math.random() - 0.5) * 8);
    shakeY = Math.round((Math.random() - 0.5) * 8);
  }

  // Shadow on the ground (he hovers above it)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(b.x + size / 2, b.y + size + 24, 46, 10, 0, 0, Math.PI * 2);
  ctx.fill();

  // Warning glow just before he shoots
  if (b.introTimer <= 0 && b.shootTimer < 0.4 && state === 'playing') {
    ctx.fillStyle = 'rgba(157, 255, 74, 0.35)';
    ctx.beginPath();
    ctx.arc(b.x + size / 2, b.y + size * 0.62, 34 + Math.sin(time * 0.06) * 4, 0, Math.PI * 2);
    ctx.fill();
  }

  const sprite = b.hitFlash > 0 ? flashSprites.boss : sprites.boss;
  ctx.drawImage(sprite, Math.round(b.x) + shakeX, Math.round(b.y) + bob + shakeY, size, size);
}

// NEW: the boss health bar across the top of the screen
function drawBossBar() {
  if (!boss || state === 'won') return;
  const w = 420, h = 14;
  const x = (WIDTH - w) / 2, y = 60;
  const label = BOSS_DATA.name + (boss.phase === 2 ? '  - ENRAGED!' : '');

  ctx.font = 'bold 13px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = PALETTE.k;
  ctx.fillText(label, WIDTH / 2 + 1, 52 + 1);
  ctx.fillStyle = boss.phase === 2 ? '#ff8a5c' : PALETTE.h;
  ctx.fillText(label, WIDTH / 2, 52);
  ctx.textBaseline = 'alphabetic';

  ctx.fillStyle = PALETTE.k;
  ctx.fillRect(x - 3, y - 3, w + 6, h + 6);                  // border
  ctx.fillStyle = '#3b1030';
  ctx.fillRect(x, y, w, h);                                  // empty bar
  ctx.fillStyle = boss.phase === 2 ? '#ff5e5e' : '#9dff4a';
  ctx.fillRect(x, y, Math.round(w * boss.hp / boss.maxHp), h);   // health left
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.fillRect(x + w / 2 - 1, y, 2, h);                      // marks the half-way point (where he gets angry)
}

// Items on the ground float up and down and sparkle.
function drawPickups(time) {
  for (const item of pickups) {
    const bob = Math.round(Math.sin(time * 0.005 + item.bob) * 3);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';                       // shadow
    ctx.fillRect(item.x - 10, item.y + 12, 20, 6);

    const size = 32;
    ctx.drawImage(sprites[item.type], item.x - size / 2, item.y - size / 2 - 4 + bob, size, size);

    if (Math.sin(time * 0.007 + item.bob * 2) > 0.5) drawSparkle(item.x + 14, item.y - 14 + bob);
  }
}

// The portal grows from nothing when it opens, then flickers and pulses.
function drawPortal(time) {
  const grow = Math.min(1, portalAge / 0.6);
  const size = (TILE + 16) * grow;
  const wobble = Math.sin(time * 0.006) * 3;

  // Purple glow
  ctx.fillStyle = 'rgba(138, 92, 255, 0.25)';
  ctx.beginPath();
  ctx.arc(portalX, portalY, (30 + wobble) * grow, 0, Math.PI * 2);
  ctx.fill();

  const sprite = Math.floor(time / 180) % 2 === 0 ? sprites.portalA : sprites.portalB;
  ctx.drawImage(sprite, portalX - size / 2, portalY - size / 2, size, size);

  // Little sparkles floating up from the portal
  for (let i = 0; i < 3; i++) {
    const t = ((time * 0.001 + i / 3) % 1);
    drawSparkle(portalX - 16 + i * 16, portalY + 20 - t * 44);
  }
}

// Draw a collectible crystal at a map position.
function drawCrystalAt(spot, time) {
  const bob = Math.round(Math.sin(time * 0.003 + spot.x * 0.03) * 3 / PIXEL) * PIXEL;
  const x = spot.x - TILE / 2, y = spot.y - TILE / 2 - 10 + bob;
  const pulse = 15 + Math.sin(time * 0.004 + spot.y * 0.02) * 3;
  ctx.fillStyle = 'rgba(62, 200, 255, 0.16)';
  ctx.beginPath(); ctx.arc(spot.x, y + TILE / 2, pulse, 0, Math.PI * 2); ctx.fill();
  ctx.drawImage(sprites.crystal, x, y);
  if (Math.sin(time * 0.006 + spot.x) > 0.15) drawSparkle(spot.x + 13, y + 4);
}

// The crystal floats above the chest, bobbing up and down with sparkles.
function drawFloatingCrystal(time) {
  const bob = Math.round(Math.sin(time * 0.003) * 4 / PIXEL) * PIXEL;
  const x = chestTile.col * TILE;
  const y = chestTile.row * TILE - 32 + bob;

  // Soft blue glow that slowly pulses
  const pulse = 28 + Math.sin(time * 0.004) * 4;
  ctx.fillStyle = 'rgba(62, 200, 255, 0.18)';
  ctx.beginPath();
  ctx.arc(crystalX, y + TILE / 2, pulse, 0, Math.PI * 2);
  ctx.fill();

  ctx.drawImage(sprites.crystal, x, y);

  // Four twinkling plus-shaped sparkles around the crystal
  const spots = [[-26, -14], [24, -20], [-18, 18], [28, 12]];
  for (let i = 0; i < spots.length; i++) {
    if (Math.sin(time * 0.006 + i * 1.7) > 0.2) {
      drawSparkle(crystalX + spots[i][0], y + TILE / 2 + spots[i][1]);
    }
  }
}

function drawSparkle(cx, cy) {
  const s = PIXEL;
  ctx.fillStyle = PALETTE.h;
  ctx.fillRect(cx - s / 2, cy - s * 1.5, s, s * 3);     // vertical bar
  ctx.fillRect(cx - s * 1.5, cy - s / 2, s * 3, s);     // horizontal bar
}

// A small crystal that floats above the hero's head after it is collected.
function drawCarriedCrystal(time) {
  if (state === 'won') return;
  const bob = Math.round(Math.sin(time * 0.006) * 2);
  const size = 24;
  const x = Math.round(player.x + PLAYER_SIZE / 2 - size / 2);
  const y = Math.round(player.y - (TILE - PLAYER_SIZE) - size + 4 + bob);
  ctx.drawImage(sprites.crystal, x, y, size, size);
  if (Math.sin(time * 0.01) > 0.3) drawSparkle(x + size + 4, y + 4);
}

// The weapon swings in an arc in front of the hero.
function drawSlash() {
  const weapon = EQUIPMENT[equipment.weapon];
  const progress = 1 - player.attackTimer / ATTACK_TIME;          // 0 -> 1 during the swing
  const baseAngle = { right: 0, down: Math.PI / 2, left: Math.PI, up: -Math.PI / 2 }[facing];
  const start = baseAngle - 1.0;
  const angle = start + progress * 2.0;                           // sweeps from -1 to +1 radian

  ctx.save();
  ctx.translate(player.x + PLAYER_SIZE / 2, player.y + PLAYER_SIZE / 2 - 4);

  // A faint trail behind the blade
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(0, 0, weapon.reach - 6, start, angle);
  ctx.stroke();

  // The weapon itself
  ctx.rotate(angle);
  ctx.fillStyle = PALETTE.k;
  ctx.fillRect(4, -5, weapon.reach - 2, 10);                      // outline
  ctx.fillStyle = weapon.colour;
  ctx.fillRect(6, -3, weapon.reach - 6, 6);                       // blade
  ctx.fillStyle = PALETTE.y;
  ctx.fillRect(4, -6, 4, 12);                                     // hilt
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, Math.min(1, p.life / p.maxLife));
    ctx.fillStyle = p.colour;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), PIXEL, PIXEL);
  }
  ctx.globalAlpha = 1;
}

// White flash when the crystal is collected, red flash when the hero is hurt.
function drawFlash() {
  if (flashTimer > 0) {
    ctx.fillStyle = 'rgba(255, 255, 255, ' + (0.6 * flashTimer / FLASH_TIME) + ')';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
  if (hurtTimer > 0) {
    ctx.fillStyle = 'rgba(214, 69, 65, ' + (0.45 * hurtTimer / 0.25) + ')';
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }
}

// The status bar across the top: crystal, hearts, equipment and level info.
function drawCanvasHud() {
  ctx.fillStyle = 'rgba(27, 27, 47, 0.82)';
  ctx.fillRect(0, 0, WIDTH, TILE);

  // Crystal slot (dim = not collected, bright = collected)
  const haveIt = hasCrystal || crystalDelivered;
  drawSlot(8, 4, 32, haveIt ? PALETTE.y : PALETTE.a);
  ctx.globalAlpha = haveIt ? 1 : 0.25;
  ctx.drawImage(sprites.crystal, 12, 8, 24, 24);
  ctx.globalAlpha = 1;

  if (!isBossRoom()) {
    ctx.font = 'bold 14px monospace'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('CRYSTALS ' + crystalsCollected + '/' + crystalsRequired, 278, 20);
  }

  // Hearts: each heart = 2 health points (full, half or empty)
  for (let i = 0; i < MAX_HP / 2; i++) {
    const x = 54 + i * 30;
    const points = player.hp - i * 2;                 // health points left for this heart
    ctx.globalAlpha = 0.3;
    ctx.drawImage(sprites.heart, x, 6, 28, 28);       // empty heart (dim)
    ctx.globalAlpha = 1;
    if (points >= 2) {
      ctx.drawImage(sprites.heart, x, 6, 28, 28);     // full heart
    } else if (points === 1) {
      ctx.drawImage(sprites.heart, 0, 0, 20, 40, x, 6, 14, 28);   // left half only
    }
  }

  // Equipment slots: weapon, shield, boots
  const slots = [
    { key: equipment.weapon, x: 160 },
    { key: equipment.shield, x: 198 },
    { key: equipment.boots,  x: 236 }
  ];
  for (const slot of slots) {
    drawSlot(slot.x, 4, 32, slot.key ? PALETTE.y : PALETTE.a);
    if (slot.key) ctx.drawImage(sprites[slot.key], slot.x + 4, 8, 24, 24);
  }

  // Show active temporary power-ups and their remaining duration.
  const activePowers = [
    ['speed', 'MOVE'], ['attack', 'ATK SPD'],
    ['invisibility', 'INVIS'], ['rotatingSword', 'SPIN SWORD']
  ].filter(([key]) => powerTimers[key] > 0);
  if (activePowers.length) {
    const labels = activePowers.map(([key, label]) => label + ' ' + powerTimers[key].toFixed(1) + 's');
    ctx.font = 'bold 12px monospace';
    const text = labels.join('  |  ');
    const boxW = Math.min(WIDTH - 20, ctx.measureText(text).width + 18);
    ctx.fillStyle = 'rgba(18, 25, 42, 0.88)';
    ctx.fillRect(10, HEIGHT - 31, boxW, 23);
    ctx.strokeStyle = '#ffd23f'; ctx.lineWidth = 1;
    ctx.strokeRect(10, HEIGHT - 31, boxW, 23);
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 18, HEIGHT - 19);
  }

  // Level and monster count on the right
  ctx.font = 'bold 15px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  const info = (isBossRoom() ? 'BOSS ROOM' : 'Level ' + (levelIndex + 1) + '/' + LEVELS.length) +
               '   Monsters: ' + enemies.length;
  ctx.fillStyle = PALETTE.k;
  ctx.fillText(info, WIDTH - 11, 21);
  ctx.fillStyle = PALETTE.h;
  ctx.fillText(info, WIDTH - 12, 20);
  ctx.textBaseline = 'alphabetic';
}

function drawSlot(x, y, size, borderColour) {
  ctx.fillStyle = PALETTE.k;
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = borderColour;
  ctx.lineWidth = 3;
  ctx.strokeRect(x + 1.5, y + 1.5, size - 3, size - 3);
}

// A small speech bubble with text, centred on x.
function drawBubble(text, x, y) {
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = ctx.measureText(text).width + 20;
  const h = 26;
  const left = Math.max(4, Math.min(WIDTH - w - 4, x - w / 2));
  ctx.fillStyle = PALETTE.k;
  ctx.fillRect(left - 3, y - 3, w + 6, h + 6);       // dark border
  ctx.fillStyle = PALETTE.h;
  ctx.fillRect(left, y, w, h);                       // white box
  ctx.fillStyle = PALETTE.k;
  ctx.fillText(text, left + w / 2, y + h / 2 + 1);
  ctx.textBaseline = 'alphabetic';
}

// Short pop-up message near the bottom of the screen.
function drawToast() {
  if (toastTimer <= 0 || state === 'menu') return;
  ctx.globalAlpha = Math.min(1, toastTimer / 0.5);
  drawBubble(toastText, WIDTH / 2, HEIGHT - 50);
  ctx.globalAlpha = 1;
}

// Big level title at the start of each map.
function drawBanner() {
  if (bannerTimer <= 0 || state !== 'playing') return;
  ctx.globalAlpha = Math.min(1, bannerTimer / 0.7);
  ctx.fillStyle = 'rgba(27, 27, 47, 0.85)';
  ctx.fillRect(0, HEIGHT / 2 - 56, WIDTH, 100);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 34px monospace';
  ctx.fillStyle = PALETTE.k;
  ctx.fillText(bannerTitle, WIDTH / 2 + 2, HEIGHT / 2 - 20 + 2);
  ctx.fillStyle = PALETTE.y;
  ctx.fillText(bannerTitle, WIDTH / 2, HEIGHT / 2 - 20);
  ctx.font = 'bold 20px monospace';
  ctx.fillStyle = PALETTE.h;
  ctx.fillText(bannerSub, WIDTH / 2, HEIGHT / 2 + 20);
  ctx.textBaseline = 'alphabetic';
  ctx.globalAlpha = 1;
}

// Black fade while travelling through the portal.
function drawTransition() {
  if (state !== 'transition') return;
  const t = Math.min(1, transitionTimer / FADE_TIME);
  const alpha = transitionPhase === 'out' ? t : 1 - t;
  ctx.fillStyle = 'rgba(20, 10, 50, ' + alpha + ')';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
}


/* =========================================================
   12. START / RESTART / LEVEL CHANGES / WIN / LOSE
   ========================================================= */

// Get a level ready to play: load the map and reset the things that belong to one level.
function startLevel(index) {
  loadLevel(index);
  const level = getLevel(index);

  player.x = SPAWN_X;
  player.y = SPAWN_Y;
  player.invuln = 0;
  player.kbTimer = 0;
  player.attackTimer = 0;
  player.cooldown = 0;
  facing = 'down';
  isMoving = false;
  walkTimer = 0;

  hasCrystal = false;
  crystalWaveSpawned = false;
  crystalDelivered = false;
  nearCrystal = false;
  portalActive = false;
  portalAge = 0;
  particles = [];
  flashTimer = 0;
  hurtTimer = 0;
  toastTimer = 0;
  keysDown.clear();
  levelStartTime = performance.now();
  equipmentAtLevelStart = { weapon: equipment.weapon, shield: equipment.shield, boots: equipment.boots };

  levelText.textContent = level.isBoss ? 'Boss Room: ' + level.name
                                       : 'Level ' + (index + 1) + ': ' + level.name;
  objectiveText.textContent = isBossRoom() ? level.objective : `Collect crystals: 0/${crystalsRequired}`;
  lastMessage = '';
  setMessage(MESSAGES.explore);

  bannerTitle = level.isBoss ? 'BOSS ROOM' : 'LEVEL ' + (index + 1);
  bannerSub = level.isBoss ? 'Defeat Zorgon, the Alien Overlord!' : level.name;
  bannerTimer = 3;
}

// Brand new game: back to level 1 with no equipment.
function resetGame() {
  equipment = { weapon: 'stick', shield: null, boots: null };
  player.hp = MAX_HP;
  kills = 0;
  startTime = performance.now();
  elapsed = 0;
  startLevel(0);

  startScreen.classList.add('hidden');
  document.getElementById('gameSettingsScreen').classList.add('hidden');
  winScreen.classList.add('hidden');
  loseScreen.classList.add('hidden');
  state = 'playing';
}

function startGame() {
  difficulty = document.getElementById('difficultySelect').value || 'medium';
  initAudio();          // sound can only start after a click
  resetGame();
}

// After being defeated: restart the SAME level with the gear you had when it began.
function retryLevel() {
  initAudio();
  equipment = { weapon: equipmentAtLevelStart.weapon, shield: equipmentAtLevelStart.shield, boots: equipmentAtLevelStart.boots };
  player.hp = MAX_HP;
  startLevel(levelIndex);

  loseScreen.classList.add('hidden');
  state = 'playing';
}

function winGame() {
  state = 'won';
  isMoving = false;
  hasCrystal = false;
  crystalDelivered = true;
  elapsed = (performance.now() - startTime) / 1000;
  const minutes = Math.floor(elapsed / 60);
  const seconds = Math.floor(elapsed % 60);
  finalTime.textContent = minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
  finalKills.textContent = kills;

  playVictorySound();
  fireworkTimer = 0;                          // start the fireworks straight away (see updateFireworks)
  spawnBurst(player.x + PLAYER_SIZE / 2, player.y, 40);
  setTimeout(function () {
    if (state === 'won') spawnBurst(player.x + PLAYER_SIZE / 2, player.y, 40);
  }, 400);

  winScreen.classList.remove('hidden');
  document.getElementById('restartBtn').focus();
}

// NEW: from the victory screen, go back to the title screen.
function goToMainMenu() {
  equipment = { weapon: 'stick', shield: null, boots: null };
  player.hp = MAX_HP;
  kills = 0;
  startLevel(0);                              // put level 1 behind the title screen
  bannerTimer = 0;
  state = 'menu';
  winScreen.classList.add('hidden');
  loseScreen.classList.add('hidden');
  startScreen.classList.remove('hidden');
  document.getElementById('gameSettingsScreen').classList.add('hidden');
  closeMenuPanels();
  document.getElementById('playBtn').focus();
}

function loseGame() {
  state = 'lost';
  isMoving = false;
  keysDown.clear();
  playLoseSound();
  loseScreen.classList.remove('hidden');
  document.getElementById('retryBtn').focus();
}

// Settings controls are mirrored between the title menu and in-game pause panel.
const settingsIds = [['audioVolume','gameAudioVolume','audioVolume'],['sfxVolume','gameSfxVolume','sfxVolume'],['sfxEnabled','gameSfxEnabled','sfxEnabled']];
function syncSettingControls() {
  document.getElementById('audioVolume').value = document.getElementById('gameAudioVolume').value = Math.round(audioVolume*100);
  document.getElementById('sfxVolume').value = document.getElementById('gameSfxVolume').value = Math.round(sfxVolume*100);
  document.getElementById('sfxEnabled').checked = document.getElementById('gameSfxEnabled').checked = sfxEnabled;
}
function bindRange(id, setter) { document.getElementById(id).addEventListener('input', e => { setter(e.target.type==='checkbox' ? e.target.checked : Number(e.target.value)/100); syncSettingControls(); }); }
bindRange('audioVolume', v=>audioVolume=v); bindRange('gameAudioVolume', v=>audioVolume=v);
bindRange('sfxVolume', v=>sfxVolume=v); bindRange('gameSfxVolume', v=>sfxVolume=v);
bindRange('sfxEnabled', v=>sfxEnabled=v); bindRange('gameSfxEnabled', v=>sfxEnabled=v);
syncSettingControls();
function closeMenuPanels() { document.getElementById('customizePanel').classList.add('hidden'); document.getElementById('settingsPanel').classList.add('hidden'); }
document.getElementById('customizeBtn').addEventListener('click', () => { const panel=document.getElementById('customizePanel'); document.getElementById('settingsPanel').classList.add('hidden'); panel.classList.toggle('hidden'); });
document.getElementById('customizeDoneBtn').addEventListener('click', () => { characterStyle.gender=document.getElementById('charGender').value; characterStyle.hair=document.getElementById('charHair').value; characterStyle.skin=document.getElementById('charSkin').value; characterStyle.clothes=document.getElementById('charClothes').value; characterStyle.accessory=document.getElementById('charAccessory').value; document.getElementById('customizePanel').classList.add('hidden'); showToast('Character look updated!'); });
document.getElementById('settingsBtn').addEventListener('click', () => { document.getElementById('customizePanel').classList.add('hidden'); document.getElementById('settingsPanel').classList.toggle('hidden'); });
document.getElementById('settingsBackBtn').addEventListener('click', () => { document.getElementById('settingsPanel').classList.add('hidden'); });
let stateBeforeSettings = 'playing';
function openGameSettings() { if(state!=='playing') return; stateBeforeSettings=state; state='settings'; document.getElementById('gameSettingsScreen').classList.remove('hidden'); syncSettingControls(); }
document.getElementById('hudSettingsBtn').addEventListener('click', openGameSettings);
document.getElementById('resumeBtn').addEventListener('click', () => { document.getElementById('gameSettingsScreen').classList.add('hidden'); state=stateBeforeSettings; });
document.getElementById('gameMenuBtn').addEventListener('click', () => { document.getElementById('gameSettingsScreen').classList.add('hidden'); goToMainMenu(); });

// Buttons
const difficultySelect = document.getElementById('difficultySelect');
const difficultyDescription = document.getElementById('difficultyDescription');
const difficultyDescriptions = { easy: 'Fewer monsters with less health and damage.', medium: 'Balanced enemies and a fair challenge.', hard: 'More monsters with higher health and damage.', insane: 'Huge ambushes, tougher monsters, and little room for mistakes.' };
difficultySelect.addEventListener('change', () => { difficultyDescription.textContent = difficultyDescriptions[difficultySelect.value] || difficultyDescriptions.medium; });
document.getElementById('playBtn').addEventListener('click', startGame);
document.getElementById('restartBtn').addEventListener('click', startGame);       // "Play Again"
document.getElementById('menuBtn').addEventListener('click', goToMainMenu);       // "Main Menu"
document.getElementById('retryBtn').addEventListener('click', retryLevel);
document.getElementById('hudRestartBtn').addEventListener('click', function () {
  startGame();
  this.blur();          // give the keyboard back to the game
});


/* =========================================================
   13. THE GAME LOOP
   requestAnimationFrame calls loop() about 60 times per second.
   Each time: update the game, then draw it.
   ========================================================= */
let lastTime = 0;

function loop(time) {
  const dt = Math.min((time - lastTime) / 1000, 0.05);   // cap dt so a lag spike can't teleport anything
  lastTime = time;
  update(dt);
  render(time);
  requestAnimationFrame(loop);
}

// Load level 1 so there is something to see behind the start screen.
startLevel(0);
bannerTimer = 0;
document.getElementById('playBtn').focus();
requestAnimationFrame(loop);
