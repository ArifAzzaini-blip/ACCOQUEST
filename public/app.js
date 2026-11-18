/* =========================================================
   ACCOQUEST - Frontend Game Controller
   Backend: Cloudflare Pages Function -> Google Apps Script
   ========================================================= */

/* -----------------------------
   1. DOM HELPERS & PLAYER DATA
----------------------------- */

const $ = (id) => document.getElementById(id);

const playerId =
    localStorage.getItem("aq_player_id") ||
    `P${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

let playerName = localStorage.getItem("aq_player_name") || "";
let lobbyId = localStorage.getItem("aq_lobby_id") || "";

const params = new URLSearchParams(window.location.search);
const forceHome = params.get("home") === "1";

if (forceHome) {
    localStorage.removeItem("aq_lobby_id");
    lobbyId = "";
    window.history.replaceState(null, "", "/");
}

localStorage.setItem("aq_player_id", playerId);

const pages = ["home", "lobby", "game", "result"];

let state = null;
let activeQuestion = null;
let selectedAnswer = null;
let pollTimer = null;
let countdown = null;
let seconds = 60;
let spinBusy = false;
let wheelRotation = 0;
const WHEEL_POINTS = [5, 10, 15, 20, 25, 30, 50, 0, -5, -10];
let questionLoading = false;
let urlQuestionId = params.get("qid") || params.get("questionId") || params.get("id");
let urlQuestionLoaded = false;
let isSubmitting = false;

$("username").value = playerName;
$("usernameHome").value = playerName;


/* -----------------------------
   2. GENERAL UI HELPERS
----------------------------- */

function show(pageId) {
    pages.forEach((page) => {
        $(page).classList.toggle("hidden", page !== pageId);
    });

    const menuButton = $("menuHomeBtn");

    if (menuButton) {
        menuButton.classList.toggle("hidden", pageId === "home");
    }
}

function toast(message) {
    const element = $("toast");

    element.textContent = message;
    element.classList.remove("hidden");

    clearTimeout(toast.timer);

    toast.timer = setTimeout(() => {
        element.classList.add("hidden");
    }, 3500);
}

function escapeHTML(value = "") {
    return String(value).replace(/[&<>"']/g, (character) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        };

        return entities[character];
    });
}

function setButtonLoading(button, loadingText, originalText, isLoading) {
    button.disabled = isLoading;
    button.textContent = isLoading ? loadingText : originalText;
}

function stopGameTimers() {
    clearInterval(pollTimer);
    clearInterval(countdown);

    pollTimer = null;
    countdown = null;
}


/* -----------------------------
   3. SKELETON LOADING
----------------------------- */

function renderLobbySkeleton() {
    $("lobbyCode").classList.add("skeleton");
    $("lobbyCode").textContent = "------";

    $("playerCount").classList.add("skeleton");
    $("playersList").innerHTML = `
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
    `;
}

function clearLobbySkeleton() {
    $("lobbyCode").classList.remove("skeleton");
    $("playerCount").classList.remove("skeleton");
}

function renderQuestionSkeleton() {
    questionLoading = true;

    $("scanArea").classList.add("hidden");
    $("questionBox").classList.remove("hidden");

    $("qId").textContent = "";
    $("qCategory").textContent = "";

    $("qText").classList.add("skeleton-question");
    $("qText").textContent = " ";

    $("answers").innerHTML = `
        <div class="skeleton-answer"></div>
        <div class="skeleton-answer"></div>
        <div class="skeleton-answer"></div>
        <div class="skeleton-answer"></div>
    `;

    $("submitAnswer").disabled = true;
}


/* -----------------------------
   4. BACKEND API
----------------------------- */

async function gas(action, data = {}) {
    const response = await fetch("/api/game", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            action,
            data
        })
    });

    let payload;

    try {
        payload = await response.json();
    } catch (error) {
        throw new Error("Server returned an invalid response.");
    }

    if (!response.ok || payload.ok === false) {
        throw new Error(
            payload.error || `API error ${response.status}`
        );
    }

    return Object.prototype.hasOwnProperty.call(payload, "data")
        ? payload.data
        : payload;
}

async function act(action, data = {}) {
    try {
        return await gas(action, data);
    } catch (error) {
        toast(error.message || "Something went wrong.");
        throw error;
    }
}


/* -----------------------------
   5. PLAYER IDENTITY
----------------------------- */

function nameInput() {
    const homeVisible = !$("home").classList.contains("hidden");
    const input = homeVisible
        ? $("usernameHome")
        : $("username");

    const name = input.value.trim();

    if (name.length < 2) {
        toast("Username minimum 2 aksara.");
        input.focus();
        return false;
    }

    playerName = name;

    $("username").value = name;
    $("usernameHome").value = name;

    localStorage.setItem("aq_player_name", name);

    return true;
}


/* -----------------------------
   6. GAME STATE & POLLING
----------------------------- */

function startPolling() {
    clearInterval(pollTimer);

    poll();
    pollTimer = setInterval(poll, 1800);
}

async function poll() {
    if (!lobbyId) return;

    try {
        state = await gas("getGameState", {
            lobbyId,
            playerId
        });

        // Jangan render semula ketika Wheel sedang berpusing.
        if (spinBusy || isSubmitting) return;

        renderState();

        if (
            urlQuestionId &&
            !urlQuestionLoaded &&
            state.game?.isMyTurn &&
            state.game.phase === "question"
        ) {
            urlQuestionLoaded = true;

            loadQuestion(urlQuestionId).catch(() => {
                urlQuestionLoaded = false;
            });
        }

    } catch (error) {
        toast(error.message);
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

function renderState() {
    if (!state) {
        return;
    }

    if (state.status === "waiting") {
        show("lobby");
        renderLobby();
        return;
    }

    if (state.status === "playing") {
        show("game");
        renderGame();
        return;
    }

    if (state.status === "finished") {
        show("result");
        renderFinal();
    }
}


/* -----------------------------
   7. LOBBY RENDERING
----------------------------- */

function renderLobby() {
    clearLobbySkeleton();

    $("lobbyCode").textContent = state.lobbyId;
    $("playerCount").textContent = `${state.players.length}/4`;

    $("playersList").innerHTML = state.players.map((player) => `
        <div class="player-card">
            <div>
                <div class="player-name">
                    ${escapeHTML(player.name)}
                    ${player.host ? "(HOST)" : ""}
                </div>

                <div class="player-sub">
                    ${player.ready ? "Ready to play" : "Waiting for ready"}
                </div>
            </div>

            <span class="${player.ready ? "ready-tag" : "wait-tag"}">
                ${player.ready ? "● READY" : "○ NOT READY"}
            </span>
        </div>
    `).join("");

    const allPlayersReady =
        state.players.length >= 2 &&
        state.players.length <= 4 &&
        state.players.every((player) => player.ready);

    $("readyBtn").disabled = !state.me;
    $("readyBtn").textContent =
        state.me && state.me.ready ? "NOT READY" : "READY";

    const isHost = state.hostId === playerId;

    $("startBtn").classList.toggle("hidden", !isHost);
    $("startBtn").disabled = !isHost || !allPlayersReady;

    if (state.players.length < 2) {
        $("lobbyHint").textContent =
            "Menunggu sekurang-kurangnya 2 pemain.";
    } else if (allPlayersReady) {
        $("lobbyHint").textContent =
            "Semua pemain bersedia. Host boleh mula.";
    } else {
        $("lobbyHint").textContent =
            "Pastikan semua pemain menekan READY.";
    }
}


/* -----------------------------
   8. GAME SCREEN RENDERING
----------------------------- */

function renderGame() {
    const game = state?.game;

    if (!game) {
        return;
    }

    $("roundLabel").textContent =
        `ROUND ${game.round} / ${game.totalRounds}`;

    $("turnPlayer").textContent =
        game.currentPlayerName || "—";

    $("scanState").textContent =
        String(game.phase || "waiting").toUpperCase();

    const isMyTurn = Boolean(game.isMyTurn);
    const isQuestionPhase = game.phase === "question";
    const isBlockPhase = game.phase === "block";
    const isSpinPhase = game.phase === "spin";

    $("scanBtn").disabled = !isMyTurn || !isQuestionPhase;
    $("manualBtn").disabled = !isMyTurn || !isQuestionPhase;

    $("blockPanel").classList.toggle(
        "hidden",
        !isMyTurn || !isBlockPhase
    );

    $("spinPanel").classList.toggle(
        "hidden",
        !isMyTurn || !isSpinPhase
    );

    renderLeaderboard();

    if (isMyTurn && isQuestionPhase) {
        const hasQuestionInProgress =
            questionLoading || Boolean(activeQuestion);

        $("scanArea").classList.toggle(
            "hidden",
            hasQuestionInProgress
        );

        $("questionBox").classList.toggle(
            "hidden",
            !hasQuestionInProgress
        );
    } else {
        $("scanArea").classList.add("hidden");
        $("questionBox").classList.add("hidden");

        if (!isQuestionPhase) {
            activeQuestion = null;
            questionLoading = false;
        }
    }

    if (isMyTurn && isBlockPhase) {
        renderBlocks();
    }

    if (isMyTurn && isSpinPhase) {
        setupWheelLabels();
    }

    if (
        game.lastResult &&
        game.lastResult.playerId === playerId &&
        game.phase !== "question"
    ) {
        const feedback = $("answerFeedback");
        const feedbackKey = JSON.stringify(game.lastResult);
      
          if (feedback.dataset.feedbackKey !== feedbackKey) {
              feedback.dataset.feedbackKey = feedbackKey;
      
              if (game.lastResult.correct) {
                  feedback.textContent =
                      "✓ JAWAPAN BETUL! Tahniah! Jawapan anda tepat.";
              } else {
                  feedback.textContent =
                      "✗ JAWAPAN SALAH! Pilih block merah atau biru untuk meneruskan permainan.";
              }

              feedback.className =
                  `feedback ${game.lastResult.correct ? "correct" : "wrong"}`;
      
              feedback.classList.remove("hidden");
      
              clearTimeout(window.feedbackTimeout);
      
              window.feedbackTimeout = setTimeout(() => {
                  feedback.classList.add("hidden");
              }, 3000);
          }
      }
}

/* -----------------------------
   9. LEADERBOARD
----------------------------- */

function renderLeaderboard() {
    const scores = state?.game?.scores || [];

    $("leaderboardRows").innerHTML = scores.map((player, index) => `
        <div class="rank-row">
            <div class="rank-no">#${index + 1}</div>

            <div>
                <div class="rank-name">
                    ${escapeHTML(player.name)}
                </div>

                <div class="rank-stats">
                    ✓ ${player.correct}
                    &nbsp; ✕ ${player.wrong}
                </div>
            </div>

            <div class="rank-score">
                ${player.points}
            </div>
        </div>
    `).join("");
}


/* -----------------------------
   10. BLOCK SELECTION
----------------------------- */

function renderBlocks() {
    const game = state?.game || {};
    let blocks = Array.isArray(game.availableBlocks) ? [...game.availableBlocks] : [];
    const cooldown = Number(game.blueCooldownRounds || 0);

    // Client-side display fallback. Server validation in chooseBlock() remains authoritative.
    // Prefer the current player's own result, not a stale result from the previous turn.
    let result = game.lastResult &&
        String(game.lastResult.playerId || "") === String(game.currentPlayerId || "")
        ? game.lastResult : null;

    if (!result && Array.isArray(game.answerReview)) {
        for (let i = game.answerReview.length - 1; i >= 0; i--) {
            const item = game.answerReview[i];
            if (String(item.playerId || "") === String(game.currentPlayerId || "")) {
                result = { playerId: item.playerId, correct: !!item.correct };
                break;
            }
        }
    }

    if (blocks.length === 0 && game.phase === "block" &&
        game.isMyTurn && result) {
        if (result.correct) {
            blocks = ["GREEN"];
        } else {
            blocks = ["RED"];
            if (cooldown === 0) blocks.push("BLUE");
        }
    }

    const labels = {
        GREEN: ["GREEN", "POSITIVE ONLY", "✓"],
        BLUE: ["BLUE", "POSITIVE / NEGATIVE", "±"],
        RED: ["RED", "NEGATIVE / ZERO", "−"]
    };

    $("blockHint").textContent = result?.correct
        ? "Jawapan betul: block hijau sahaja tersedia."
        : "Jawapan salah: block merah atau biru tersedia. Block biru tertakluk pada cooldown 2 round.";

    $("blocks").innerHTML = ["GREEN", "BLUE", "RED"].map((block) => {
        const available = blocks.includes(block);
        const [name, desc, symbol] = labels[block];
        const note = block === "BLUE" && !available && cooldown > 0
            ? `<span class="block-cooldown">Boleh guna lagi selepas ${cooldown} round</span>`
            : "";
        return `
          <button class="block block-${block.toLowerCase()}" type="button"
            data-block="${block}" ${available ? "" : "disabled"}>
            <strong>${symbol}</strong><span>${name}</span><small>${desc}</small>${note}
          </button>`;
    }).join("");

    document.querySelectorAll(".block:not(:disabled)").forEach((button) => {
        button.addEventListener("click", async () => {
            button.disabled = true;
            try {
                await act("chooseBlock", {
                    lobbyId, playerId, block: button.dataset.block
                });
                await poll();
            } catch (error) {
                button.disabled = false;
            }
        });
    });
}


/* -----------------------------
   11. FINAL RESULTS
----------------------------- */

function renderFinal() {
    const scores = state?.game?.scores || [];
    const winner = scores[0];

    $("winnerBanner").innerHTML = `
        CHAMPION
        <strong>${escapeHTML(winner?.name || "—")}</strong>
        <span>${winner?.points || 0} POINTS</span>`;

    $("finalRows").innerHTML = scores.slice(0, 3).map((player, index) => {
        const medals = ["🥇", "🥈", "🥉"];
        return `<div class="final-row"><strong>${medals[index]} ${escapeHTML(player.name)}</strong><span>${player.points} pts</span></div>`;
    }).join("");

    const isHost = state?.hostId === playerId;
    $("playAgain").disabled = !isHost;
    $("playAgain").title = isHost ? "Mulakan semula dengan tetapan sama" : "Host sahaja boleh memulakan Replay";

    const review = state?.game?.answerReview || [];
    $("answerReview").innerHTML = review.length ? review.map((item, index) => `
      <div class="review-item">
        <strong>${index + 1}. ${escapeHTML(item.questionId || "Question")}</strong>
        <div>${escapeHTML(item.question || "")}</div>
        <div class="${item.correct ? "review-correct" : "review-wrong"}">
          ${item.correct ? "BETUL" : "SALAH"} · Jawapan anda: ${escapeHTML(item.answer || "Tiada jawapan")}
        </div>
        <div><strong>Jawapan sebenar: ${escapeHTML(item.correctAnswer || "—")}</strong></div>
        ${item.explanation ? `<div class="muted">${escapeHTML(item.explanation)}</div>` : ""}
      </div>`).join("") : `<p class="muted tiny">Tiada rekod jawapan.</p>`;
}


/* -----------------------------
   12. QUESTION LOADING
----------------------------- */

async function loadQuestion(questionId) {
    const id = String(questionId || "").trim();

    if (!id) {
        toast("Masukkan Question ID.");
        return;
    }

    if (questionLoading) {
        return;
    }

    questionLoading = true;
    renderQuestionSkeleton();

    try {
        const question = await act("getQuestion", {
            lobbyId,
            playerId,
            questionId: id
        });

        if (!question) {
            throw new Error("Soalan tidak dijumpai.");
        }

        const options = question.options || [
            question.optionA,
            question.optionB,
            question.optionC,
            question.optionD
        ];

        if (!Array.isArray(options) || options.length === 0) {
            throw new Error(
                "Pilihan jawapan tidak diterima daripada server."
            );
        }

        activeQuestion = {
            ...question,
            id: question.id || question.questionId || id,
            options
        };

        selectedAnswer = null;
        questionLoading = false;

        $("qId").textContent = activeQuestion.id;
        $("qCategory").textContent = activeQuestion.category || "";
        $("qText").classList.remove("skeleton-question");
        $("qText").textContent =
            activeQuestion.text || activeQuestion.question || "";

        $("answers").innerHTML = options.map((option, index) => `
            <button
                class="answer-option"
                type="button"
                data-answer="${"ABCD"[index]}"
            >
                <b>${"ABCD"[index]}.</b>
                ${escapeHTML(option)}
            </button>
        `).join("");

        document.querySelectorAll(".answer-option").forEach((button) => {
            button.addEventListener("click", () => {
                selectedAnswer = button.dataset.answer;

                document.querySelectorAll(".answer-option").forEach((item) => {
                    item.classList.toggle("selected", item === button);
                });

                $("submitAnswer").disabled = false;
            });
        });

        $("answerFeedback").classList.add("hidden");
        $("submitAnswer").disabled = true;

        $("scanArea").classList.add("hidden");
        $("questionBox").classList.remove("hidden");

        seconds = 30;
        $("timer").textContent = `${seconds}s`;

        clearInterval(countdown);

        countdown = setInterval(() => {
            seconds -= 1;
            $("timer").textContent = `${seconds}s`;

            if (seconds <= 0) {
                clearInterval(countdown);
                submitAnswer("TIMEOUT");
            }
        }, 1000);

    } catch (error) {
        questionLoading = false;
        activeQuestion = null;

        $("qText").classList.remove("skeleton-question");
        $("questionBox").classList.add("hidden");
        $("scanArea").classList.remove("hidden");

        toast(error.message || "Gagal memuatkan soalan.");
    }
}


/* -----------------------------
   13. NFC SCANNER
----------------------------- */

$("scanBtn").addEventListener("click", scanNfc);

async function scanNfc() {
    if (!("NDEFReader" in window)) {
        toast("Web NFC tidak tersedia pada browser ini. Pada iPhone, tap kad NFC yang mengandungi URL ACCOQUEST. Anda juga boleh masukkan Question ID secara manual.");
        return;
    }
    try {
        const reader = new NDEFReader();
        await reader.scan();
        toast("NFC aktif. Sentuhkan kad pada telefon.");
        reader.onreading = (event) => {
            for (const record of event.message.records) {
                if (record.recordType === "text") {
                    const bytes = new Uint8Array(record.data);
                    const langLength = bytes[0] & 0x3f;
                    const encoding = (bytes[0] & 0x80) ? "utf-16" : "utf-8";
                    const id = new TextDecoder(encoding).decode(bytes.slice(1 + langLength)).trim();
                    if (id) { loadQuestion(id); return; }
                }
                if (record.recordType === "url" || record.recordType === "absolute-url") {
                    let urlText = "";
                    if (record.recordType === "absolute-url") {
                        urlText = new TextDecoder().decode(record.data);
                    } else {
                        const bytes = new Uint8Array(record.data);
                        const prefixes = ["", "http://www.", "https://www.", "http://", "https://"];
                        urlText = (prefixes[bytes[0]] || "") + new TextDecoder().decode(bytes.slice(1));
                    }
                    try {
                        const url = new URL(urlText);
                        const id = url.searchParams.get("qid") || url.searchParams.get("questionId") || url.searchParams.get("id");
                        if (id) { loadQuestion(id); return; }
                    } catch (_) { toast("URL NFC tidak sah."); }
                }
            }
        };
        reader.onreadingerror = () => toast("Kad NFC gagal dibaca. Cuba sekali lagi.");
    } catch (error) {
        toast(`NFC gagal dimulakan: ${error.message}`);
    }
}


/* -----------------------------
   14. ANSWER SUBMISSION
----------------------------- */


async function submitAnswer(answer) {
    if (!activeQuestion || isSubmitting) return;
    isSubmitting = true;
    clearInterval(countdown);
    $("submitAnswer").disabled = true;

    try {
        const result = await act("submitAnswer", {
            lobbyId, playerId, questionId: activeQuestion.id, answer
        });
        if (!result || typeof result.correct !== "boolean") {
            throw new Error("Keputusan jawapan tidak diterima daripada server.");
        }

        document.querySelectorAll(".answer-option").forEach(button => {
            button.disabled = true;
            button.classList.remove("selected", "answer-correct", "answer-wrong");
            if (answer !== "TIMEOUT" && button.dataset.answer === String(answer).toUpperCase()) {
                button.classList.add(result.correct ? "answer-correct" : "answer-wrong");
            }
        });

        $("answerFeedback").textContent = result.correct
            ? "✓ JAWAPAN BETUL! Block hijau dibuka."
            : "✗ JAWAPAN SALAH! Block merah atau biru dibuka.";
        $("answerFeedback").className = `feedback ${result.correct ? "correct" : "wrong"}`;
        $("answerFeedback").classList.remove("hidden");

        await new Promise(resolve => setTimeout(resolve, 1100));
    } catch (error) {
        toast(error.message || "Gagal menghantar jawapan.");
        $("submitAnswer").disabled = false;
        return;
    } finally {
        isSubmitting = false;
    }
    await poll();
}

$("submitAnswer").addEventListener("click", () => {
    if (!selectedAnswer) {
        toast("Pilih jawapan dahulu.");
        return;
    }

    submitAnswer(selectedAnswer);
});

$("manualBtn").addEventListener("click", () => {
    loadQuestion($("questionId").value.trim());
});

/* -----------------------------
   15. CREATE & JOIN LOBBY
----------------------------- */

$("createBtn").addEventListener("click", async () => {
    if (!nameInput()) {
        return;
    }

    const button = $("createBtn");

    setButtonLoading(
        button,
        "CREATING LOBBY...",
        "CREATE LOBBY",
        true
    );

    show("lobby");
    renderLobbySkeleton();

    try {
        state = await act("createLobby", {
            playerId,
            name: playerName
        });

        lobbyId = state.lobbyId;

        localStorage.setItem("aq_lobby_id", lobbyId);

        renderState();
        startPolling();

    } catch (error) {
        show("home");
    } finally {
        setButtonLoading(
            button,
            "CREATING LOBBY...",
            "CREATE LOBBY",
            false
        );
    }
});

$("joinBtn").addEventListener("click", async () => {
    if (!nameInput()) {
        return;
    }

    const code = $("joinCode").value.trim();

    if (!/^\d{6}$/.test(code)) {
        toast("Masukkan kod tepat 6 digit.");
        return;
    }

    const button = $("joinBtn");

    setButtonLoading(button, "JOINING...", "JOIN", true);

    show("lobby");
    renderLobbySkeleton();

    try {
        state = await act("joinLobby", {
            lobbyId: code,
            playerId,
            name: playerName
        });

        lobbyId = code;

        localStorage.setItem("aq_lobby_id", lobbyId);

        renderState();
        startPolling();

    } catch (error) {
        show("home");
    } finally {
        setButtonLoading(button, "JOINING...", "JOIN", false);
    }
});


/* -----------------------------
   16. LOBBY CONTROLS
----------------------------- */

$("saveName").addEventListener("click", () => {
    if (nameInput()) {
        toast("Username disimpan.");
    }
});

$("copyCode").addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(lobbyId);
        toast("Kod lobby disalin.");
    } catch (error) {
        toast("Tidak dapat menyalin kod lobby.");
    }
});

$("readyBtn").addEventListener("click", async () => {
    const me = state?.players?.find(
        (player) => player.playerId === playerId
    );

    if (!me) {
        return;
    }

    try {
        state = await act("setReady", {
            lobbyId,
            playerId,
            ready: !me.ready
        });

        renderLobby();
    } catch (error) {
        // Error is displayed by act().
    }
});

$("startBtn").addEventListener("click", async () => {
    const rounds = Number(
        prompt("Jumlah pusingan (1–20):", "3") || 3
    );

    if (!Number.isInteger(rounds) || rounds < 1 || rounds > 20) {
        toast("Pusingan mesti 1 hingga 20.");
        return;
    }

    try {
        state = await act("startGame", {
            lobbyId,
            playerId,
            totalRounds: rounds
        });

        renderState();
        startPolling();
    } catch (error) {
        // Error is displayed by act().
    }
});


/* =========================================
   17. ACCOQUEST SPIN WHEEL
========================================= */

const WHEEL_SETS = {
    GREEN: [5, 10, 15, 20, 25, 30, 50],
    BLUE: [5, 10, 15, 20, 25, -5, -10, -15, -20, -25],
    RED: [-5, -10, -15, -20, -25, 0]
};

function currentWheelSet() {
    const block = state?.game?.selectedBlock || "GREEN";
    return WHEEL_SETS[block] || WHEEL_SETS.GREEN;
}

function setupWheelLabels() {
    const wheel = $("wheel");
    if (!wheel) return;
    let labels = wheel.querySelector(".wheel-labels");
    if (!labels) {
        labels = document.createElement("div");
        labels.className = "wheel-labels";
        wheel.insertBefore(labels, wheel.querySelector(".wheel-center"));
    }
    const values = currentWheelSet();
    const step = 360 / values.length;
    labels.innerHTML = values.map((points, index) => {
        const angle = index * step + step / 2;
        const value = points > 0 ? `+${points}` : String(points);
        return `<span class="wheel-label" style="--label-angle:${angle}deg;--label-counter-angle:${-angle}deg">${value}</span>`;
    }).join("");
    const mode = state?.game?.selectedBlock || "GREEN";
    wheel.classList.remove("mode-green", "mode-blue", "mode-red");
    wheel.classList.add(`mode-${mode.toLowerCase()}`);
    $("wheelTitle").textContent = `${mode} BLOCK · SPIN`;
    $("wheelHint").textContent = mode === "GREEN"
        ? "Semua segmen memberikan mata positif."
        : mode === "BLUE"
          ? "Separuh segmen positif dan separuh negatif."
          : "Segmen hanya memberikan mata negatif atau sifar.";
}

async function spinWheelToPoints(points, startAngle) {
    const wheel = $("wheel");
    const values = currentWheelSet();
    const targetIndex = values.indexOf(Number(points));
    if (!wheel || targetIndex < 0) throw new Error("Nilai mata tidak sah.");
    const step = 360 / values.length;
    const segmentCenter = targetIndex * step + step / 2;
    const currentAngle = ((startAngle % 360) + 360) % 360;
    const alignment = (360 - ((segmentCenter + currentAngle) % 360)) % 360;
    const endRotation = startAngle + 360 * 3 + alignment;
    const animation = wheel.animate(
        [{ transform: `rotate(${startAngle}deg)` }, { transform: `rotate(${endRotation}deg)` }],
        { duration: 1800, easing: "cubic-bezier(.12,.75,.12,1)", fill: "forwards" }
    );
    await animation.finished;
    wheelRotation = endRotation;
    wheel.style.transform = `rotate(${endRotation}deg)`;
    animation.cancel();
}

$("spinBtn").addEventListener("click", async () => {
    if (spinBusy) return;
    spinBusy = true;
    $("spinBtn").disabled = true;
    $("spinResult").classList.add("hidden");
    const wheel = $("wheel");
    const startAngle = wheelRotation;
    const fastSpin = wheel.animate(
        [{ transform: `rotate(${startAngle}deg)` }, { transform: `rotate(${startAngle + 360}deg)` }],
        { duration: 900, iterations: Infinity, easing: "linear" }
    );
    try {
        const result = await act("spinPoints", { lobbyId, playerId });
        const points = Number(result.points);
        if (!Number.isFinite(points)) throw new Error("Nilai mata tidak sah daripada server.");
        const elapsed = Number(fastSpin.currentTime || 0);
        const currentAngle = startAngle + (360 * elapsed / 900);
        fastSpin.cancel();
        wheelRotation = currentAngle;
        wheel.style.transform = `rotate(${currentAngle}deg)`;
        await spinWheelToPoints(points, currentAngle);
        $("spinResult").textContent = `${points > 0 ? "+" : ""}${points} POINTS`;
        $("spinResult").classList.remove("hidden");
        await new Promise(resolve => setTimeout(resolve, 900));
        spinBusy = false;
        $("spinBtn").disabled = false;
        await poll();
    } catch (error) {
        fastSpin.cancel();
        spinBusy = false;
        $("spinBtn").disabled = false;
        toast(error.message || "Spin gagal.");
    }
});


/* -----------------------------
   REPLAY / BACK TO LOBBY
----------------------------- */
$("playAgain").addEventListener("click", async () => {
    try {
        state = await act("replayGame", { lobbyId, playerId });
        activeQuestion = null;
        selectedAnswer = null;
        urlQuestionLoaded = false;
        $("answerFeedback").classList.add("hidden");
        $("spinResult").classList.add("hidden");
        wheelRotation = 0;
        renderState();
        startPolling();
    } catch (_) {}
});

$("backLobby").addEventListener("click", async () => {
    try {
        state = await act("resetGame", { lobbyId, playerId });
        activeQuestion = null;
        selectedAnswer = null;
        stopGameTimers();
        renderState();
        startPolling();
    } catch (_) {}
});



/* -----------------------------
   19. RETURN TO MAIN MENU
----------------------------- */

const menuHomeButton = $("menuHomeBtn");

if (menuHomeButton) {
    menuHomeButton.addEventListener("click", (event) => {
        event.preventDefault();

        stopGameTimers();

        localStorage.removeItem("aq_lobby_id");
        lobbyId = "";

        window.location.href = `/?home=1&refresh=${Date.now()}`;
    });
}


/* -----------------------------
   20. RESTORE PREVIOUS SESSION
----------------------------- */

async function restoreSession() {
    if (!lobbyId) {
        show("home");
        return;
    }

    show("lobby");
    renderLobbySkeleton();

    try {
        state = await gas("getGameState", {
            lobbyId,
            playerId
        });

        renderState();
        startPolling();
        if (urlQuestionId && state?.status === "playing" && state?.game?.isMyTurn && state?.game?.phase === "question" && !urlQuestionLoaded) {
            urlQuestionLoaded = true;
            loadQuestion(urlQuestionId).catch(() => { urlQuestionLoaded = false; });
        }

    } catch (error) {
        localStorage.removeItem("aq_lobby_id");
        lobbyId = "";

        clearLobbySkeleton();
        show("home");
    }
}

restoreSession();
