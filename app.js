const socket = io();
const $ = id => document.getElementById(id);
let myId = null, room = null, state = null;

const params = new URLSearchParams(location.search);
if (params.get("room")) {
  $("joinBox").classList.remove("hidden");
  $("code").value = params.get("room").toUpperCase();
}

$("create").onclick = () => socket.emit("createRoom", {name:$("name").value}, handleJoin);
$("join").onclick = () => $("joinBox").classList.toggle("hidden");
$("joinNow").onclick = () => socket.emit("joinRoom", {code:$("code").value, name:$("name").value}, handleJoin);

function handleJoin(res) {
  if (!res.ok) return $("error").textContent = res.error;
  myId = res.id; room = res.code;
  $("lobby").classList.add("hidden");
  $("game").classList.remove("hidden");
  $("roomBadge").classList.remove("hidden");
  $("roomBadge").textContent = "ROOM " + room;
  $("roomCode").textContent = room;
  history.replaceState({}, "", "?room=" + room);
}

$("start").onclick = () => socket.emit("startGame");
$("roll").onclick = () => socket.emit("roll");
$("buy").onclick = () => socket.emit("buy");
$("copy").onclick = async () => {
  const url = location.origin + "/?room=" + room;
  await navigator.clipboard.writeText(url);
  $("copy").textContent = "コピーしました！";
  setTimeout(() => $("copy").textContent = "招待URLをコピー", 1400);
};

socket.on("state", s => { state=s; render(); });

function render() {
  if (!state) return;
  renderBoard();
  $("players").innerHTML = state.players.map(p => `
    <div class="player ${p.alive ? "" : "dead"}">
      <span class="dot" style="background:${p.color}"></span>
      <span>${escapeHtml(p.name)}${p.id===myId ? "（自分）" : ""}</span>
      <span class="money">$${p.money}</span>
    </div>`).join("");

  const current = state.players[state.current];
  $("turn").textContent = state.winner ? `🏆 ${state.winner} の勝利！` :
    state.started ? `現在のターン: ${current?.name || ""}` : "2人以上そろったらゲーム開始！";
  $("roll").disabled = !state.started || !current || current.id !== myId;
  $("buy").disabled = !state.started || !current || current.id !== myId;
  $("start").disabled = state.started || state.players.length < 2;
  $("log").innerHTML = state.log.map(x => `<div>${escapeHtml(x)}</div>`).join("");
  $("log").scrollTop = $("log").scrollHeight;
}

function renderBoard() {
  const owners = {};
  state.players.forEach(p => p.properties.forEach(pos => owners[pos]=p));
  $("board").innerHTML = state.spaces.map((s,i) => {
    const here = state.players.filter(p=>p.pos===i);
    const owner = owners[i];
    return `<div class="space ${s.type} ${state.players[state.current]?.pos===i && state.started ? "current":""}">
      <h3>${s.name}</h3>
      ${s.price ? `<div class="price">価格 $${s.price} / 通行料 $${s.rent}</div>` : ""}
      ${s.amount ? `<div class="price">$${s.amount}</div>` : ""}
      ${owner ? `<div class="price">所有: ${escapeHtml(owner.name)}</div>` : ""}
      <div>${here.map(p=>`<span class="token" style="background:${p.color}" title="${escapeHtml(p.name)}">${escapeHtml(p.name[0])}</span>`).join("")}</div>
    </div>`;
  }).join("");
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}