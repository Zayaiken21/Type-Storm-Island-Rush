(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const now = () => performance.now();
  const SAVE_KEY = 'typestorm_island_rush_save_v1';
  const SETTINGS_KEY = 'typestorm_island_rush_settings_v1';
  const MAX_ROOM_PLAYERS = 7;

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function rand() {
      a += 0x6D2B79F5;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function choice(arr, rand = Math.random) {
    return arr[Math.floor(rand() * arr.length) % arr.length];
  }

  function formatTime(seconds) {
    seconds = Math.max(0, Math.floor(seconds));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  function roundRect(ctx, x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  const WORLDS = [
    { name: 'Sunny Coral Coast', mood: 'happy steel drums', boss: 'Coral Jaw', colors: ['#20c7d7', '#0c80d5', '#ffe066'], enemies: ['shark', 'piranha', 'jellyfish', 'crab', 'coral beast'], effect: 'sun sparkles', prompt: 'easy ocean words' },
    { name: 'Pirate Reef', mood: 'playful sea shanty', boss: 'Captain Bitebeard', colors: ['#16477a', '#2aa7a7', '#ffb347'], enemies: ['pirate fish', 'treasure mimic', 'crab', 'eel', 'bubble bat'], effect: 'gold coins', prompt: 'pirate phrases' },
    { name: 'Jungle Lagoon', mood: 'warm drums and birds', boss: 'Vinefin Titan', colors: ['#0f7b52', '#20d080', '#f6d365'], enemies: ['piranha', 'vine eel', 'toxic slime', 'jungle ray', 'bubble bat'], effect: 'leaf bursts', prompt: 'animal island words' },
    { name: 'Iceberg Ocean', mood: 'soft bells and arctic wind', boss: 'Frost Whale King', colors: ['#8bd7ff', '#4c8fea', '#e9fbff'], enemies: ['ice whale', 'frost crab', 'snow jelly', 'polar eel', 'ghost ray'], effect: 'snow shimmer', prompt: 'accuracy drills' },
    { name: 'Volcano Tide', mood: 'deep drums and lava pops', boss: 'Magma Shell', colors: ['#fc5c40', '#7b1d36', '#ffcf4a'], enemies: ['lava turtle', 'magma eel', 'ash shark', 'ember crab', 'toxic slime'], effect: 'embers', prompt: 'number drills' },
    { name: 'Neon Cyber Sea', mood: 'retro synth wave', boss: 'Neon Megabyte', colors: ['#41f4ff', '#9b5cff', '#16ff8f'], enemies: ['robotic fish', 'sea drone', 'mechanical octopus', 'laser jelly', 'byte shark'], effect: 'neon trails', prompt: 'tech symbols' },
    { name: 'Ancient Atlantis', mood: 'mystic choir pads', boss: 'Atlantean Hydra', colors: ['#2fd5b4', '#2857b8', '#ffd166'], enemies: ['ancient ray', 'stone crab', 'hydra minion', 'coral beast', 'treasure mimic'], effect: 'rune circles', prompt: 'advanced phrases' },
    { name: 'Stormbreaker Isles', mood: 'storm drums and thunder', boss: 'Storm Serpent', colors: ['#2d3e8f', '#12c6f3', '#f4f7ff'], enemies: ['storm serpent', 'electric eel', 'cloud jelly', 'sea drone', 'shark'], effect: 'lightning arcs', prompt: 'speed drills' },
    { name: 'Moonlit Abyss', mood: 'dreamy deep sea bells', boss: 'Abyss Phantom', colors: ['#15103d', '#5535a5', '#8ef5ff'], enemies: ['ghost ray', 'abyss jelly', 'shadow eel', 'bubble bat', 'phantom shark'], effect: 'moon glow', prompt: 'mixed case phrases' },
    { name: 'Alien Star Ocean', mood: 'cosmic plucks and pulses', boss: 'Star Kraken', colors: ['#481f9d', '#00e0ff', '#ff79d7'], enemies: ['alien squid', 'star drone', 'cosmic crab', 'void whale', 'mechanical octopus'], effect: 'star portals', prompt: 'boss challenge phrases' }
  ];

  const GAME_MODES = [
    { name: 'Solo Adventure', desc: 'Story progression with AI support and 110 levels.', online: false },
    { name: 'Multiplayer Survival', desc: 'Create or join rooms. Last island crew standing wins.', online: true },
    { name: 'Co-op Island Defense', desc: 'Protect one base together with shared pressure.', online: true },
    { name: 'Ranked Speed Battle', desc: 'Fast prompts, timed score race, fair AI fill.', online: true },
    { name: 'Practice Mode', desc: 'No pressure typing drills with adjustable difficulty.', online: false },
    { name: 'Boss Rush', desc: 'Fight the 10 bosses back-to-back.', online: false },
    { name: 'Kids Safe Mode', desc: 'Simple, cheerful vocabulary and forgiving waves.', online: false, kids: true },
    { name: 'Daily Challenge', desc: 'Seeded daily island run with one-shot scoring.', online: false },
    { name: 'Custom Room', desc: 'Private online room with world and level settings.', online: true },
    { name: 'Local Offline AI Match', desc: 'Compete against realistic AI without internet.', online: false, aiMatch: true }
  ];

  const POWERUPS = [
    { id: 'freeze', name: 'Freeze Wave', icon: '❄', cooldown: 22 },
    { id: 'lightning', name: 'Lightning Chain', icon: '⚡', cooldown: 18 },
    { id: 'shield', name: 'Bubble Shield', icon: '🫧', cooldown: 25 },
    { id: 'double', name: 'Double Points', icon: '2×', cooldown: 28 },
    { id: 'slow', name: 'Slow Motion', icon: '⏱', cooldown: 24 },
    { id: 'repair', name: 'Auto Repair', icon: '🔧', cooldown: 32 },
    { id: 'combo', name: 'Combo Blast', icon: '💥', cooldown: 30 },
    { id: 'bomb', name: 'Word Bomb', icon: '💣', cooldown: 35 },
    { id: 'breaker', name: 'Boss Breaker', icon: '🛡', cooldown: 26 },
    { id: 'accuracy', name: 'Accuracy Shield', icon: '✓', cooldown: 20 }
  ];

  const SHOP_ITEMS = [
    { id: 'avatar_sun', type: 'Avatar', title: 'Sun Diver', price: 80, currency: 'coins', icon: '☀' },
    { id: 'avatar_pirate', type: 'Avatar', title: 'Pearl Pirate', price: 120, currency: 'coins', icon: '🏴‍☠️' },
    { id: 'avatar_robot', type: 'Avatar', title: 'Neon Typist', price: 2, currency: 'pearls', icon: '🤖' },
    { id: 'trail_bubble', type: 'Typing Trail', title: 'Bubble Keys', price: 90, currency: 'coins', icon: '🫧' },
    { id: 'trail_star', type: 'Typing Trail', title: 'Star Splash', price: 3, currency: 'pearls', icon: '✨' },
    { id: 'scan_gold', type: 'Scan Effect', title: 'Gold Lock-On', price: 140, currency: 'coins', icon: '🎯' },
    { id: 'theme_night', type: 'Background', title: 'Moon Reef Menu', price: 200, currency: 'coins', icon: '🌙' },
    { id: 'up_base', type: 'Upgrade', title: 'Base Health +10', price: 150, currency: 'coins', icon: '❤️', upgrade: 'base' },
    { id: 'up_combo', type: 'Upgrade', title: 'Combo Multiplier +5%', price: 160, currency: 'coins', icon: '🔥', upgrade: 'combo' },
    { id: 'up_boss', type: 'Upgrade', title: 'Boss Damage +8%', price: 180, currency: 'coins', icon: '👑', upgrade: 'boss' },
    { id: 'up_shield', type: 'Upgrade', title: 'Starting Shield +8', price: 1, currency: 'pearls', icon: '🛡', upgrade: 'shield' },
    { id: 'up_power', type: 'Upgrade', title: 'Power Cooldowns -4%', price: 2, currency: 'pearls', icon: '⚙', upgrade: 'power' }
  ];

  const DEFAULT_SETTINGS = {
    musicVolume: 0.22,
    sfxVolume: 0.72,
    fontSize: 'normal',
    reduceMotion: false,
    bigText: false,
    highContrast: false,
    mobileKeyboard: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
    mute: false
  };

  const DEFAULT_SAVE = {
    coins: 250,
    pearls: 2,
    xp: 0,
    playerLevel: 1,
    unlockedGlobalLevel: 1,
    owned: ['avatar_sun'],
    upgrades: { base: 0, combo: 0, boss: 0, shield: 0, power: 0 },
    best: {}
  };

  class Store {
    static loadSettings() {
      try { return { ...DEFAULT_SETTINGS, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') }; }
      catch { return { ...DEFAULT_SETTINGS }; }
    }
    static saveSettings(settings) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); }
    static loadSave() {
      try {
        const raw = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
        return { ...DEFAULT_SAVE, ...raw, upgrades: { ...DEFAULT_SAVE.upgrades, ...(raw.upgrades || {}) }, owned: raw.owned || [...DEFAULT_SAVE.owned], best: raw.best || {} };
      } catch { return structuredClone ? structuredClone(DEFAULT_SAVE) : JSON.parse(JSON.stringify(DEFAULT_SAVE)); }
    }
    static saveGame(save) { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); }
  }

  class AudioEngine {
    constructor(settings) {
      this.settings = settings;
      this.ctx = null;
      this.loopGain = null;
      this.loopTimer = 0;
    }
    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    }
    beep(type = 'click') {
      if (this.settings.mute || this.settings.sfxVolume <= 0) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const table = {
        correct: [740, 0.045, 'sine'], wrong: [150, 0.11, 'sawtooth'], hit: [420, 0.06, 'triangle'], defeat: [880, 0.12, 'square'], combo: [1040, 0.16, 'sine'], power: [560, 0.22, 'triangle'], boss: [92, 0.45, 'sawtooth'], complete: [660, 0.32, 'sine'], over: [120, 0.5, 'triangle'], click: [520, 0.055, 'sine']
      };
      const [freq, dur, wave] = table[type] || table.click;
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq * (type === 'wrong' || type === 'over' ? 0.55 : 1.35)), t + dur);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.18 * this.settings.sfxVolume, t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }
    tickMusic(active, worldIndex = 0) {
      if (this.settings.mute || !active || this.settings.musicVolume <= 0) return;
      const ctx = this.ensure();
      if (!ctx) return;
      const n = ctx.currentTime;
      if (n < this.loopTimer) return;
      this.loopTimer = n + 0.48;
      const base = [196, 220, 247, 262, 294, 330, 370, 392, 440, 494][worldIndex % 10];
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = worldIndex >= 5 ? 'triangle' : 'sine';
      osc.frequency.value = base * choice([0.5, 0.75, 1, 1.25], Math.random);
      gain.gain.setValueAtTime(0.0001, n);
      gain.gain.exponentialRampToValueAtTime(0.035 * this.settings.musicVolume, n + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, n + 0.42);
      osc.connect(gain).connect(ctx.destination);
      osc.start(n);
      osc.stop(n + 0.45);
    }
  }

  class PromptManager {
    constructor() {
      this.prompts = [];
      this.kidsPrompts = [];
      this.bossPrompts = [];
      this.build();
    }
    add(text, category, difficulty = 1, kids = true) {
      const clean = String(text).replace(/\s+/g, ' ').trim();
      if (!clean || this.seen.has(clean.toLowerCase())) return;
      this.seen.add(clean.toLowerCase());
      const prompt = { text: clean, category, difficulty, kids: !!kids, length: clean.length };
      this.prompts.push(prompt);
      if (kids) this.kidsPrompts.push(prompt);
    }
    build() {
      this.seen = new Set();
      const easy = 'sun sea reef sand wave tide fish crab pearl shell boat star moon glow swim palm blue gold rain mist kite leaf ship rope map cave cove dock bell coin fern bird frog seal snow ice lava byte code grid ray fin eel pod bay log gem'.split(' ');
      const medium = 'coral island lagoon dolphin current treasure captain compass thunder volcano glacier sparkle keyboard lantern coconut jungle rainbow circuit rocket comet asteroid kelp tunnel anchor harbor sapphire emerald octopus turtle serpent scanner firewall monsoon cyclone moonbeam'.split(' ');
      const hard = 'bioluminescent navigation constellation hydrothermal archipelago crystalline aerodynamic phosphorescent thunderstruck synchronization algorithmic kaleidoscope cartographer observatory hexadecimal electromagnetic interstellar cybernetic atlantean'.split(' ');
      const ocean = 'anemone barracuda reefline seashell seagrass tidepool wavecrest bluewater saltwind sandbar splashzone driftwood manta seahorse narwhal plankton starfish coastlight'.split(' ');
      const island = 'sunny hammock banana coconut waterfall hibiscus volcano bridge tiki lagoon mango parrot bamboo jungle canopy trail orchid pebble picnic breeze'.split(' ');
      const pirate = 'booty compass cutlass galley lookout parrot plank treasure spyglass doubloon sailmaker harbor mapmaker blackflag jolly ropework cannonball'.split(' ');
      const space = 'starlight nebula galaxy orbit lunar comet meteor cosmic rocket satellite plasma alien quantum nova portal astro starship moonbase'.split(' ');
      const tech = 'pixel cache script socket server client render canvas packet binary signal module browser mobile tablet latency vector matrix function'.split(' ');
      const food = 'taco mango pizza noodle berry cookie melon toast cereal waffle pasta apple lemon burger salad banana cupcake dumpling popcorn'.split(' ');
      const animals = 'otter dolphin turtle penguin parrot monkey tiger rabbit puppy kitten whale lizard gecko frog panda fox koala zebra'.split(' ');
      easy.forEach(w => this.add(w, 'easy', 1, true));
      medium.forEach(w => this.add(w, 'medium', 2, true));
      hard.forEach(w => this.add(w, 'hard', 5, false));
      ocean.forEach(w => this.add(w, 'ocean', 2, true));
      island.forEach(w => this.add(w, 'island', 2, true));
      pirate.forEach(w => this.add(w, 'pirate', 3, true));
      space.forEach(w => this.add(w, 'space ocean', 4, true));
      tech.forEach(w => this.add(w, 'tech', 4, true));
      food.forEach(w => this.add(w, 'food', 2, true));
      animals.forEach(w => this.add(w, 'animals', 2, true));

      const adjectives = 'bright brave bubbly clever cosmic crystal dancing daring electric gentle golden happy hidden icy jolly lunar magic mighty neon quick quiet royal shiny silver sunny tiny turbo velvet wild zesty'.split(' ');
      const nouns = [...ocean, ...island, ...space, ...tech, ...food, ...animals, 'pilot', 'diver', 'captain', 'beacon', 'bubble', 'storm', 'isle', 'rune', 'portal', 'harpoon', 'keyboard'];
      const verbs = 'counts guards finds saves maps unlocks follows repairs scans builds catches carries polishes paints lifts powers protects guides'.split(' ');
      const objects = 'seven pearls three shells nine stars two maps bright keys blue gates silver coins tiny boats coral paths warm lights'.split(' ');
      for (const a of adjectives) {
        for (const n of nouns.slice(0, 55)) {
          this.add(`${a} ${n}`, 'short phrase', 2 + (a.length + n.length > 13 ? 1 : 0), true);
        }
      }
      let phraseLimit = 0;
      for (const a of adjectives) {
        for (const n of nouns) {
          for (const v of verbs) {
            const obj = objects[(phraseLimit + n.length + v.length) % objects.length];
            this.add(`${a} ${n} ${v} ${obj}`, 'funny phrase', 3 + (phraseLimit % 4), phraseLimit % 9 !== 0);
            phraseLimit++;
            if (phraseLimit > 820) break;
          }
          if (phraseLimit > 820) break;
        }
        if (phraseLimit > 820) break;
      }
      for (let i = 10; i < 410; i++) {
        const a = (i * 7) % 99;
        const b = (i * 13) % 88;
        this.add(`${a} ${b} ${String(a + b).padStart(2, '0')}`, 'number drill', 3, true);
        this.add(`wave-${i} reef-${(i * 3) % 77}`, 'number drill', 4, true);
        this.add(`${i % 10}${(i + 3) % 10}${(i + 6) % 10}-${(i * 11) % 100}`, 'number drill', 5, true);
      }
      const symbols = ['@', '#', '$', '%', '&', '*', '+', '=', '?', '!', '~'];
      for (let i = 0; i < 360; i++) {
        const w1 = tech[i % tech.length];
        const w2 = ocean[(i * 5) % ocean.length];
        this.add(`${w1}${symbols[i % symbols.length]}${w2}`, 'symbol drill', 5, i % 5 !== 0);
        this.add(`${symbols[(i + 2) % symbols.length]} ${w1} ${i % 100}`, 'symbol drill', 6, i % 7 !== 0);
      }
      for (let i = 0; i < 260; i++) {
        const n = nouns[(i * 11) % nouns.length];
        const cap = n.charAt(0).toUpperCase() + n.slice(1);
        this.add(`${cap} Rush ${i % 50}`, 'mixed case', 6, true);
        this.add(`Type ${cap}, then ${verbs[i % verbs.length]}!`, 'accuracy drill', 6, true);
      }
      const advancedStarts = ['Keep calm and chart', 'Focus before you strike', 'Accuracy beats panic near', 'The fastest crew repairs', 'Every clean word powers', 'Tiny mistakes invite', 'Storm pilots protect', 'Sharp rhythm unlocks', 'Quiet hands guide', 'Perfect timing saves'];
      const advancedEnds = ['the pearl gate.', 'the reef beacon.', 'the cosmic tide.', 'the old lagoon.', 'the neon harbor.', 'the moonlit tunnel.', 'the lava bridge.', 'the frozen crown.', 'the pirate vault.', 'the star portal.'];
      for (let i = 0; i < 180; i++) {
        this.add(`${advancedStarts[i % advancedStarts.length]} ${advancedEnds[(i * 3) % advancedEnds.length]}`, 'advanced typing phrase', 7 + (i % 3), i % 4 !== 0);
      }
      WORLDS.forEach((w, wi) => {
        for (let stage = 1; stage <= 6; stage++) {
          const line = `${w.boss} phase ${stage}: protect the ${['reef', 'crew', 'beacon', 'island', 'portal', 'base'][stage - 1]} with perfect rhythm ${wi + stage}`;
          this.bossPrompts.push({ text: line, category: 'boss challenge phrase', difficulty: 8 + wi, kids: true, length: line.length, world: wi });
          this.add(line, 'boss challenge phrase', 8 + wi, true);
        }
      });
      let fill = 0;
      while (this.prompts.length < 2300) {
        const text = `${choice(adjectives)} ${choice(nouns)} ${choice(verbs)} ${choice(nouns)} ${fill}`;
        this.add(text, 'generated challenge', 4 + (fill % 6), fill % 8 !== 0);
        fill++;
      }
    }
    getPrompt({ difficulty = 1, worldIndex = 0, boss = false, kids = false, seed = 1 }) {
      const rand = mulberry32((seed + 97 * worldIndex + 131 * difficulty) >>> 0);
      if (boss) {
        const pool = this.bossPrompts.filter(p => p.world === worldIndex);
        return { ...choice(pool.length ? pool : this.bossPrompts, rand) };
      }
      const maxDifficulty = clamp(Math.round(difficulty), 1, 10);
      let pool = (kids ? this.kidsPrompts : this.prompts).filter(p => p.difficulty <= maxDifficulty + 1);
      if (maxDifficulty <= 2) pool = pool.filter(p => p.text.length <= 8 && !/[0-9@#$%&*+=?!~]/.test(p.text));
      if (maxDifficulty <= 4) pool = pool.filter(p => p.text.length <= 18);
      if (!pool.length) pool = kids ? this.kidsPrompts : this.prompts;
      return { ...choice(pool, rand) };
    }
    count() { return this.prompts.length; }
  }

  class SpriteFactory {
    constructor() {
      this.bodyShapes = ['oval', 'long', 'triangle', 'round', 'whale', 'crab', 'jelly', 'eel', 'turtle', 'squid', 'drone', 'mimic'];
      this.eyeStyles = ['dot', 'wide', 'sleepy', 'angry', 'robot', 'glow', 'star'];
      this.finStyles = ['small', 'sail', 'spike', 'leaf', 'armor', 'wing', 'none'];
      this.tailStyles = ['fork', 'fan', 'bolt', 'ribbon', 'bubble', 'propeller', 'tentacles'];
      this.patterns = ['none', 'stripes', 'dots', 'zigzag', 'runes', 'plates', 'stars', 'scales'];
      this.glows = ['none', 'soft', 'strong', 'pulse'];
      this.armor = ['none', 'shell', 'metal', 'coral', 'ice', 'lava'];
      this.accessories = ['none', 'hat', 'crown', 'antenna', 'patch', 'gem', 'flag', 'visor'];
    }
    variationCount() {
      return this.bodyShapes.length * this.eyeStyles.length * this.finStyles.length * this.tailStyles.length * this.patterns.length * this.glows.length * this.armor.length * this.accessories.length * WORLDS.length;
    }
    recipe(worldIndex, seed, type = 'fish', boss = false) {
      const rand = mulberry32((seed + worldIndex * 1009 + type.length * 37) >>> 0);
      const colors = WORLDS[worldIndex % WORLDS.length].colors;
      const palette = [choice(colors, rand), choice(colors, rand), choice(['#ffffff', '#ffe066', '#46f4a8', '#ff79d7', '#10193a'], rand)];
      let bodyShape = choice(this.bodyShapes, rand);
      if (type.includes('crab')) bodyShape = 'crab';
      if (type.includes('jelly')) bodyShape = 'jelly';
      if (type.includes('eel') || type.includes('serpent')) bodyShape = 'eel';
      if (type.includes('turtle')) bodyShape = 'turtle';
      if (type.includes('squid') || type.includes('octopus')) bodyShape = 'squid';
      if (type.includes('drone') || type.includes('robot')) bodyShape = 'drone';
      if (type.includes('whale')) bodyShape = 'whale';
      return {
        bodyShape,
        palette,
        eye: choice(this.eyeStyles, rand),
        fin: choice(this.finStyles, rand),
        tail: choice(this.tailStyles, rand),
        pattern: choice(this.patterns, rand),
        glow: boss ? 'pulse' : choice(this.glows, rand),
        armor: boss ? choice(['shell', 'metal', 'coral', 'ice', 'lava'], rand) : choice(this.armor, rand),
        accessory: boss ? choice(['crown', 'gem', 'antenna'], rand) : choice(this.accessories, rand),
        worldIndex,
        boss,
        type
      };
    }
    draw(ctx, recipe, x, y, size, t, hit = 0) {
      ctx.save();
      ctx.translate(x, y);
      const wobble = Math.sin(t * 6 + x * 0.02) * size * 0.05;
      const pulse = recipe.glow === 'pulse' ? 0.5 + Math.sin(t * 4) * 0.5 : 0.5;
      if (recipe.glow !== 'none') {
        ctx.globalAlpha = recipe.glow === 'strong' || recipe.glow === 'pulse' ? 0.28 + pulse * 0.18 : 0.16;
        ctx.fillStyle = recipe.palette[1];
        ctx.beginPath();
        ctx.ellipse(0, 0, size * 1.15, size * 0.82, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.fillStyle = 'rgba(0,0,0,0.22)';
      ctx.beginPath();
      ctx.ellipse(5, size * 0.55, size * 0.9, size * 0.18, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.translate(hit ? Math.sin(t * 70) * hit * 6 : 0, wobble);

      this.drawTail(ctx, recipe, size, t);
      this.drawBody(ctx, recipe, size);
      this.drawPattern(ctx, recipe, size);
      this.drawFins(ctx, recipe, size, t);
      this.drawAccessory(ctx, recipe, size, t);
      this.drawEyes(ctx, recipe, size, t);
      ctx.restore();
    }
    drawBody(ctx, r, s) {
      const [a, b] = r.palette;
      const grad = ctx.createLinearGradient(-s, -s, s, s);
      grad.addColorStop(0, a);
      grad.addColorStop(1, b);
      ctx.fillStyle = grad;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = Math.max(2, s * 0.055);
      ctx.beginPath();
      switch (r.bodyShape) {
        case 'triangle': ctx.moveTo(-s, -s * 0.45); ctx.lineTo(s * 0.9, 0); ctx.lineTo(-s, s * 0.45); ctx.closePath(); break;
        case 'round': ctx.arc(0, 0, s * 0.72, 0, Math.PI * 2); break;
        case 'whale': ctx.ellipse(0, 0, s * 1.05, s * 0.58, 0, 0, Math.PI * 2); break;
        case 'crab': ctx.ellipse(0, 0, s * 0.82, s * 0.5, 0, 0, Math.PI * 2); break;
        case 'jelly': ctx.moveTo(-s * 0.75, 0); ctx.quadraticCurveTo(-s * 0.45, -s * 0.8, 0, -s * 0.82); ctx.quadraticCurveTo(s * 0.55, -s * 0.72, s * 0.75, 0); ctx.lineTo(s * 0.55, s * 0.32); ctx.quadraticCurveTo(0, s * 0.5, -s * 0.55, s * 0.32); ctx.closePath(); break;
        case 'eel': ctx.ellipse(0, 0, s * 1.12, s * 0.28, Math.sin(s) * 0.15, 0, Math.PI * 2); break;
        case 'turtle': ctx.ellipse(0, 0, s * 0.86, s * 0.62, 0, 0, Math.PI * 2); break;
        case 'squid': ctx.ellipse(0, -s * 0.12, s * 0.58, s * 0.78, 0, 0, Math.PI * 2); break;
        case 'drone': roundRect(ctx, -s * 0.78, -s * 0.45, s * 1.38, s * 0.9, s * 0.18); break;
        case 'mimic': roundRect(ctx, -s * 0.75, -s * 0.5, s * 1.3, s, s * 0.14); break;
        default: ctx.ellipse(0, 0, s * 0.88, s * 0.48, 0, 0, Math.PI * 2);
      }
      ctx.fill();
      ctx.stroke();
      if (r.armor !== 'none') {
        ctx.globalAlpha = 0.55;
        ctx.strokeStyle = r.armor === 'metal' ? '#d8f2ff' : r.armor === 'lava' ? '#ffcf4a' : r.armor === 'ice' ? '#e9fbff' : '#ffe066';
        ctx.lineWidth = Math.max(1, s * 0.04);
        for (let i = -2; i <= 2; i++) {
          ctx.beginPath();
          ctx.arc(i * s * 0.23, 0, s * 0.28, -0.6, 0.6);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
      }
    }
    drawTail(ctx, r, s, t) {
      const wag = Math.sin(t * 8) * s * 0.18;
      ctx.fillStyle = r.palette[1];
      ctx.strokeStyle = 'rgba(255,255,255,0.38)';
      ctx.lineWidth = Math.max(1, s * 0.035);
      ctx.beginPath();
      if (r.tail === 'tentacles' || r.bodyShape === 'squid' || r.bodyShape === 'jelly') {
        for (let i = -2; i <= 2; i++) {
          ctx.moveTo(-s * 0.25 + i * s * 0.14, s * 0.38);
          ctx.quadraticCurveTo(-s * 0.1 + i * s * 0.12, s * (0.72 + i * 0.04), -s * 0.22 + i * s * 0.17, s * 0.92 + Math.sin(t * 5 + i) * s * 0.1);
        }
        ctx.stroke();
        return;
      }
      const tx = -s * 0.86;
      if (r.tail === 'propeller') {
        ctx.arc(tx, 0, s * 0.22, 0, Math.PI * 2);
        ctx.moveTo(tx, 0); ctx.lineTo(tx - s * 0.44, -s * 0.2 + wag);
        ctx.moveTo(tx, 0); ctx.lineTo(tx - s * 0.44, s * 0.2 - wag);
      } else if (r.tail === 'ribbon') {
        ctx.moveTo(tx, 0); ctx.quadraticCurveTo(tx - s * 0.42, -s * 0.35 + wag, tx - s * 0.75, 0); ctx.quadraticCurveTo(tx - s * 0.42, s * 0.35 - wag, tx, 0);
      } else {
        ctx.moveTo(tx, 0); ctx.lineTo(tx - s * 0.52, -s * 0.36 + wag); ctx.lineTo(tx - s * 0.35, 0); ctx.lineTo(tx - s * 0.52, s * 0.36 - wag); ctx.closePath();
      }
      ctx.fill(); ctx.stroke();
    }
    drawFins(ctx, r, s, t) {
      if (r.fin === 'none' || r.bodyShape === 'drone') return;
      ctx.fillStyle = r.palette[2];
      ctx.globalAlpha = 0.82;
      const flap = Math.sin(t * 8) * s * 0.12;
      ctx.beginPath();
      if (r.fin === 'spike' || r.fin === 'armor') {
        for (let i = -2; i <= 2; i++) { ctx.moveTo(i * s * 0.22, -s * 0.42); ctx.lineTo(i * s * 0.22 + s * 0.12, -s * 0.82); ctx.lineTo(i * s * 0.22 + s * 0.24, -s * 0.42); }
      } else {
        ctx.moveTo(-s * 0.15, -s * 0.32); ctx.quadraticCurveTo(s * 0.2, -s * 0.9 + flap, s * 0.42, -s * 0.26); ctx.closePath();
        ctx.moveTo(-s * 0.05, s * 0.28); ctx.quadraticCurveTo(s * 0.22, s * 0.78 - flap, s * 0.44, s * 0.2); ctx.closePath();
      }
      ctx.fill();
      ctx.globalAlpha = 1;
      if (r.bodyShape === 'crab') {
        ctx.strokeStyle = r.palette[2];
        ctx.lineWidth = s * 0.07;
        for (let side of [-1, 1]) {
          for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            ctx.moveTo(side * s * 0.48, -s * 0.2 + i * s * 0.2);
            ctx.lineTo(side * s * (0.82 + i * 0.08), -s * 0.4 + i * s * 0.34);
            ctx.stroke();
          }
        }
      }
    }
    drawPattern(ctx, r, s) {
      ctx.save();
      ctx.globalAlpha = 0.33;
      ctx.strokeStyle = '#ffffff';
      ctx.fillStyle = '#ffffff';
      ctx.lineWidth = Math.max(1, s * 0.035);
      if (r.pattern === 'stripes') {
        for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.moveTo(i * s * 0.2, -s * 0.48); ctx.lineTo(i * s * 0.2 - s * 0.12, s * 0.48); ctx.stroke(); }
      } else if (r.pattern === 'dots' || r.pattern === 'stars') {
        for (let i = -3; i <= 3; i++) { ctx.beginPath(); ctx.arc(i * s * 0.2, Math.sin(i) * s * 0.18, s * 0.045, 0, Math.PI * 2); ctx.fill(); }
      } else if (r.pattern === 'zigzag' || r.pattern === 'runes') {
        ctx.beginPath(); ctx.moveTo(-s * 0.55, 0); for (let i = -4; i <= 4; i++) ctx.lineTo(i * s * 0.14, (i % 2 ? -1 : 1) * s * 0.18); ctx.stroke();
      } else if (r.pattern === 'scales' || r.pattern === 'plates') {
        for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.arc(i * s * 0.22, 0, s * 0.18, Math.PI, Math.PI * 2); ctx.stroke(); }
      }
      ctx.restore();
    }
    drawAccessory(ctx, r, s, t) {
      if (r.accessory === 'none') return;
      ctx.save();
      ctx.translate(s * 0.18, -s * 0.52);
      ctx.fillStyle = '#ffe066';
      ctx.strokeStyle = 'rgba(0,0,0,0.22)';
      ctx.lineWidth = Math.max(1, s * 0.025);
      ctx.beginPath();
      if (r.accessory === 'crown') {
        ctx.moveTo(-s * 0.25, 0); ctx.lineTo(-s * 0.16, -s * 0.28); ctx.lineTo(0, -s * 0.05); ctx.lineTo(s * 0.16, -s * 0.28); ctx.lineTo(s * 0.25, 0); ctx.closePath();
      } else if (r.accessory === 'hat' || r.accessory === 'flag') {
        roundRect(ctx, -s * 0.26, -s * 0.1, s * 0.52, s * 0.2, s * 0.05);
      } else if (r.accessory === 'antenna') {
        ctx.moveTo(0, 0); ctx.lineTo(0, -s * 0.42); ctx.arc(Math.sin(t * 5) * s * 0.06, -s * 0.48, s * 0.08, 0, Math.PI * 2);
      } else if (r.accessory === 'visor') {
        ctx.fillStyle = '#08162e'; roundRect(ctx, -s * 0.28, -s * 0.04, s * 0.56, s * 0.18, s * 0.08);
      } else {
        ctx.arc(0, -s * 0.1, s * 0.13, 0, Math.PI * 2);
      }
      ctx.fill(); ctx.stroke(); ctx.restore();
    }
    drawEyes(ctx, r, s, t) {
      const ex = s * 0.42, ey = -s * 0.12;
      ctx.save();
      if (r.eye === 'glow' || r.eye === 'robot' || r.eye === 'star') ctx.shadowBlur = s * 0.25, ctx.shadowColor = '#46f4a8';
      ctx.fillStyle = r.eye === 'angry' ? '#ff5b7f' : r.eye === 'robot' ? '#46f4a8' : '#ffffff';
      for (const off of [-0.13, 0.16]) {
        ctx.beginPath();
        if (r.eye === 'sleepy') ctx.ellipse(ex, ey + off * s, s * 0.11, s * 0.035, 0, 0, Math.PI * 2);
        else ctx.arc(ex, ey + off * s, s * (r.eye === 'wide' ? 0.13 : 0.095), 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#08213e';
        ctx.beginPath(); ctx.arc(ex + s * 0.03, ey + off * s + Math.sin(t * 2) * s * 0.01, s * 0.04, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = r.eye === 'angry' ? '#ff5b7f' : r.eye === 'robot' ? '#46f4a8' : '#ffffff';
      }
      if (r.eye === 'angry') {
        ctx.strokeStyle = '#08213e'; ctx.lineWidth = s * 0.045;
        ctx.beginPath(); ctx.moveTo(ex - s * 0.17, ey - s * 0.25); ctx.lineTo(ex + s * 0.16, ey - s * 0.12); ctx.stroke();
      }
      ctx.restore();
    }
  }

  class MultiplayerManager {
    constructor(app) {
      this.app = app;
      this.socket = null;
      this.room = null;
      this.playerId = null;
      this.connected = false;
      this.init();
    }
    init() {
      if (!window.io) return;
      try {
        this.socket = window.io({ transports: ['websocket', 'polling'], reconnection: true, reconnectionAttempts: Infinity });
        this.socket.on('connect', () => {
          this.connected = true;
          this.app.setRoomStatus('Connected to multiplayer server.');
          this.app.updateServerBadge(true);
          this.requestRooms();
        });
        this.socket.on('disconnect', () => {
          this.connected = false;
          this.app.setRoomStatus('Disconnected. Offline modes still work.');
          this.app.updateServerBadge(false);
        });
        this.socket.on('room:list', (rooms) => this.app.renderRoomList(rooms || []));
        this.socket.on('room:update', (room) => { this.room = room; this.app.renderLobby(room); if (this.app.game) this.app.game.applyRoom(room); });
        this.socket.on('match:start', (payload) => { this.room = payload.room; this.app.startGameFromRoom(payload.room, payload.seed); });
        this.socket.on('player:stats', (payload) => { if (this.app.game) this.app.game.updateRemoteStats(payload); });
        this.socket.on('game:snapshot', (snap) => { if (this.app.game) this.app.game.receiveSnapshot(snap); });
        this.socket.on('match:complete', (payload) => { if (this.app.game) this.app.game.finishLevel(payload.result || 'complete', true); });
        this.socket.on('room:votes', (payload) => this.app.showVoteStatus(payload));
        this.socket.on('match:advance', (payload) => this.app.handleVoteAdvance(payload));
      } catch (err) {
        console.warn('Socket.IO unavailable:', err);
      }
    }
    emitAck(event, payload) {
      return new Promise((resolve) => {
        if (!this.socket || !this.connected) return resolve({ ok: false, error: 'Multiplayer server is not connected. You can still play offline.' });
        this.socket.timeout(7000).emit(event, payload, (err, res) => {
          if (err) resolve({ ok: false, error: 'Server did not respond. Try again.' });
          else resolve(res || { ok: true });
        });
      });
    }
    async createRoom(payload) {
      const res = await this.emitAck('room:create', payload);
      if (res.ok) { this.room = res.room; this.playerId = res.playerId; }
      return res;
    }
    async joinRoom(payload) {
      const res = await this.emitAck('room:join', payload);
      if (res.ok) { this.room = res.room; this.playerId = res.playerId; }
      return res;
    }
    startRoom(payload) { return this.emitAck('room:start', payload); }
    leaveRoom() { return this.emitAck('room:leave', {}); }
    requestRooms() { if (this.socket && this.connected) this.socket.emit('room:list'); }
    stats(stats) { if (this.socket && this.connected && this.room) this.socket.emit('player:stats', stats); }
    snapshot(snap) { if (this.socket && this.connected && this.room) this.socket.emit('game:snapshot', snap); }
    complete(result, stats) { if (this.socket && this.connected && this.room) this.socket.emit('match:complete', { result, stats }); }
    vote(vote) { return this.emitAck('room:vote', { vote }); }
    isHost() { return this.room && this.playerId && this.room.hostId === this.playerId; }
  }

  class GameEngine {
    constructor(app) {
      this.app = app;
      this.canvas = $('gameCanvas');
      this.ctx = this.canvas.getContext('2d', { alpha: false });
      this.promptManager = app.promptManager;
      this.spriteFactory = app.spriteFactory;
      this.audio = app.audio;
      this.resize();
      this.boundLoop = this.loop.bind(this);
      this.running = false;
      this.paused = false;
      this.pointer = { x: 0, y: 0 };
      this.canvas.addEventListener('pointerdown', (e) => this.onPointer(e));
      window.addEventListener('resize', () => this.resize());
      requestAnimationFrame(this.boundLoop);
    }
    resize() {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const rect = this.canvas.getBoundingClientRect();
      this.w = Math.max(320, rect.width || window.innerWidth);
      this.h = Math.max(240, rect.height || window.innerHeight);
      this.canvas.width = Math.floor(this.w * dpr);
      this.canvas.height = Math.floor(this.h * dpr);
      this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    start(options = {}) {
      this.mode = options.mode || this.app.state.mode || 'Solo Adventure';
      this.worldIndex = clamp(Number(options.worldIndex || 0), 0, WORLDS.length - 1);
      this.levelIndex = clamp(Number(options.levelIndex || 0), 0, 10);
      this.seed = Number(options.seed || Date.now() % 1000000000);
      this.rand = mulberry32(this.seed + this.worldIndex * 777 + this.levelIndex * 31);
      this.kids = this.mode === 'Kids Safe Mode';
      this.multiplayer = !!options.multiplayer;
      this.room = options.room || null;
      this.isHost = !this.multiplayer || this.app.multiplayer.isHost();
      this.levelNumber = this.worldIndex * 11 + this.levelIndex + 1;
      this.isBossLevel = this.levelIndex === 10 || this.mode === 'Boss Rush';
      this.difficulty = clamp(1 + this.worldIndex * 0.75 + this.levelIndex * 0.48 + (this.mode.includes('Ranked') ? 1.3 : 0), 1, 10);
      this.enemyId = 0;
      this.enemies = [];
      this.particles = [];
      this.baseHealthMax = 100 + (this.app.save.upgrades.base * 10);
      this.baseHealth = this.baseHealthMax + (this.app.save.upgrades.shield * 8);
      this.score = 0;
      this.combo = 1;
      this.correctKeys = 0;
      this.wrongKeys = 0;
      this.totalKeys = 0;
      this.wordsTyped = 0;
      this.startedAt = now();
      this.timer = 0;
      this.wave = 1;
      this.wavesTotal = this.isBossLevel ? 1 : clamp(3 + Math.floor(this.levelIndex / 2), 3, 8);
      this.spawnTimer = this.isBossLevel ? 2.0 : 0.7;
      this.spawnedInWave = 0;
      this.maxPerWave = this.isBossLevel ? 0 : clamp(5 + this.levelIndex + this.worldIndex, 5, 22);
      this.maxEnemies = this.app.settings.reduceMotion ? 18 : 28;
      this.activeId = null;
      this.typedBuffer = '';
      this.freezeTimer = 0;
      this.slowTimer = 0;
      this.doubleTimer = 0;
      this.accuracyShield = 0;
      this.bossSpawned = false;
      this.bossDefeated = false;
      this.resultShown = false;
      this.lastHud = 0;
      this.lastStatsSend = 0;
      this.lastSnapshotSend = 0;
      this.powerCooldowns = Object.fromEntries(POWERUPS.map(p => [p.id, 0]));
      this.players = this.makePlayers(options.room);
      this.aiTimers = new Map();
      this.paused = false;
      this.running = true;
      this.applyPowerButtons();
      this.updateHud(true);
      this.app.hideOverlay('pauseOverlay');
      this.app.hideOverlay('resultOverlay');
      this.app.showScreen('gameScreen');
      setTimeout(() => this.app.focusTyping(), 120);
      this.audio.beep(this.isBossLevel ? 'boss' : 'complete');
    }
    makePlayers(room) {
      if (room && room.players) return room.players.map(p => ({ ...p }));
      const player = { id: 'local', name: 'You', isAI: false, score: 0, combo: 1, accuracy: 100, lives: 100, status: 'playing' };
      const aiCount = this.mode === 'Local Offline AI Match' ? 6 : this.mode === 'Solo Adventure' ? 2 : 0;
      const skills = ['easy', 'medium', 'hard', 'expert', 'medium', 'hard'];
      const names = ['CoralBot', 'PearlPilot', 'TideTyper', 'NeonKeys', 'LagoonLex', 'ReefRacer'];
      return [player, ...Array.from({ length: aiCount }, (_, i) => ({ id: `local_ai_${i}`, name: names[i], isAI: true, skill: skills[i], score: 0, combo: 1, accuracy: 100, lives: 100, status: 'ai-active' }))];
    }
    applyRoom(room) {
      this.room = room;
      if (room && room.players) this.players = room.players.map(p => ({ ...p }));
    }
    updateRemoteStats(payload) {
      const p = this.players.find(x => x.id === payload.id);
      if (p) Object.assign(p, payload);
      else this.players.push({ ...payload, name: 'Player', isAI: false });
    }
    receiveSnapshot(_snap) {
      // Local prediction stays authoritative for responsiveness. Snapshots update HUD-level info through room stats.
    }
    applyPowerButtons() {
      const box = $('powerButtons');
      box.innerHTML = '';
      POWERUPS.forEach((p) => {
        const btn = document.createElement('button');
        btn.className = 'power-btn';
        btn.dataset.power = p.id;
        btn.textContent = `${p.icon} ${p.name}`;
        btn.title = p.name;
        btn.addEventListener('click', () => this.usePower(p.id));
        box.appendChild(btn);
      });
    }
    usePower(id) {
      if (!this.running || this.paused || this.powerCooldowns[id] > 0) return;
      const upgradeFactor = 1 - Math.min(0.28, this.app.save.upgrades.power * 0.04);
      const baseCooldown = (POWERUPS.find(p => p.id === id)?.cooldown || 20) * upgradeFactor;
      this.powerCooldowns[id] = baseCooldown;
      this.audio.beep('power');
      if (id === 'freeze') this.freezeTimer = 4.5;
      if (id === 'slow') this.slowTimer = 7;
      if (id === 'double') this.doubleTimer = 10;
      if (id === 'shield') this.baseHealth = clamp(this.baseHealth + 22, 0, this.baseHealthMax + 60);
      if (id === 'repair') this.baseHealth = clamp(this.baseHealth + 34, 0, this.baseHealthMax + 60);
      if (id === 'accuracy') this.accuracyShield = 8;
      if (id === 'lightning') this.damageEnemies(4, 999, true);
      if (id === 'combo') {
        this.combo += 4;
        this.damageEnemies(5, 80, true);
      }
      if (id === 'bomb') this.damageEnemies(12, 999, false);
      if (id === 'breaker') {
        const boss = this.enemies.find(e => e.boss);
        if (boss) this.damageEnemy(boss, 90 + this.app.save.upgrades.boss * 14);
        else this.damageEnemies(3, 999, true);
      }
      this.updateHud(true);
    }
    damageEnemies(count, damage, preferNearBase) {
      const pool = [...this.enemies].sort((a, b) => preferNearBase ? a.x - b.x : b.x - a.x).slice(0, count);
      pool.forEach(e => this.damageEnemy(e, damage));
    }
    damageEnemy(e, damage) {
      e.hp -= damage;
      e.hit = 0.25;
      this.spawnParticles(e.x, e.y, e.boss ? '#ffe066' : '#46f4a8', e.boss ? 18 : 8);
      if (e.hp <= 0) this.removeEnemy(e, true);
    }
    onPointer(e) {
      if (!this.running || this.paused) return;
      const rect = this.canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      let best = null;
      let bestD = Infinity;
      for (const enemy of this.enemies) {
        const d = Math.hypot(enemy.x - x, enemy.y - y);
        if (d < enemy.size * 1.6 && d < bestD) { best = enemy; bestD = d; }
      }
      if (best) this.setTarget(best.id, true);
      this.app.focusTyping();
    }
    setTarget(id, clear = true) {
      if (this.activeId !== id) {
        this.activeId = id;
        if (clear) this.typedBuffer = '';
      }
    }
    getTarget() {
      let target = this.enemies.find(e => e.id === this.activeId);
      if (!target && this.enemies.length) {
        target = [...this.enemies].sort((a, b) => a.x - b.x)[0];
        this.setTarget(target.id, true);
      }
      return target;
    }
    handleKey(key) {
      if (!this.running || this.paused || this.resultShown) return;
      if (key === 'Escape') return this.pause();
      if (key === 'Backspace') {
        this.typedBuffer = this.typedBuffer.slice(0, -1);
        const target = this.getTarget();
        if (target) target.progress = this.typedBuffer.length;
        this.audio.beep('click');
        this.updateHud(true);
        return;
      }
      if (key === 'Enter') {
        const target = this.getTarget();
        if (target && this.typedBuffer === target.prompt.text) this.completeTarget(target);
        return;
      }
      if (key.length !== 1) return;
      const target = this.getTarget();
      if (!target) return;
      this.totalKeys++;
      const candidate = this.typedBuffer + key;
      if (target.prompt.text.startsWith(candidate)) {
        this.typedBuffer = candidate;
        target.progress = candidate.length;
        target.hit = 0.12;
        this.correctKeys++;
        this.score += Math.ceil(2 * this.combo * (this.doubleTimer > 0 ? 2 : 1));
        this.audio.beep('correct');
        if (candidate === target.prompt.text) this.completeTarget(target);
      } else {
        if (this.accuracyShield <= 0) {
          this.wrongKeys++;
          this.combo = 1;
          this.totalKeys++;
        }
        target.shake = 0.28;
        this.audio.beep('wrong');
      }
      this.updateHud(true);
    }
    completeTarget(target) {
      this.wordsTyped++;
      if (target.boss) {
        const damage = target.prompt.text.length + 24 + this.app.save.upgrades.boss * 8;
        target.hp -= damage;
        target.phase = Math.min(target.maxPhase, target.phase + 1);
        target.progress = 0;
        this.typedBuffer = '';
        this.combo += 1;
        this.score += Math.ceil(damage * 8 * this.combo * (this.doubleTimer > 0 ? 2 : 1));
        this.spawnParticles(target.x, target.y, '#ffe066', 20);
        if (target.hp <= 0 || target.phase > target.maxPhase) {
          this.removeEnemy(target, true);
          this.bossDefeated = true;
        } else {
          target.prompt = this.promptManager.getPrompt({ difficulty: 9 + this.worldIndex, worldIndex: this.worldIndex, boss: true, seed: this.seed + target.phase * 101 });
          target.maxHp = Math.max(target.maxHp, target.hp);
          target.shake = 0.35;
          this.spawnMinions(2 + Math.floor(target.phase / 2));
        }
      } else {
        this.removeEnemy(target, true);
      }
      this.activeId = null;
      this.typedBuffer = '';
      this.audio.beep(this.combo % 6 === 0 ? 'combo' : 'defeat');
    }
    removeEnemy(target, scored) {
      const idx = this.enemies.indexOf(target);
      if (idx >= 0) this.enemies.splice(idx, 1);
      if (scored) {
        this.combo += 1;
        this.score += Math.ceil((target.prompt.text.length * 13 + target.value) * (1 + this.app.save.upgrades.combo * 0.05) * (this.doubleTimer > 0 ? 2 : 1));
        this.spawnParticles(target.x, target.y, target.boss ? '#ffcf4a' : '#ffffff', target.boss ? 36 : 12);
      }
      if (this.activeId === target.id) { this.activeId = null; this.typedBuffer = ''; }
    }
    spawnMinions(count) {
      for (let i = 0; i < count && this.enemies.length < this.maxEnemies; i++) this.spawnEnemy(true);
    }
    spawnEnemy(minion = false) {
      if (this.enemies.length >= this.maxEnemies) return;
      const world = WORLDS[this.worldIndex];
      const type = choice(world.enemies, this.rand);
      const id = ++this.enemyId;
      const size = minion ? 24 + this.rand() * 8 : 28 + this.rand() * 20;
      const yMin = Math.max(92, this.h * 0.16);
      const yMax = Math.max(yMin + 30, this.h - 95);
      const prompt = this.promptManager.getPrompt({ difficulty: this.difficulty + (minion ? -1 : 0), worldIndex: this.worldIndex, kids: this.kids, seed: this.seed + id * 23 });
      this.enemies.push({
        id,
        type,
        recipe: this.spriteFactory.recipe(this.worldIndex, this.seed + id * 45, type, false),
        prompt,
        x: this.w + size + this.rand() * 120,
        y: lerp(yMin, yMax, this.rand()),
        baseY: 0,
        size,
        speed: (22 + this.difficulty * 5 + this.rand() * 24) * (this.mode.includes('Ranked') ? 1.12 : 1),
        hp: prompt.text.length,
        maxHp: prompt.text.length,
        progress: 0,
        value: 20 + Math.floor(this.difficulty * 7),
        wave: this.wave,
        hit: 0,
        shake: 0,
        boss: false,
        phase: 1
      });
    }
    spawnBoss() {
      if (this.bossSpawned) return;
      this.bossSpawned = true;
      const world = WORLDS[this.worldIndex];
      const prompt = this.promptManager.getPrompt({ difficulty: 10, worldIndex: this.worldIndex, boss: true, seed: this.seed });
      const hp = 260 + this.worldIndex * 45 + this.levelIndex * 25;
      this.enemies.push({
        id: ++this.enemyId,
        type: world.boss,
        recipe: this.spriteFactory.recipe(this.worldIndex, this.seed + 999, world.boss, true),
        prompt,
        x: this.w + 160,
        y: this.h * 0.46,
        baseY: this.h * 0.46,
        size: clamp(76 + this.worldIndex * 4, 76, 124),
        speed: 12 + this.worldIndex * 1.6,
        hp,
        maxHp: hp,
        progress: 0,
        value: 700 + this.worldIndex * 140,
        hit: 0,
        shake: 0,
        boss: true,
        phase: 1,
        maxPhase: 6,
        cinematic: 2.6
      });
    }
    spawnParticles(x, y, color, count = 10) {
      if (this.app.settings.reduceMotion) count = Math.ceil(count / 3);
      for (let i = 0; i < count; i++) {
        const a = this.rand() * Math.PI * 2;
        const sp = 40 + this.rand() * 180;
        this.particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.45 + this.rand() * 0.6, max: 1, color, r: 2 + this.rand() * 5 });
      }
    }
    pause() {
      if (!this.running || this.resultShown) return;
      this.paused = true;
      this.app.showOverlay('pauseOverlay');
    }
    resume() {
      this.paused = false;
      this.app.hideOverlay('pauseOverlay');
      this.app.focusTyping();
    }
    restart() {
      this.start({ mode: this.mode, worldIndex: this.worldIndex, levelIndex: this.levelIndex, multiplayer: this.multiplayer, room: this.room, seed: Date.now() % 1000000000 });
    }
    update(dt) {
      if (!this.running || this.paused || this.resultShown) return;
      this.timer += dt;
      this.freezeTimer = Math.max(0, this.freezeTimer - dt);
      this.slowTimer = Math.max(0, this.slowTimer - dt);
      this.doubleTimer = Math.max(0, this.doubleTimer - dt);
      this.accuracyShield = Math.max(0, this.accuracyShield - dt);
      Object.keys(this.powerCooldowns).forEach(k => this.powerCooldowns[k] = Math.max(0, this.powerCooldowns[k] - dt));
      if (this.isBossLevel) {
        if (!this.bossSpawned && this.timer > 1.2) this.spawnBoss();
      } else {
        this.spawnTimer -= dt;
        const spawnEvery = clamp(1.55 - this.difficulty * 0.07, 0.55, 1.55);
        if (this.spawnTimer <= 0 && this.spawnedInWave < this.maxPerWave) {
          this.spawnEnemy(false);
          this.spawnedInWave++;
          this.spawnTimer = spawnEvery + this.rand() * 0.35;
        }
        if (this.spawnedInWave >= this.maxPerWave && this.enemies.length === 0 && this.wave < this.wavesTotal) {
          this.wave++;
          this.spawnedInWave = 0;
          this.maxPerWave = clamp(this.maxPerWave + 2, 5, 24);
          this.spawnTimer = 1.1;
        }
      }

      const motion = this.freezeTimer > 0 ? 0 : (this.slowTimer > 0 ? 0.42 : 1);
      for (const e of [...this.enemies]) {
        e.hit = Math.max(0, e.hit - dt * 3);
        e.shake = Math.max(0, e.shake - dt * 2.8);
        e.cinematic = Math.max(0, (e.cinematic || 0) - dt);
        if (e.boss && e.cinematic > 0) {
          e.x = lerp(this.w + 160, this.w * 0.72, 1 - e.cinematic / 2.6);
        } else {
          e.x -= e.speed * motion * dt;
          e.y += Math.sin(this.timer * 2 + e.id) * dt * 18;
        }
        if (!e.boss && e.x < 92) {
          this.baseHealth -= e.boss ? 30 : clamp(8 + this.difficulty * 1.4, 8, 22);
          this.spawnParticles(94, e.y, '#ff5b7f', 12);
          this.removeEnemy(e, false);
          this.combo = 1;
          this.audio.beep('hit');
        }
        if (e.boss && e.x < 130) {
          this.baseHealth -= 35;
          e.x = this.w * 0.65;
          e.shake = 0.5;
        }
      }
      for (const p of [...this.particles]) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 120 * dt;
        if (p.life <= 0) this.particles.splice(this.particles.indexOf(p), 1);
      }
      this.updateAI(dt);
      if (this.baseHealth <= 0) this.finishLevel('gameover');
      else if (this.isBossLevel && this.bossSpawned && !this.enemies.some(e => e.boss) && this.bossDefeated) this.finishLevel('complete');
      else if (!this.isBossLevel && this.wave >= this.wavesTotal && this.spawnedInWave >= this.maxPerWave && this.enemies.length === 0) this.finishLevel('complete');
      if (now() - this.lastHud > 120) this.updateHud();
      this.sendNetwork(dt);
    }
    updateAI(dt) {
      const skillMap = {
        easy: [20, 35, 88], medium: [35, 55, 91], hard: [55, 80, 94], expert: [80, 110, 96]
      };
      for (const player of this.players.filter(p => p.isAI)) {
        const profile = skillMap[player.skill || 'medium'] || skillMap.medium;
        let timer = this.aiTimers.get(player.id) || 0;
        timer -= dt;
        if (timer <= 0) {
          const enemy = this.enemies.filter(e => !e.boss).sort((a, b) => a.x - b.x)[0] || this.enemies[0];
          const wpm = lerp(profile[0], profile[1], this.rand());
          const cps = wpm * 5 / 60;
          const promptLen = enemy ? enemy.prompt.text.length : 8 + this.rand() * 10;
          const mistake = this.rand() * 100 > profile[2];
          timer = clamp(promptLen / cps, 0.85, 9) * (mistake ? 1.32 : 1);
          if (enemy && this.mode !== 'Ranked Speed Battle' && this.rand() > 0.42 && !enemy.boss) this.damageEnemy(enemy, enemy.hp + 1);
          player.score = Math.floor((player.score || 0) + promptLen * (mistake ? 4 : 10) + wpm * 0.25);
          player.combo = mistake ? 1 : clamp((player.combo || 1) + 1, 1, 60);
          player.accuracy = clamp((player.accuracy || 96) + (mistake ? -0.8 : 0.08), 72, 99.8);
          player.status = mistake ? 'recovering' : 'typing';
        }
        this.aiTimers.set(player.id, timer);
      }
    }
    sendNetwork() {
      if (!this.multiplayer) return;
      const t = now();
      if (t - this.lastStatsSend > 450) {
        this.lastStatsSend = t;
        this.app.multiplayer.stats({ score: this.score, combo: this.combo, accuracy: this.accuracy(), lives: this.baseHealthPercent(), status: this.paused ? 'paused' : 'playing' });
      }
      if (this.isHost && t - this.lastSnapshotSend > 900) {
        this.lastSnapshotSend = t;
        this.app.multiplayer.snapshot({
          wave: this.wave,
          timer: this.timer,
          health: this.baseHealthPercent(),
          enemies: this.enemies.slice(0, 30).map(e => ({ id: e.id, x: Math.round(e.x), y: Math.round(e.y), p: e.prompt.text, hp: Math.round(e.hp), b: !!e.boss }))
        });
      }
    }
    accuracy() {
      return this.totalKeys ? clamp((this.correctKeys / Math.max(1, this.correctKeys + this.wrongKeys)) * 100, 0, 100) : 100;
    }
    wpm() {
      const minutes = Math.max(1 / 60, (now() - this.startedAt) / 60000);
      return Math.round((this.correctKeys / 5) / minutes);
    }
    baseHealthPercent() { return Math.round(clamp((this.baseHealth / this.baseHealthMax) * 100, 0, 100)); }
    finishLevel(result, fromServer = false) {
      if (this.resultShown) return;
      this.resultShown = true;
      this.running = false;
      const complete = result === 'complete';
      const perfect = complete && this.wrongKeys === 0 && this.baseHealth >= this.baseHealthMax;
      const coins = complete ? Math.ceil(this.score / 80 + 35 + this.levelIndex * 4) : Math.ceil(this.score / 160);
      const pearls = perfect ? 1 : 0;
      if (!this.multiplayer || !fromServer) {
        this.app.awardProgress({ coins, pearls, complete, perfect, globalLevel: this.levelNumber, score: this.score });
      }
      if (this.multiplayer && !fromServer) this.app.multiplayer.complete(result, { score: this.score, accuracy: this.accuracy(), wpm: this.wpm(), coins, pearls });
      this.audio.beep(complete ? 'complete' : 'over');
      this.app.showResult({ result, score: this.score, combo: this.combo, accuracy: this.accuracy(), wpm: this.wpm(), coins, pearls, perfect, multiplayer: this.multiplayer });
    }
    updateHud(force = false) {
      const t = now();
      if (!force && t - this.lastHud < 100) return;
      this.lastHud = t;
      $('hudScore').textContent = Math.floor(this.score).toLocaleString();
      $('hudCombo').textContent = `x${this.combo}`;
      $('hudAccuracy').textContent = `${Math.round(this.accuracy())}%`;
      $('hudWpm').textContent = String(this.wpm());
      $('hudLevel').textContent = `${this.worldIndex + 1}-${this.levelIndex + 1}`;
      $('hudHealth').textContent = String(Math.max(0, Math.round(this.baseHealth)));
      $('hudWave').textContent = `${this.wave}/${this.wavesTotal}`;
      $('hudTimer').textContent = formatTime(this.timer);
      const target = this.getTarget();
      $('hudTarget').textContent = target ? target.prompt.text : 'None';
      this.renderLeaderboard();
      this.updatePowerButtons();
    }
    updatePowerButtons() {
      $$('#powerButtons .power-btn').forEach(btn => {
        const cd = this.powerCooldowns[btn.dataset.power] || 0;
        btn.disabled = cd > 0 || this.paused;
        const power = POWERUPS.find(p => p.id === btn.dataset.power);
        btn.textContent = cd > 0 ? `${power.icon} ${Math.ceil(cd)}s` : `${power.icon} ${power.name}`;
      });
    }
    renderLeaderboard() {
      const you = { id: this.app.multiplayer.playerId || 'local', name: 'You', isAI: false, score: this.score, combo: this.combo, accuracy: this.accuracy(), lives: this.baseHealthPercent(), status: this.paused ? 'paused' : 'playing' };
      const others = this.players.filter(p => p.id !== you.id && p.id !== 'local');
      const list = [you, ...others].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, MAX_ROOM_PLAYERS);
      $('leaderboard').innerHTML = list.map((p, i) => `<div class="leader-row"><span>${i + 1}. ${p.isAI ? 'AI ' : ''}${p.name || 'Player'}<br><small>${Math.round(p.accuracy ?? 100)}% • x${p.combo || 1}</small></span><b>${Math.floor(p.score || 0)}</b></div>`).join('');
    }
    loop(ts) {
      const dt = Math.min(0.05, ((ts || now()) - (this.lastTs || ts || now())) / 1000 || 0.016);
      this.lastTs = ts || now();
      this.update(dt);
      this.draw();
      this.audio.tickMusic(this.running && !this.paused && this.app.currentScreen === 'gameScreen', this.worldIndex || 0);
      requestAnimationFrame(this.boundLoop);
    }
    draw() {
      const ctx = this.ctx;
      const world = WORLDS[this.worldIndex || 0];
      this.drawBackground(ctx, world);
      if (!this.running && !this.resultShown) return;
      this.drawBase(ctx);
      for (const e of this.enemies) this.drawEnemy(ctx, e);
      this.drawParticles(ctx);
      if (this.paused) {
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fillRect(0, 0, this.w, this.h);
      }
    }
    drawBackground(ctx, world) {
      const g = ctx.createLinearGradient(0, 0, 0, this.h);
      g.addColorStop(0, world.colors[0]);
      g.addColorStop(0.5, world.colors[1]);
      g.addColorStop(1, '#04204a');
      ctx.fillStyle = g; ctx.fillRect(0, 0, this.w, this.h);
      const t = this.timer || now() / 1000;
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = world.colors[2];
      for (let i = 0; i < 16; i++) {
        const x = (i * 173 + t * (10 + i % 4) * (this.app.settings.reduceMotion ? 0.2 : 1)) % (this.w + 120) - 80;
        const y = 80 + (i * 61) % Math.max(120, this.h - 160);
        ctx.beginPath(); ctx.arc(x, y + Math.sin(t + i) * 12, 3 + (i % 4), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.11)';
      for (let j = 0; j < 5; j++) {
        ctx.beginPath();
        const yy = this.h * (0.18 + j * 0.15);
        ctx.moveTo(0, yy);
        for (let x = 0; x <= this.w + 80; x += 80) ctx.quadraticCurveTo(x + 40, yy + Math.sin(t * 0.8 + x * 0.02 + j) * 14, x + 80, yy);
        ctx.lineTo(this.w, yy + 36); ctx.lineTo(0, yy + 36); ctx.closePath(); ctx.fill();
      }
      // Islands / ruins silhouettes
      ctx.fillStyle = 'rgba(2,18,42,0.28)';
      for (let i = 0; i < 4; i++) {
        const x = (i * this.w * 0.29 + 80) % this.w;
        const y = this.h - 44 - (i % 2) * 22;
        ctx.beginPath(); ctx.ellipse(x, y, 120, 28, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(x - 12, y - 92, 24, 92);
        ctx.beginPath(); ctx.arc(x - 18, y - 94, 34, 0, Math.PI * 2); ctx.arc(x + 18, y - 98, 30, 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.font = '800 12px system-ui';
      ctx.fillText(`${world.name} • ${world.effect} • ${world.mood}`, 16, this.h - 16);
    }
    drawBase(ctx) {
      const x = 62, y = this.h * 0.5;
      ctx.save();
      ctx.fillStyle = 'rgba(255,224,102,0.25)';
      ctx.beginPath(); ctx.arc(x, y, 70, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe066';
      ctx.strokeStyle = '#08213e'; ctx.lineWidth = 4;
      roundRect(ctx, x - 38, y - 35, 70, 70, 18); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#0f7ee8';
      ctx.beginPath(); ctx.arc(x - 8, y - 8, 10, 0, Math.PI * 2); ctx.arc(x + 16, y - 8, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#46f4a8';
      const hpw = 90 * clamp(this.baseHealth / this.baseHealthMax, 0, 1);
      roundRect(ctx, x - 45, y + 52, 90, 10, 6); ctx.stroke();
      roundRect(ctx, x - 45, y + 52, hpw, 10, 6); ctx.fill();
      ctx.restore();
    }
    drawEnemy(ctx, e) {
      const t = this.timer || now() / 1000;
      const isTarget = e.id === this.activeId;
      this.spriteFactory.draw(ctx, e.recipe, e.x + Math.sin(t * 10) * e.shake * 8, e.y, e.size, t, e.hit);
      if (isTarget) {
        ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 3; ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.ellipse(e.x, e.y, e.size * 1.25, e.size * 0.9, 0, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
      }
      this.drawPrompt(ctx, e, isTarget);
      if (e.boss) this.drawBossBar(ctx, e);
    }
    drawPrompt(ctx, e, isTarget) {
      const text = e.prompt.text;
      const typed = isTarget ? this.typedBuffer : text.slice(0, e.progress || 0);
      const sizeBoost = this.app.settings.bigText ? 4 : 0;
      ctx.save();
      ctx.font = `900 ${clamp(15 + sizeBoost + (e.boss ? 3 : 0), 14, 24)}px system-ui`;
      const pad = 10;
      const w = Math.min(this.w * 0.62, ctx.measureText(text).width + pad * 2);
      const h = e.boss ? 34 : 30;
      let x = clamp(e.x - w / 2, 8, this.w - w - 8);
      let y = clamp(e.y - e.size - 44, 58, this.h - 80);
      if (e.shake) x += Math.sin(now() * 0.08) * e.shake * 12;
      ctx.fillStyle = isTarget ? 'rgba(5, 24, 56, 0.88)' : 'rgba(5, 24, 56, 0.68)';
      ctx.strokeStyle = isTarget ? '#ffe066' : 'rgba(255,255,255,0.22)';
      ctx.lineWidth = isTarget ? 2 : 1;
      roundRect(ctx, x, y, w, h, 12); ctx.fill(); ctx.stroke();
      ctx.beginPath();
      const prog = clamp((e.progress || 0) / Math.max(1, text.length), 0, 1);
      roundRect(ctx, x + 3, y + h - 5, (w - 6) * prog, 3, 3); ctx.fillStyle = '#46f4a8'; ctx.fill();
      ctx.fillStyle = '#46f4a8';
      ctx.textBaseline = 'middle';
      const tx = x + pad, ty = y + h / 2;
      ctx.save(); ctx.beginPath(); roundRect(ctx, x + 4, y, w - 8, h, 10); ctx.clip();
      ctx.fillText(typed, tx, ty);
      const typedW = ctx.measureText(typed).width;
      ctx.fillStyle = '#ffffff'; ctx.fillText(text.slice(typed.length), tx + typedW, ty);
      ctx.restore(); ctx.restore();
    }
    drawBossBar(ctx, e) {
      const w = Math.min(this.w * 0.52, 520), x = this.w / 2 - w / 2, y = 58;
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.42)'; roundRect(ctx, x, y, w, 20, 10); ctx.fill();
      ctx.fillStyle = '#ff5b7f'; roundRect(ctx, x + 3, y + 3, (w - 6) * clamp(e.hp / e.maxHp, 0, 1), 14, 8); ctx.fill();
      ctx.strokeStyle = '#ffe066'; ctx.lineWidth = 2; roundRect(ctx, x, y, w, 20, 10); ctx.stroke();
      ctx.fillStyle = '#ffffff'; ctx.font = '900 13px system-ui'; ctx.textAlign = 'center'; ctx.fillText(`${WORLDS[this.worldIndex].boss} • Phase ${e.phase}/${e.maxPhase}`, this.w / 2, y - 8);
      ctx.restore();
    }
    drawParticles(ctx) {
      ctx.save();
      for (const p of this.particles) {
        ctx.globalAlpha = clamp(p.life / p.max, 0, 1);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }
  }

  class TypeStormApp {
    constructor() {
      this.settings = Store.loadSettings();
      this.save = Store.loadSave();
      this.promptManager = new PromptManager();
      this.spriteFactory = new SpriteFactory();
      this.audio = new AudioEngine(this.settings);
      this.state = { mode: 'Solo Adventure', previousScreen: 'mainMenu', playerName: localStorage.getItem('typestorm_player_name') || `Player${Math.floor(Math.random() * 900 + 100)}`, returnToPause: false };
      this.currentScreen = 'loadingScreen';
      this.multiplayer = new MultiplayerManager(this);
      this.game = null;
      this.boot();
    }
    boot() {
      this.applySettingsClass();
      this.bindUI();
      this.populateModes();
      this.populateWorldMap();
      this.populateShop();
      this.populateLobbySelectors();
      if ($('playerNameInput')) $('playerNameInput').value = this.state.playerName;
      this.updateWorldPreview();
      this.buildKeyboard();
      this.loadSettingsIntoUI();
      let progress = 0;
      const tips = [
        `Generated ${this.promptManager.count().toLocaleString()} safe typing prompts.`,
        `Sprite recipe system supports ${this.spriteFactory.variationCount().toLocaleString()}+ visual combinations.`,
        'Offline AI uses realistic WPM and accuracy ranges.',
        'Render multiplayer is powered by Express and Socket.IO.'
      ];
      const timer = setInterval(() => {
        progress += 18 + Math.random() * 14;
        $('loadingFill').style.width = `${Math.min(100, progress)}%`;
        $('loadingTip').textContent = tips[Math.floor(progress / 28) % tips.length];
        if (progress >= 100) {
          clearInterval(timer);
          this.showScreen('mainMenu');
        }
      }, 220);
      this.game = new GameEngine(this);
    }
    bindUI() {
      document.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        this.audio.beep('click');
        if (btn.dataset.action) this.handleAction(btn.dataset.action, btn);
        if (btn.dataset.createMode) this.createRoom(btn.dataset.createMode);
        if (btn.dataset.joinCode) this.joinRoom(btn.dataset.joinCode);
        if (btn.dataset.mode) this.selectMode(btn.dataset.mode);
        if (btn.dataset.vote) this.handleVote(btn.dataset.vote);
        if (btn.dataset.level) {
          const [w, l] = btn.dataset.level.split(':').map(Number);
          if (!btn.disabled) this.startGame({ mode: this.state.mode || 'Solo Adventure', worldIndex: w, levelIndex: l });
        }
        if (btn.dataset.buy) this.buyItem(btn.dataset.buy);
      });
      document.addEventListener('keydown', (e) => {
        if (this.currentScreen !== 'gameScreen') return;
        if (['Backspace', 'Enter', 'Escape'].includes(e.key) || e.key.length === 1) {
          e.preventDefault();
          this.game.handleKey(e.key);
        }
      }, { capture: true });
      const hidden = $('hiddenTypingInput');
      hidden.addEventListener('input', () => {
        const v = hidden.value;
        if (v) [...v].forEach(ch => this.game.handleKey(ch));
        hidden.value = '';
      });
      hidden.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' || e.key === 'Enter') { e.preventDefault(); this.game.handleKey(e.key); }
      });
      ['musicVolume', 'sfxVolume', 'fontSize', 'reduceMotion', 'bigText', 'highContrast', 'mobileKeyboardToggle', 'muteToggle'].forEach(id => {
        $(id).addEventListener('input', () => this.saveSettingsFromUI());
        $(id).addEventListener('change', () => this.saveSettingsFromUI());
      });
      if ($('playerNameInput')) {
        $('playerNameInput').addEventListener('input', () => this.syncPlayerName());
        $('playerNameInput').addEventListener('change', () => this.syncPlayerName());
      }
      ['lobbyWorldSelect', 'lobbyLevelSelect', 'lobbyModeSelect'].forEach(id => {
        if ($(id)) $(id).addEventListener('change', () => this.updateWorldPreview());
      });
      window.addEventListener('pointerdown', () => this.audio.ensure(), { once: true });
    }
    handleAction(action) {
      const map = {
        openModes: () => this.showScreen('modeScreen'),
        backMenu: () => this.showScreen('mainMenu'),
        openWorldMap: () => { this.populateWorldMap(); this.showScreen('worldMapScreen'); },
        openShop: () => { this.populateShop(); this.showScreen('shopScreen'); },
        openSettings: () => this.showScreen('settingsScreen'),
        openHelp: () => this.showScreen('helpScreen'),
        quickPlay: () => this.quickPlay(),
        backSmart: () => this.backSmart(),
        createRoom: () => this.createRoom(),
        joinRoom: () => this.joinRoom(),
        refreshRooms: () => this.refreshRooms(),
        leaveLobby: () => this.leaveLobby(),
        copyRoomCode: () => this.copyRoomCode(),
        hostStartMatch: () => this.hostStartMatch(),
        pauseGame: () => this.game.pause(),
        resumeGame: () => this.game.resume(),
        restartLevel: () => this.game.restart(),
        openSettingsFromPause: () => this.openSettingsFromPause(),
        quitToLobbyOrMenu: () => this.quitToLobbyOrMenu(),
        resetSettings: () => this.resetSettings(),
        fullscreen: () => this.fullscreen()
      };
      if (map[action]) map[action]();
    }
    showScreen(id) {
      if (this.currentScreen && this.currentScreen !== id) this.state.previousScreen = this.currentScreen;
      $$('.screen').forEach(s => s.classList.toggle('active', s.id === id));
      this.currentScreen = id;
      this.updateKeyboardVisibility();
      if (id === 'gameScreen') setTimeout(() => this.focusTyping(), 50);
      if (id !== 'gameScreen') this.hideOverlay('pauseOverlay');
    }
    showOverlay(id) { $(id).classList.add('active'); }
    hideOverlay(id) { $(id).classList.remove('active'); }
    focusTyping() {
      if (this.settings.mobileKeyboard) $('hiddenTypingInput').focus({ preventScroll: true });
    }
    setRoomStatus(text) { if ($('roomStatus')) $('roomStatus').textContent = text || ''; }
    updateServerBadge(online) {
      const badge = $('serverBadge');
      if (!badge) return;
      badge.textContent = online ? 'Online ✓' : 'Offline AI Ready';
      badge.classList.toggle('offline', !online);
    }
    syncPlayerName() {
      const input = $('playerNameInput');
      const clean = String(input?.value || '').replace(/[<>]/g, '').trim().slice(0, 18) || `Player${Math.floor(Math.random() * 900 + 100)}`;
      this.state.playerName = clean;
      localStorage.setItem('typestorm_player_name', clean);
      if (input && input.value !== clean) input.value = clean;
      return clean;
    }
    refreshRooms() {
      this.multiplayer.requestRooms();
      this.setRoomStatus(this.multiplayer.connected ? 'Refreshing live rooms…' : 'Server offline. You can still play offline AI modes.');
    }
    populateModes() {
      $('modeGrid').innerHTML = GAME_MODES.map(m => `<button class="menu-card ${m.name === 'Solo Adventure' ? 'primary' : ''}" data-mode="${m.name}"><strong>${m.name}</strong><span>${m.desc}</span></button>`).join('');
    }
    populateLobbySelectors() {
      $('lobbyWorldSelect').innerHTML = WORLDS.map((w, i) => `<option value="${i}">${i + 1}. ${w.name}</option>`).join('');
      $('lobbyLevelSelect').innerHTML = Array.from({ length: 11 }, (_, i) => `<option value="${i}">${i + 1}${i === 10 ? ' Boss' : ''}</option>`).join('');
      $('lobbyModeSelect').innerHTML = GAME_MODES.filter(m => m.online).map(m => `<option>${m.name}</option>`).join('');
    }
    updateWorldPreview() {
      const box = $('lobbyWorldPreview');
      if (!box) return;
      const wi = Number($('lobbyWorldSelect')?.value || 0);
      const li = Number($('lobbyLevelSelect')?.value || 0);
      const w = WORLDS[wi] || WORLDS[0];
      box.innerHTML = `<b>${w.name}</b><br>Level ${li + 1}${li === 10 ? ' Boss' : ''} • Boss: ${w.boss}<br>Effect: ${w.effect} • Difficulty: ${w.prompt}`;
    }
    selectMode(modeName) {
      this.state.mode = modeName;
      const mode = GAME_MODES.find(m => m.name === modeName) || GAME_MODES[0];
      if (mode.online) {
        $('lobbyModeSelect').value = modeName;
        this.updateWorldPreview();
        this.showScreen('roomScreen');
        this.refreshRooms();
      } else {
        this.startGame({ mode: modeName, worldIndex: 0, levelIndex: modeName === 'Boss Rush' ? 10 : 0 });
      }
    }
    quickPlay() {
      const global = clamp(this.save.unlockedGlobalLevel || 1, 1, 110) - 1;
      this.startGame({ mode: 'Solo Adventure', worldIndex: Math.floor(global / 11), levelIndex: global % 11 });
    }
    startGame(opts = {}) { this.game.start(opts); }
    startGameFromRoom(room, seed) {
      this.hideOverlay('resultOverlay');
      this.startGame({ mode: room.mode, worldIndex: room.worldIndex, levelIndex: room.levelIndex, multiplayer: true, room, seed });
    }
    populateWorldMap() {
      const unlocked = this.save.unlockedGlobalLevel || 1;
      $('worldMap').innerHTML = WORLDS.map((w, wi) => {
        const dots = Array.from({ length: 11 }, (_, li) => {
          const global = wi * 11 + li + 1;
          const isUnlocked = global <= unlocked;
          return `<button class="level-dot ${isUnlocked ? 'unlocked' : 'locked'} ${li === 10 ? 'boss' : ''}" data-level="${wi}:${li}" ${isUnlocked ? '' : 'disabled'}>${li === 10 ? '★' : li + 1}</button>`;
        }).join('');
        return `<article class="world-card" style="background:linear-gradient(135deg,${w.colors[0]},${w.colors[1]});"><h3>${wi + 1}. ${w.name}</h3><p>${w.prompt}. Boss: <b>${w.boss}</b>. Effect: ${w.effect}.</p><div class="level-dots">${dots}</div></article>`;
      }).join('');
    }
    populateShop() {
      $('coinCount').textContent = this.save.coins.toLocaleString();
      $('pearlCount').textContent = this.save.pearls.toLocaleString();
      $('playerLevel').textContent = this.save.playerLevel;
      $('shopGrid').innerHTML = SHOP_ITEMS.map(item => {
        const owned = this.save.owned.includes(item.id) && !item.upgrade;
        const level = item.upgrade ? (this.save.upgrades[item.upgrade] || 0) : 0;
        return `<article class="shop-item"><div class="shop-icon">${item.icon}</div><h3>${item.title}</h3><p>${item.type}${item.upgrade ? ` • Level ${level}` : ''}</p><button class="${owned ? 'secondary-btn' : 'primary-btn'}" data-buy="${item.id}" ${owned ? 'disabled' : ''}>${owned ? 'Owned' : `Buy ${item.price} ${item.currency}`}</button></article>`;
      }).join('');
    }
    buyItem(id) {
      const item = SHOP_ITEMS.find(x => x.id === id);
      if (!item) return;
      if (!item.upgrade && this.save.owned.includes(id)) return;
      if ((this.save[item.currency] || 0) < item.price) {
        this.toast(`Need more ${item.currency}.`);
        return;
      }
      this.save[item.currency] -= item.price;
      if (item.upgrade) this.save.upgrades[item.upgrade] = (this.save.upgrades[item.upgrade] || 0) + 1;
      else this.save.owned.push(id);
      Store.saveGame(this.save);
      this.populateShop();
      this.toast(`${item.title} unlocked!`);
    }
    awardProgress({ coins, pearls, complete, perfect, globalLevel, score }) {
      this.save.coins += coins;
      this.save.pearls += pearls;
      this.save.xp += Math.floor(score / 50) + (complete ? 25 : 5);
      this.save.playerLevel = 1 + Math.floor(this.save.xp / 260);
      if (complete) this.save.unlockedGlobalLevel = Math.max(this.save.unlockedGlobalLevel || 1, Math.min(110, globalLevel + 1));
      const key = `L${globalLevel}`;
      this.save.best[key] = Math.max(this.save.best[key] || 0, score);
      Store.saveGame(this.save);
    }
    showResult(data) {
      $('resultTitle').textContent = data.result === 'complete' ? (data.perfect ? 'Perfect Level!' : 'Level Complete!') : 'Game Over';
      $('resultSummary').textContent = data.result === 'complete' ? `You earned ${data.coins} coins${data.pearls ? ` and ${data.pearls} pearl` : ''}.` : `The base fell, but you still earned ${data.coins} coins.`;
      $('resultStats').innerHTML = [
        ['Score', Math.floor(data.score).toLocaleString()], ['Combo', `x${data.combo}`], ['Accuracy', `${Math.round(data.accuracy)}%`], ['WPM', Math.round(data.wpm)], ['Coins', `+${data.coins}`], ['Pearls', `+${data.pearls}`]
      ].map(([a, b]) => `<div class="result-stat"><b>${b}</b><br><span>${a}</span></div>`).join('');
      $('voteStatus').textContent = data.multiplayer ? 'Vote with your room. Players stay connected after retry/next.' : '';
      this.showOverlay('resultOverlay');
    }
    async handleVote(vote) {
      if (this.game?.multiplayer) {
        $('voteStatus').textContent = 'Vote sent. Waiting for room...';
        await this.multiplayer.vote(vote);
        return;
      }
      this.hideOverlay('resultOverlay');
      if (vote === 'retry') this.game.restart();
      if (vote === 'next') {
        let wi = this.game.worldIndex, li = this.game.levelIndex + 1;
        if (li > 10) { wi = Math.min(9, wi + 1); li = 0; }
        this.startGame({ mode: this.game.mode, worldIndex: wi, levelIndex: li });
      }
      if (vote === 'lobby') this.showScreen('mainMenu');
    }
    showVoteStatus(payload) {
      const c = payload.counts || {};
      $('voteStatus').textContent = `Votes: Next ${c.next || 0}, Retry ${c.retry || 0}, Lobby ${c.lobby || 0} / ${payload.needed || 1}`;
    }
    handleVoteAdvance(payload) {
      this.hideOverlay('resultOverlay');
      if (payload.action === 'lobby') {
        this.renderLobby(payload.room);
        this.showScreen('lobbyScreen');
      } else {
        const room = payload.room;
        this.startGame({ mode: room.mode, worldIndex: room.worldIndex, levelIndex: room.levelIndex, multiplayer: true, room, seed: Date.now() % 1000000000 });
      }
    }
    renderRoomList(rooms = []) {
      const list = $('roomList');
      if (!list) return;
      const openRooms = rooms.filter(r => r && r.code);
      if (!openRooms.length) {
        list.innerHTML = '<div class="empty-room">No open rooms yet. Create one and share the code.</div>';
        return;
      }
      list.innerHTML = openRooms.map(r => {
        const w = WORLDS[r.worldIndex || 0] || WORLDS[0];
        const count = Array.isArray(r.players) ? r.players.filter(p => !p.isAI).length : (r.humans || 0);
        return `<button class="room-tile" data-join-code="${r.code}" aria-label="Join room ${r.code}">
          <span><strong>${r.mode || 'Multiplayer Survival'}</strong><small>${w.name} • Level ${(r.levelIndex || 0) + 1}<br>${count}/${MAX_ROOM_PLAYERS} players • Host: ${r.hostName || 'Player'}</small></span>
          <span class="code-mini">${r.code}</span>
          <span class="join-mini secondary-btn">Join This Game</span>
        </button>`;
      }).join('');
    }
    renderLobby(room) {
      if (!room) return;
      if ($('lobbyCodePill')) $('lobbyCodePill').textContent = room.code || '';
      if ($('lobbyInfo')) $('lobbyInfo').textContent = `${room.mode || 'Multiplayer Survival'} • ${WORLDS[room.worldIndex || 0]?.name || 'Island'} • Level ${(room.levelIndex || 0) + 1}`;
      if ($('hostBadge')) $('hostBadge').textContent = this.multiplayer.isHost() ? 'You are Host' : 'Waiting for Host';
      if ($('startMatchBtn')) {
        $('startMatchBtn').disabled = !this.multiplayer.isHost();
        $('startMatchBtn').textContent = this.multiplayer.isHost() ? 'Start Match' : 'Waiting For Host';
      }
      if ($('lobbyWorldSelect')) $('lobbyWorldSelect').value = String(room.worldIndex || 0);
      if ($('lobbyLevelSelect')) $('lobbyLevelSelect').value = String(room.levelIndex || 0);
      if ($('lobbyModeSelect') && room.mode) $('lobbyModeSelect').value = room.mode;
      this.updateWorldPreview();
      $('lobbyPlayers').innerHTML = room.players.map((p, i) => {
        const rowClass = p.isAI ? 'ai-row' : p.id === room.hostId ? 'host-row' : '';
        const face = p.isAI ? '🤖' : (p.id === this.multiplayer.playerId ? '🧑‍🚀' : '🌊');
        const label = p.isAI ? `${p.skill || 'AI'} fill` : p.id === room.hostId ? 'Host' : p.status || 'Ready';
        return `<div class="player-row ${rowClass}"><span class="avatar-dot">${face}</span><span><b>${p.name}</b><br><small>${label}</small></span><span>${Math.round(p.accuracy ?? 100)}%</span></div>`;
      }).join('');
    }
    async createRoom(modeOverride) {
      const name = this.syncPlayerName();
      const mode = modeOverride || $('lobbyModeSelect').value || this.state.mode || 'Multiplayer Survival';
      if ($('lobbyModeSelect') && [...$('lobbyModeSelect').options].some(o => o.value === mode)) $('lobbyModeSelect').value = mode;
      const res = await this.multiplayer.createRoom({ name, mode, worldIndex: Number($('lobbyWorldSelect').value || 0), levelIndex: Number($('lobbyLevelSelect').value || 0) });
      if (!res.ok) return this.setRoomStatus(res.error);
      this.renderLobby(res.room); this.showScreen('lobbyScreen');
    }
    async joinRoom(codeOverride) {
      const code = String(codeOverride || $('roomCodeInput').value || '').trim().toUpperCase();
      if (!code) return this.setRoomStatus('Enter a room code first.');
      if ($('roomCodeInput')) $('roomCodeInput').value = code;
      const res = await this.multiplayer.joinRoom({ code, name: this.syncPlayerName() });
      if (!res.ok) return this.setRoomStatus(res.error);
      this.renderLobby(res.room); this.showScreen('lobbyScreen');
    }
    async hostStartMatch() {
      const payload = { mode: $('lobbyModeSelect').value, worldIndex: Number($('lobbyWorldSelect').value), levelIndex: Number($('lobbyLevelSelect').value), aiFill: $('aiFillToggle').checked };
      const res = await this.multiplayer.startRoom(payload);
      if (!res.ok) this.toast(res.error || 'Could not start room.');
    }
    async leaveLobby() { await this.multiplayer.leaveRoom(); this.showScreen('roomScreen'); }
    copyRoomCode() {
      const code = this.multiplayer.room?.code || $('lobbyCodePill').textContent;
      if (navigator.clipboard && code) navigator.clipboard.writeText(code).then(() => this.toast('Room code copied.'));
      else this.toast(`Room code: ${code}`);
    }
    quitToLobbyOrMenu() {
      this.hideOverlay('pauseOverlay');
      if (this.game?.multiplayer && this.multiplayer.room) this.showScreen('lobbyScreen');
      else this.showScreen('mainMenu');
    }
    openSettingsFromPause() {
      this.state.returnToPause = true;
      this.hideOverlay('pauseOverlay');
      this.showScreen('settingsScreen');
    }
    backSmart() {
      if (this.state.returnToPause) {
        this.state.returnToPause = false;
        this.showScreen('gameScreen');
        this.showOverlay('pauseOverlay');
      } else {
        this.showScreen(this.state.previousScreen && this.state.previousScreen !== 'loadingScreen' ? this.state.previousScreen : 'mainMenu');
      }
    }
    loadSettingsIntoUI() {
      $('musicVolume').value = this.settings.musicVolume;
      $('sfxVolume').value = this.settings.sfxVolume;
      $('fontSize').value = this.settings.fontSize;
      $('reduceMotion').checked = this.settings.reduceMotion;
      $('bigText').checked = this.settings.bigText;
      $('highContrast').checked = this.settings.highContrast;
      $('mobileKeyboardToggle').checked = this.settings.mobileKeyboard;
      $('muteToggle').checked = this.settings.mute;
      this.updateKeyboardVisibility();
    }
    saveSettingsFromUI() {
      this.settings.musicVolume = Number($('musicVolume').value);
      this.settings.sfxVolume = Number($('sfxVolume').value);
      this.settings.fontSize = $('fontSize').value;
      this.settings.reduceMotion = $('reduceMotion').checked;
      this.settings.bigText = $('bigText').checked;
      this.settings.highContrast = $('highContrast').checked;
      this.settings.mobileKeyboard = $('mobileKeyboardToggle').checked;
      this.settings.mute = $('muteToggle').checked;
      this.audio.settings = this.settings;
      Store.saveSettings(this.settings);
      this.applySettingsClass();
      this.updateKeyboardVisibility();
    }
    resetSettings() {
      this.settings = { ...DEFAULT_SETTINGS };
      this.audio.settings = this.settings;
      Store.saveSettings(this.settings);
      this.loadSettingsIntoUI();
      this.applySettingsClass();
    }
    applySettingsClass() {
      document.body.classList.toggle('reduce-motion', !!this.settings.reduceMotion);
      document.body.classList.toggle('big-text', !!this.settings.bigText);
      document.body.classList.toggle('high-contrast', !!this.settings.highContrast);
      document.body.classList.toggle('font-large', this.settings.fontSize === 'large');
      document.body.classList.toggle('font-huge', this.settings.fontSize === 'huge');
    }
    updateKeyboardVisibility() {
      $('mobileKeyboard').classList.toggle('visible', !!this.settings.mobileKeyboard && this.currentScreen === 'gameScreen');
    }
    buildKeyboard() {
      const rows = ['1234567890', 'qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
      $('mobileKeyboard').innerHTML = rows.map(row => `<div class="key-row">${[...row].map(ch => `<button class="key-btn" data-key="${ch}">${ch}</button>`).join('')}</div>`).join('') + `<div class="key-row"><button class="key-btn wide" data-key="Backspace">⌫</button><button class="key-btn wide" data-key=" ">Space</button><button class="key-btn wide" data-key="Enter">Enter</button></div>`;
      $('mobileKeyboard').addEventListener('click', (e) => {
        const btn = e.target.closest('[data-key]');
        if (!btn) return;
        this.game.handleKey(btn.dataset.key);
        this.focusTyping();
      });
    }
    fullscreen() {
      const el = document.documentElement;
      if (!document.fullscreenElement && el.requestFullscreen) el.requestFullscreen().catch(() => this.toast('Fullscreen was blocked by this browser.'));
      else if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
    toast(message) {
      const old = document.querySelector('.toast');
      if (old) old.remove();
      const div = document.createElement('div');
      div.className = 'toast';
      div.textContent = message;
      Object.assign(div.style, { position: 'fixed', left: '50%', bottom: 'calc(22px + env(safe-area-inset-bottom))', transform: 'translateX(-50%)', zIndex: 80, padding: '12px 16px', borderRadius: '999px', background: 'rgba(0,0,0,.72)', color: 'white', fontWeight: '900', boxShadow: '0 12px 30px rgba(0,0,0,.25)' });
      document.body.appendChild(div);
      setTimeout(() => div.remove(), 2200);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    window.TypeStorm = new TypeStormApp();
  });
})();
