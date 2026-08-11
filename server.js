import express from "express";
import http from "http";
import { Server } from "socket.io";
import crypto from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = http.createServer(app);
const io = new Server(server);
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

const rooms = new Map();
const COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f"];

const spaces = [
  { name:"スタート", type:"start" },
  { name:"さくら通り", type:"property", price:120, rent:20 },
  { name:"イベント", type:"event" },
  { name:"海辺通り", type:"property", price:140, rent:25 },
  { name:"休憩所", type:"rest" },
  { name:"山手通り", type:"property", price:160, rent:30 },
  { name:"チャンス", type:"event" },
  { name:"港通り", type:"property", price:180, rent:35 },
  { name:"税金", type:"tax", amount:100 },
  { name:"中央公園", type:"property", price:200, rent:40 },
  { name:"スタジアム", type:"property", price:220, rent:45 },
  { name:"イベント", type:"event" }
];

function newRoom() {
  return {
    players: {},
    current: 0,
    started: false,
    winner: null,
    log: ["ルームを作成しました。友達を招待できます。"]
  };
}

function publicRoom(room) {
  return {
    players: Object.values(room.players).map(p => ({...p})),
    current: room.current,
    started: room.started,
    winner: room.winner,
    log: room.log.slice(-12),
    spaces
  };
}

function broadcast(code) {
  const room = rooms.get(code);
  if (room) io.to(code).emit("state", publicRoom(room));
}

function addLog(room, text) {
  room.log.push(text);
  if (room.log.length > 30) room.log.shift();
}

function livingPlayers(room) {
  return Object.values(room.players).filter(p => p.alive);
}

function nextTurn(room) {
  const ps = Object.values(room.players);
  if (!ps.length) return;
  for (let i = 1; i <= ps.length; i++) {
    const idx = (room.current + i) % ps.length;
    if (ps[idx]?.alive) {
      room.current = idx;
      return;
    }
  }
}

function checkWinner(room) {
  const alive = livingPlayers(room);
  if (alive.length === 1 && Object.keys(room.players).length >= 2) {
    room.winner = alive[0].name;
    room.started = false;
    addLog(room, `🏆 ${alive[0].name} の勝利！`);
  }
}

io.on("connection", socket => {
  socket.on("createRoom", ({name}, cb) => {
    const code = crypto.randomBytes(3).toString("hex").toUpperCase();
    const room = newRoom();
    rooms.set(code, room);
    joinPlayer(socket, code, name, cb);
  });

  socket.on("joinRoom", ({code, name}, cb) => {
    code = String(code || "").trim().toUpperCase();
    const room = rooms.get(code);
    if (!room) return cb({ok:false, error:"ルームが見つかりません。"});
    if (room.started) return cb({ok:false, error:"このゲームはすでに開始しています。"});
    if (Object.keys(room.players).length >= 4) return cb({ok:false, error:"このルームは満員です。"});
    joinPlayer(socket, code, name, cb);
  });

  function joinPlayer(socket, code, name, cb) {
    const room = rooms.get(code);
    name = String(name || "").trim().slice(0, 12) || `プレイヤー${Object.keys(room.players).length+1}`;
    const id = socket.id;
    room.players[id] = {
      id, name, color: COLORS[Object.keys(room.players).length % COLORS.length],
      money: 1500, pos: 0, properties: [], alive: true
    };
    socket.join(code);
    socket.data.room = code;
    socket.data.player = id;
    addLog(room, `${name} が参加しました。`);
    cb({ok:true, code, id});
    broadcast(code);
  }

  socket.on("startGame", () => {
    const code = socket.data.room, room = rooms.get(code);
    if (!room || Object.keys(room.players).length < 2) return;
    room.started = true;
    room.winner = null;
    room.current = 0;
    addLog(room, "🎮 ゲーム開始！");
    broadcast(code);
  });

  socket.on("roll", () => {
    const code = socket.data.room, room = rooms.get(code);
    if (!room || !room.started) return;
    const player = room.players[socket.id];
    const ps = Object.values(room.players);
    if (!player || ps[room.current]?.id !== socket.id || !player.alive) return;

    const dice = Math.floor(Math.random()*6)+1;
    const old = player.pos;
    player.pos = (player.pos + dice) % spaces.length;
    if (player.pos < old) {
      player.money += 200;
      addLog(room, `💵 ${player.name} はスタートを通過して $200！`);
    }
    addLog(room, `🎲 ${player.name} は ${dice} を出して ${spaces[player.pos].name} へ。`);

    const s = spaces[player.pos];
    if (s.type === "property") {
      const owner = Object.values(room.players).find(p => p.properties.includes(player.pos));
      if (!owner && player.money >= s.price) {
        // 購入は別ボタン
      } else if (owner && owner.id !== player.id) {
        const pay = Math.min(player.money, s.rent);
        player.money -= pay;
        owner.money += pay;
        addLog(room, `💸 ${player.name} は ${owner.name} に $${pay} 支払いました。`);
      }
    } else if (s.type === "tax") {
      const pay = Math.min(player.money, s.amount);
      player.money -= pay;
      addLog(room, `🧾 ${player.name} は税金 $${pay} を支払いました。`);
    } else if (s.type === "event") {
      const delta = Math.random() < 0.5 ? 150 : -100;
      player.money += delta;
      addLog(room, `${delta > 0 ? "🎁" : "💥"} ${player.name} のイベント: ${delta > 0 ? "+" : ""}$${delta}`);
    }

    if (player.money <= 0) {
      player.money = 0;
      player.alive = false;
      addLog(room, `😵 ${player.name} は脱落しました。`);
    }
    checkWinner(room);
    if (room.started && !room.winner) nextTurn(room);
    broadcast(code);
  });

  socket.on("buy", () => {
    const code = socket.data.room, room = rooms.get(code);
    if (!room || !room.started) return;
    const player = room.players[socket.id];
    if (!player || Object.values(room.players)[room.current]?.id !== socket.id) return;
    const s = spaces[player.pos];
    if (s.type !== "property" || player.money < s.price) return;
    const owner = Object.values(room.players).find(p => p.properties.includes(player.pos));
    if (owner) return;
    player.money -= s.price;
    player.properties.push(player.pos);
    addLog(room, `🏠 ${player.name} が ${s.name} を $${s.price} で購入！`);
    broadcast(code);
  });

  socket.on("disconnect", () => {
    const code = socket.data.room, room = rooms.get(code);
    if (!room) return;
    const p = room.players[socket.id];
    if (p) {
      delete room.players[socket.id];
      addLog(room, `${p.name} が退出しました。`);
      if (Object.keys(room.players).length === 0) rooms.delete(code);
      else {
        room.current = 0;
        broadcast(code);
      }
    }
  });
});

app.get("*splat", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));