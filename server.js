const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 25000,
  pingInterval: 10000,
  maxHttpBufferSize: 1e6
});

const PORT = process.env.PORT || 3000;
const MAX_PLAYERS = 4;
const WORLD_COUNT = 110;
const ROOM_TTL_MS = 1000 * 60 * 60 * 4;
const rooms = new Map();

app.use((req, res, next) => {
  // Prevent Safari/Render/GitHub update mismatches from serving an old index with a new game.js.
  if (req.path === '/' || req.path.endsWith('.html')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  } else if (/\.(?:js|css)$/i.test(req.path)) {
    res.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate');
  }
  next();
});

app.use(express.static(path.join(__dirname), { maxAge: 0, etag: false }));
app.get('/health', (_req, res) => res.json({ ok: true, rooms: rooms.size }));
app.get('*', (_req, res) => res.sendFile(path.join(__dirname, 'index.html')));

function makeCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (rooms.has(code));
  return code;
}

function safeName(name) {
  const cleaned = String(name || '').replace(/[<>]/g, '').trim().slice(0, 18);
  return cleaned || 'Player';
}

function makeAi(slot = 1) {
  const names = ['CoralBot', 'PearlPilot', 'BubbleByte', 'ReefRacer', 'LagoonLex', 'TideTyper', 'FinFocus'];
  const skill = ['easy', 'medium', 'hard', 'expert'][Math.min(3, Math.floor(Math.random() * 4))];
  return {
    id: `ai_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`,
    socketId: null,
    name: names[(slot + Math.floor(Math.random() * names.length)) % names.length],
    isAI: true,
    skill,
    score: 0,
    combo: 1,
    accuracy: 100,
    lives: 100,
    status: 'ready',
    connected: true
  };
}

function publicRoom(room) {
  return {
    code: room.code,
    hostId: room.hostId,
    hostName: room.players.find(p => p.id === room.hostId)?.name || 'Player',
    mode: room.mode,
    worldIndex: room.worldIndex,
    levelIndex: room.levelIndex,
    seed: room.seed || null,
    phase: room.phase,
    createdAt: room.createdAt,
    players: room.players.map(p => ({
      id: p.id,
      name: p.name,
      isAI: !!p.isAI,
      skill: p.skill || null,
      score: p.score || 0,
      combo: p.combo || 1,
      accuracy: p.accuracy ?? 100,
      lives: p.lives ?? 100,
      status: p.status || 'lobby',
      connected: p.connected !== false,
      shieldUntil: p.shieldUntil || 0,
      replacedHuman: !!p.replacedHuman
    })),
    votes: room.votes || {}
  };
}

function publicRooms() {
  return [...rooms.values()]
    .filter(room => room.phase === 'lobby' && room.players.filter(p => !p.isAI).length < MAX_PLAYERS)
    .map(room => {
      const pub = publicRoom(room);
      pub.humans = room.players.filter(p => !p.isAI).length;
      return pub;
    })
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 20);
}

function emitRoomList() {
  io.emit('room:list', publicRooms());
}

function emitRoom(room) {
  io.to(room.code).emit('room:update', publicRoom(room));
}

function findRoomAndPlayer(socket) {
  for (const room of rooms.values()) {
    const player = room.players.find(p => p.socketId === socket.id);
    if (player) return { room, player };
  }
  return { room: null, player: null };
}

function fillAI(room) {
  while (room.players.length < MAX_PLAYERS) {
    room.players.push(makeAi(room.players.length + 1));
  }
}

function removeExcessAI(room) {
  const humans = room.players.filter(p => !p.isAI);
  const ai = room.players.filter(p => p.isAI);
  room.players = [...humans, ...ai].slice(0, MAX_PLAYERS);
}


function votingHumans(room) {
  return room.players.filter(p => !p.isAI && p.connected !== false && p.socketId);
}

function resetForAdvance(room, action) {
  room.votes = {};
  room.latestSnapshot = null;
  if (action === 'next') {
    room.levelIndex += 1;
    if (room.levelIndex > 10) {
      room.levelIndex = 0;
      room.worldIndex = Math.min(WORLD_COUNT - 1, room.worldIndex + 1);
    }
  }
  if (action === 'next' || action === 'retry') {
    room.phase = 'playing';
    room.seed = Math.floor(Math.random() * 1000000000);
    room.players.forEach(p => {
      p.lives = 100;
      p.status = (p.connected === false || p.replacedHuman) ? 'ai-replaced' : (p.isAI ? 'ai-watching' : 'playing');
    });
    io.to(room.code).emit('match:advance', { action, room: publicRoom(room), seed: room.seed });
  } else {
    room.phase = 'lobby';
    room.players = room.players.filter(p => !p.isAI && p.connected !== false && p.socketId);
    if (room.players.length && !room.players.some(p => p.id === room.hostId)) {
      room.hostId = room.players[0].id;
      room.hostSocketId = room.players[0].socketId;
    }
    room.players.forEach(p => (p.status = room.hostId === p.id ? 'host' : 'ready'));
    io.to(room.code).emit('match:advance', { action, room: publicRoom(room) });
  }
  emitRoom(room);
  emitRoomList();
}

function processVotes(room) {
  if (!room || !rooms.has(room.code)) return;
  const humans = votingHumans(room);
  if (humans.length === 0) {
    rooms.delete(room.code);
    emitRoomList();
    return;
  }
  room.votes = room.votes || {};
  const activeIds = new Set(humans.map(p => p.id));
  for (const id of Object.keys(room.votes)) if (!activeIds.has(id)) delete room.votes[id];
  const humanVotes = humans.map(p => room.votes[p.id]).filter(Boolean);
  const counts = humanVotes.reduce((acc, v) => ((acc[v] = (acc[v] || 0) + 1), acc), {});
  io.to(room.code).emit('room:votes', { votes: room.votes, counts, needed: humans.length });
  if (room.phase === 'results' && humanVotes.length >= humans.length) {
    const order = ['next', 'retry', 'lobby'];
    const nextAction = order.sort((a, b) => ((counts[b] || 0) - (counts[a] || 0)) || (order.indexOf(a) - order.indexOf(b)))[0];
    resetForAdvance(room, nextAction);
  }
}

io.on('connection', socket => {
  socket.emit('room:list', publicRooms());
  socket.on('room:list', () => socket.emit('room:list', publicRooms()));

  socket.on('room:create', (payload = {}, ack) => {
    try {
      const code = makeCode();
      const player = {
        id: `p_${socket.id}`,
        socketId: socket.id,
        name: safeName(payload.name),
        isAI: false,
        score: 0,
        combo: 1,
        accuracy: 100,
        lives: 100,
        status: 'host',
        connected: true
      };
      const room = {
        code,
        hostId: player.id,
        hostSocketId: socket.id,
        mode: payload.mode || 'Multiplayer Survival',
        worldIndex: Number(payload.worldIndex || 0),
        levelIndex: Number(payload.levelIndex || 0),
        phase: 'lobby',
        players: [player],
        votes: {},
        seed: null,
        latestSnapshot: null,
        createdAt: Date.now(),
        lastSeen: Date.now()
      };
      rooms.set(code, room);
      socket.join(code);
      ack && ack({ ok: true, room: publicRoom(room), playerId: player.id });
      emitRoom(room);
      emitRoomList();
    } catch (err) {
      ack && ack({ ok: false, error: err.message || 'Could not create room.' });
    }
  });

  socket.on('room:join', (payload = {}, ack) => {
    try {
      const code = String(payload.code || '').trim().toUpperCase();
      const room = rooms.get(code);
      if (!room) return ack && ack({ ok: false, error: 'Room code not found.' });
      room.lastSeen = Date.now();
      const humans = room.players.filter(p => !p.isAI).length;
      if (humans >= MAX_PLAYERS) return ack && ack({ ok: false, error: 'Room is full.' });

      const aiIndex = room.players.findIndex(p => p.isAI);
      const player = {
        id: `p_${socket.id}`,
        socketId: socket.id,
        name: safeName(payload.name),
        isAI: false,
        score: 0,
        combo: 1,
        accuracy: 100,
        lives: 100,
        status: room.phase === 'lobby' ? 'ready' : 'spectating',
        connected: true
      };
      if (aiIndex >= 0) room.players.splice(aiIndex, 1, player);
      else room.players.push(player);
      removeExcessAI(room);
      socket.join(code);
      ack && ack({ ok: true, room: publicRoom(room), playerId: player.id });
      emitRoom(room);
      emitRoomList();
    } catch (err) {
      ack && ack({ ok: false, error: err.message || 'Could not join room.' });
    }
  });

  socket.on('room:leave', (_payload = {}, ack) => {
    const { room, player } = findRoomAndPlayer(socket);
    if (room && player) {
      room.players = room.players.filter(p => p.id !== player.id);
      delete (room.votes || {})[player.id];
      socket.leave(room.code);
      if (room.hostId === player.id) {
        const nextHuman = room.players.find(p => !p.isAI && p.connected !== false && p.socketId);
        room.hostId = nextHuman ? nextHuman.id : room.players[0]?.id;
        room.hostSocketId = nextHuman ? nextHuman.socketId : null;
      }
      if (votingHumans(room).length === 0) rooms.delete(room.code);
      else {
        emitRoom(room);
        if (room.phase === 'results') processVotes(room);
      }
    }
    emitRoomList();
    ack && ack({ ok: true });
  });

  socket.on('room:start', (payload = {}, ack) => {
    const { room, player } = findRoomAndPlayer(socket);
    if (!room || !player) return ack && ack({ ok: false, error: 'Not in a room.' });
    if (room.hostId !== player.id) return ack && ack({ ok: false, error: 'Only the host can start.' });
    room.mode = payload.mode || room.mode;
    room.worldIndex = Number(payload.worldIndex || room.worldIndex || 0);
    room.levelIndex = Number(payload.levelIndex || room.levelIndex || 0);
    room.phase = 'playing';
    room.votes = {};
    room.seed = Math.floor(Math.random() * 1000000000);
    if (payload.aiFill !== false) fillAI(room);
    room.players.forEach(p => {
      p.score = 0;
      p.combo = 1;
      p.accuracy = 100;
      p.lives = 100;
      p.status = p.isAI ? 'ai-active' : 'playing';
    });
    emitRoom(room);
    io.to(room.code).emit('match:start', {
      room: publicRoom(room),
      seed: room.seed,
      startedAt: Date.now()
    });
    emitRoomList();
    ack && ack({ ok: true });
  });

  socket.on('player:stats', (payload = {}) => {
    const { room, player } = findRoomAndPlayer(socket);
    if (!room || !player) return;
    player.score = Math.max(0, Math.floor(Number(payload.score || 0)));
    player.combo = Math.max(1, Math.floor(Number(payload.combo || 1)));
    player.accuracy = Math.max(0, Math.min(100, Number(payload.accuracy ?? 100)));
    player.lives = Math.max(0, Math.min(100, Number(payload.lives ?? 100)));
    if (payload.shield) player.shieldUntil = Date.now() + 3200;
    player.status = String(payload.status || 'playing').slice(0, 20);
    room.lastSeen = Date.now();
    socket.to(room.code).emit('player:stats', { id: player.id, score: player.score, combo: player.combo, accuracy: player.accuracy, lives: player.lives, status: player.status, shieldUntil: player.shieldUntil || 0 });
  });

  socket.on('game:snapshot', (payload = {}) => {
    const { room, player } = findRoomAndPlayer(socket);
    if (!room || !player || room.hostId !== player.id) return;
    if (payload.seed != null && Number(payload.seed) !== Number(room.seed)) return;
    room.latestSnapshot = {
      seed: room.seed,
      t: Date.now(),
      enemies: Array.isArray(payload.enemies) ? payload.enemies.slice(0, 60) : [],
      wave: Number(payload.wave || 1),
      timer: Number(payload.timer || 0),
      health: Number(payload.health ?? 100)
    };
    socket.to(room.code).emit('game:snapshot', room.latestSnapshot);
  });

  socket.on('game:event', (payload = {}) => {
    const { room, player } = findRoomAndPlayer(socket);
    if (!room || !player || room.phase !== 'playing') return;
    const allowed = new Set(['enemy-kill', 'enemy-progress', 'boss-damage', 'player-hit', 'player-down']);
    const type = String(payload.type || '');
    if (!allowed.has(type)) return;
    if (payload.seed != null && Number(payload.seed) !== Number(room.seed)) return;
    const evt = {
      type,
      by: player.id,
      t: Number(payload.t || Date.now()),
      enemyId: payload.enemyId != null ? Number(payload.enemyId) : null,
      playerId: payload.playerId ? String(payload.playerId).slice(0, 80) : null,
      damage: Number(payload.damage || 0),
      hp: payload.hp != null ? Number(payload.hp) : undefined,
      phase: payload.phase != null ? Number(payload.phase) : undefined,
      prompt: payload.prompt ? String(payload.prompt).slice(0, 120) : undefined,
      progress: payload.progress != null ? Number(payload.progress) : undefined,
      seed: room.seed
    };
    if (type === 'player-hit' || type === 'player-down') {
      // Only the host authoritatively decides damage/death so one player dying never ends a room by accident.
      if (room.hostId !== player.id) return;
    }
    if (type === 'player-hit' && evt.playerId) {
      const victim = room.players.find(p => p.id === evt.playerId);
      if (victim) {
        if (victim.shieldUntil && victim.shieldUntil > Date.now()) {
          victim.status = 'shielded';
          evt.damage = 0;
        } else {
          victim.lives = Math.max(0, Math.min(100, (victim.lives ?? 100) - Math.max(0, evt.damage || 0)));
          victim.status = victim.lives <= 0 ? 'down' : 'hit';
        }
      }
    }
    if (type === 'player-down' && evt.playerId) {
      const victim = room.players.find(p => p.id === evt.playerId);
      if (victim) { victim.lives = 0; victim.status = 'down'; }
    }
    io.to(room.code).emit('game:event', evt);
    emitRoom(room);
  });

  socket.on('match:complete', (payload = {}) => {
    const { room, player } = findRoomAndPlayer(socket);
    if (!room || !player) return;
    if (room.phase === 'playing' && room.hostId !== player.id) return;
    room.phase = 'results';
    room.votes = {};
    io.to(room.code).emit('match:complete', {
      room: publicRoom(room),
      result: payload.result || 'complete',
      stats: payload.stats || {}
    });
    emitRoom(room);
  });

  socket.on('room:vote', (payload = {}, ack) => {
    const { room, player } = findRoomAndPlayer(socket);
    if (!room || !player) return ack && ack({ ok: false, error: 'Not in room.' });
    if (player.isAI || player.connected === false) return ack && ack({ ok: false, error: 'Only connected players vote.' });
    const vote = ['retry', 'next', 'lobby'].includes(payload.vote) ? payload.vote : 'retry';
    room.votes = room.votes || {};
    room.votes[player.id] = vote;
    processVotes(room);
    ack && ack({ ok: true });
  });

  socket.on('disconnect', () => {
    const { room, player } = findRoomAndPlayer(socket);
    if (!room || !player) return;
    socket.leave(room.code);
    const idx = room.players.findIndex(p => p.id === player.id);
    if (idx >= 0) {
      if (room.phase === 'playing' || room.phase === 'results') {
        const ai = makeAi(idx + 1);
        ai.name = `${safeName(player.name)} AI`;
        ai.score = player.score || 0;
        ai.combo = player.combo || 1;
        ai.accuracy = player.accuracy ?? 100;
        ai.lives = player.lives ?? 100;
        ai.status = 'ai-replaced';
        ai.connected = false;
        ai.replacedHuman = true;
        room.players.splice(idx, 1, ai);
      } else {
        room.players.splice(idx, 1);
      }
    }
    if (room.hostId === player.id) {
      const nextHuman = room.players.find(p => !p.isAI);
      if (nextHuman) {
        room.hostId = nextHuman.id;
        room.hostSocketId = nextHuman.socketId;
      } else if (room.players.length) {
        room.hostId = room.players[0].id;
        room.hostSocketId = null;
      }
    }
    if (votingHumans(room).length === 0 && room.phase !== 'playing') rooms.delete(room.code);
    else {
      emitRoom(room);
      if (room.phase === 'results') processVotes(room);
    }
    emitRoomList();
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.createdAt > ROOM_TTL_MS || (now - room.lastSeen > ROOM_TTL_MS && room.phase !== 'playing')) {
      rooms.delete(code);
      emitRoomList();
    }
  }
}, 1000 * 60 * 10);

server.listen(PORT, () => {
  console.log(`TypeStorm: Island Rush running on port ${PORT}`);
});
