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
let seconds = 30;
let spinBusy = false;
let wheelRotation = 0;
const WHEEL_POINTS = [5, 10, 15, 20, 25, 30, 50, 0, -5, -10];
let questionLoading = false;
let urlQuestionId = params.get("qid");
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
    if (!lobbyId) {
        return;
    }

    try {
        state = await gas("getGameState", {
            lobbyId,
            playerId
        });

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

    if (
        game.lastResult &&
        game.lastResult.playerId === playerId &&
        game.phase !== "question"
    ) {
        $("answerFeedback").textContent = game.lastResult.correct
            ? "BETUL! Jawapan tepat."
            : "SALAH. Jawapan tidak tepat.";

        $("answerFeedback").className =
            `feedback ${game.lastResult.correct ? "correct" : "wrong"}`;

        $("answerFeedback").classList.remove("hidden");
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
    const usedBlocks = state?.game?.usedBlocks || [];
    const availableBlocks = ["A", "B", "C", "D", "E", "F"];

    $("blocks").innerHTML = availableBlocks.map((block) => `
        <button
            class="block"
            type="button"
            data-block="${block}"
            ${usedBlocks.includes(block) ? "disabled" : ""}
        >
            ${block}
        </button>
    `).join("");

    document.querySelectorAll(".block:not(:disabled)").forEach((button) => {
        button.addEventListener("click", async () => {
            button.disabled = true;

            try {
                await act("chooseBlock", {
                    lobbyId,
                    playerId,
                    block: button.dataset.block
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
        <span>${winner?.points || 0} POINTS</span>
    `;

    $("finalRows").innerHTML = scores.slice(0, 3).map((player, index) => {
        const medals = ["🥇", "🥈", "🥉"];

        return `
            <div class="final-row">
                <strong>
                    ${medals[index]} ${escapeHTML(player.name)}
                </strong>

                <span>${player.points} pts</span>
            </div>
        `;
    }).join("");
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
        toast(
            "Web NFC tidak disokong pada peranti ini. " +
            "Gunakan NFC URL atau masukkan ID secara manual."
        );
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
                    const languageLength = bytes[0] & 0x3f;
                    const encoding = (bytes[0] & 0x80)
                        ? "utf-16"
                        : "utf-8";

                    const questionId = new TextDecoder(encoding)
                        .decode(bytes.slice(1 + languageLength))
                        .trim();

                    if (questionId) {
                        loadQuestion(questionId);
                    }

                    return;
                }

                if (record.recordType === "url") {
                    const bytes = new Uint8Array(record.data);

                    const prefixes = [
                        "",
                        "http://www.",
                        "https://www.",
                        "http://",
                        "https://"
                    ];

                    const prefix = prefixes[bytes[0]] || "";
                    const url = prefix +
                        new TextDecoder().decode(bytes.slice(1));

                    try {
                        const questionId =
                            new URL(url).searchParams.get("qid");

                        if (questionId) {
                            loadQuestion(questionId);
                            return;
                        }
                    } catch (error) {
                        toast("Format URL NFC tidak sah.");
                    }
                }
            }
        };

    } catch (error) {
        toast(`NFC gagal dimulakan: ${error.message}`);
    }
}


/* -----------------------------
   14. ANSWER SUBMISSION
----------------------------- */

async function submitAnswer(answer) {
    if (!activeQuestion || isSubmitting) {
        return;
    }

    isSubmitting = true;
    clearInterval(countdown);

    $("submitAnswer").disabled = true;

    try {
        const result = await act("submitAnswer", {
            lobbyId,
            playerId,
            questionId: activeQuestion.id,
            answer
        });

        $("answerFeedback").textContent = result.correct
            ? "BETUL! Jawapan tepat."
            : "SALAH. Jawapan tidak tepat.";

        $("answerFeedback").className =
            `feedback ${result.correct ? "correct" : "wrong"}`;

        $("answerFeedback").classList.remove("hidden");

        await poll();

    } catch (error) {
        $("submitAnswer").disabled = false;
    } finally {
        isSubmitting = false;
    }
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

function setupWheelLabels() {
    const wheel = $("wheel");

    if (!wheel) return;

    let labels = wheel.querySelector(".wheel-labels");

    if (!labels) {
        labels = document.createElement("div");
        labels.className = "wheel-labels";

        wheel.insertBefore(
            labels,
            wheel.querySelector(".wheel-center")
        );
    }

    labels.innerHTML = WHEEL_POINTS.map((points, index) => {
        const angle = index * 36 + 18;
        const value = points > 0 ? `+${points}` : String(points);

        return `
            <span
                class="wheel-label"
                style="
                    --label-angle: ${angle}deg;
                    --label-counter-angle: ${-angle}deg;
                "
            >${value}</span>
        `;
    }).join("");
}


function setupWheelLabels() {
    const wheel = $("wheel");

    if (!wheel) return;

    let labels = wheel.querySelector(".wheel-labels");

    if (!labels) {
        labels = document.createElement("div");
        labels.className = "wheel-labels";

        wheel.insertBefore(
            labels,
            wheel.querySelector(".wheel-center")
        );
    }

    labels.innerHTML = WHEEL_POINTS.map((points, index) => {
        const angle = index * 36 + 18;
        const value = points > 0 ? `+${points}` : String(points);

        return `
            <span
                class="wheel-label"
                style="
                    --label-angle: ${angle}deg;
                    --label-counter-angle: ${-angle}deg;
                "
            >${value}</span>
        `;
    }).join("");
}


// ANIMASI WHEEL
async function spinWheelToPoints(points) {
    const wheel = $("wheel");

    const targetIndex = WHEEL_POINTS.indexOf(Number(points));

    if (!wheel) {
        throw new Error("Elemen Wheel tidak dijumpai.");
    }

    if (targetIndex === -1) {
        throw new Error(`Nilai mata ${points} tidak sah.`);
    }

    const segmentCenter = targetIndex * 36 + 18;

    const currentAngle =
        ((wheelRotation % 360) + 360) % 360;

    const alignment =
        (360 - ((segmentCenter + currentAngle) % 360)) % 360;

    const startRotation = wheelRotation;

    const endRotation =
        startRotation + (360 * 6) + alignment;

    // Hentikan animasi terdahulu.
    wheel.getAnimations().forEach(animation => {
        animation.cancel();
    });

    wheel.style.transform = `rotate(${startRotation}deg)`;

    // Paksa browser membaca kedudukan awal.
    void wheel.offsetWidth;

    // Jalankan animasi.
    const animation = wheel.animate(
        [
            {
                transform: `rotate(${startRotation}deg)`
            },
            {
                transform: `rotate(${endRotation}deg)`
            }
        ],
        {
            duration: 4500,
            easing: "cubic-bezier(0.12, 0.75, 0.12, 1)",
            fill: "forwards"
        }
    );

    await animation.finished;

    // Simpan kedudukan akhir.
    wheelRotation = endRotation;

    wheel.style.transform = `rotate(${endRotation}deg)`;

    animation.cancel();
}


// Paparkan nombor mata.
setupWheelLabels();


// BUTANG SPIN
$("spinBtn").addEventListener("click", async () => {

    if (spinBusy) return;

    spinBusy = true;

    $("spinBtn").disabled = true;
    $("spinResult").classList.add("hidden");

    try {

        // Dapatkan mata daripada Google Apps Script.
        const result = await act("spinPoints", {
            lobbyId,
            playerId
        });

        const points = Number(result.points);

        if (!Number.isFinite(points)) {
            throw new Error("Nilai mata tidak sah daripada server.");
        }

        // Tunggu animasi roda selesai.
        await spinWheelToPoints(points);

        // Paparkan keputusan.
        $("spinResult").textContent =
            `${points > 0 ? "+" : ""}${points} POINTS`;

        $("spinResult").classList.remove("hidden");

        // Beri masa untuk melihat keputusan.
        await new Promise(resolve => {
            setTimeout(resolve, 1800);
        });

        spinBusy = false;
        $("spinBtn").disabled = false;

        // Kemas kini leaderboard dan giliran.
        await poll();

    } catch (error) {

        spinBusy = false;

        $("spinBtn").disabled = false;

        toast(error.message || "Spin gagal.");
    }
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

    } catch (error) {
        localStorage.removeItem("aq_lobby_id");
        lobbyId = "";

        clearLobbySkeleton();
        show("home");
    }
}

restoreSession();
