// ================== CẤU HÌNH ==================
const WS_PATH = "/ws/game";             // Endpoint WebSocket trên server
const TOTAL_QUESTIONS = 10;             // Số câu mỗi lượt
const DEFAULT_SECONDS = 30;             // 30s/câu
// ==============================================

// --------- DOM ----------
const startScreen = document.getElementById('start-screen');
const quizScreen  = document.getElementById('quiz-screen');
const resultPopup = document.getElementById('result-popup');

const playerNameInput = document.getElementById('player-name');
const levelButtons    = document.querySelectorAll('.level-btn');
const startGameBtn    = document.getElementById('start-game');

const questionNumberSpan = document.getElementById('question-number');
const timerDisplay       = document.getElementById('timer-display');
const questionText       = document.getElementById('question-text');
const answerButtons      = document.querySelectorAll('.answer-btn');

const congratulations = document.getElementById('congratulations');
const scoreDisplay    = document.getElementById('score-display');
const finishBtn       = document.getElementById('finish-btn');
const newLevelBtn     = document.getElementById('new-level-btn');

// ---------- STATE ----------
let socket = null;
let state = {
    playerName: "",
    level: "",                  // EASY | MEDIUM | HARD
    index: 0,                   // 1..TOTAL_QUESTIONS
    score: 0,
    timeLeft: DEFAULT_SECONDS,
    timer: null,
    currentQ: null,             // {id,text,options[4]}
    selectedAnswer: null,
    waiting: false
};

// ---------- INIT ----------
document.addEventListener('DOMContentLoaded', () => {
    // Chọn cấp độ
    levelButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            levelButtons.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            state.level = (btn.dataset.level || 'easy').toUpperCase();
            updateStartEnabled();
        });
    });

    // Nhập tên
    playerNameInput.addEventListener('input', updateStartEnabled);

    // NÚT BẮT ĐẦU
    startGameBtn.addEventListener('click', onStartGame);

    // Popup: hoàn tất / chọn level khác
    finishBtn.addEventListener('click', resetToStart);
    newLevelBtn.addEventListener('click', resetToStart);

    // Phím tắt 1..4
    window.addEventListener('keydown', (e) => {
        if (!quizScreen.classList.contains('active') || !state.currentQ) return;
        if (e.key >= '1' && e.key <= '4') submitAnswer(parseInt(e.key,10)-1);
    });

    // Khởi tạo UI
    updateStartEnabled();
});

// ---------- UI HELPERS ----------
function updateStartEnabled() {
    const ok = playerNameInput.value.trim().length > 0 && !!state.level;
    startGameBtn.disabled = !ok;
}

function showQuiz() {
    startScreen.classList.remove('active');
    quizScreen.classList.add('active');
}

function showPopup(score, total) {
    congratulations.textContent = `Chúc mừng ${state.playerName} đã hoàn thành bài thi!`;
    scoreDisplay.textContent = `${score}/${total}`;
    resultPopup.classList.add('active');
}

function hidePopup() {
    resultPopup.classList.remove('active');
}

function resetQuizUI() {
    state.index = 0;
    state.score = 0;
    state.timeLeft = DEFAULT_SECONDS;
    state.timer = null;
    state.currentQ = null;
    state.selectedAnswer = null;
    state.waiting = true;

    questionNumberSpan.textContent = '1';
    timerDisplay.textContent = DEFAULT_SECONDS.toString();
    questionText.textContent = 'Đang chờ câu hỏi...';
    answerButtons.forEach((btn, i) => {
        btn.textContent = String.fromCharCode(65+i);
        btn.classList.remove('selected', 'correct', 'incorrect');
        btn.disabled = true;
    });
}

function paintAnswers(correctIndex) {
    answerButtons.forEach((btn, i) => {
        btn.disabled = true;
        btn.classList.remove('selected', 'correct', 'incorrect');
        if (i === correctIndex) btn.classList.add('correct');
        if (state.selectedAnswer === i && i !== correctIndex) btn.classList.add('incorrect');
    });
}

// ---------- START GAME ----------
function onStartGame() {
    if (startGameBtn.disabled) return;
    state.playerName = playerNameInput.value.trim();
    connectWebSocketAndJoin();
}

function connectWebSocketAndJoin() {
    const scheme = location.protocol === 'https:' ? 'wss' : 'ws';
    const url = `${scheme}://${location.host}${WS_PATH}`;
    socket = new WebSocket(url);

    socket.onopen = () => {
        showQuiz();
        resetQuizUI();
        send({ type: 'join', name: state.playerName, level: state.level }); // server sẽ trả 'question' đầu tiên
    };

    socket.onmessage = (evt) => {
        const msg = JSON.parse(evt.data);
        switch (msg.type) {
            case 'question':       onQuestion(msg); break;
            case 'answer_result':  onAnswerResult(msg); break;
            case 'timeout':        onTimeout(msg); break;
            case 'final':          onFinal(msg); break;
            default: console.log('Unknown', msg);
        }
    };

    socket.onclose = () => stopTimer();
    socket.onerror = (e) => console.error('WS error:', e);
}

function send(payload) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(payload));
    }
}

// ---------- QUESTION FLOW ----------
function onQuestion(msg) {
    // msg: {type:'question', index, total, time, data:{id,text,options}}
    state.currentQ = msg.data;
    state.index    = msg.index;
    state.timeLeft = msg.time || DEFAULT_SECONDS;
    state.selectedAnswer = null;
    state.waiting = false;

    questionNumberSpan.textContent = String(state.index);
    timerDisplay.textContent = String(state.timeLeft);
    questionText.textContent = state.currentQ.text || 'Câu hỏi';

    answerButtons.forEach((btn, i) => {
        btn.disabled = false;
        btn.classList.remove('selected', 'correct', 'incorrect');
        const opts = state.currentQ.options || [];
        btn.textContent = `${String.fromCharCode(65+i)}. ${opts[i] ?? ''}`;
        btn.onclick = () => submitAnswer(i);
    });

    startTimer();
}

function submitAnswer(choice) {
    if (!state.currentQ || state.waiting) return;
    state.selectedAnswer = choice;
    answerButtons.forEach(b => b.disabled = true);
    stopTimer();
    questionText.textContent = 'Đang chờ kết quả...';
    send({ type: 'answer', qid: state.currentQ.id, choice });
}

function onAnswerResult(msg) {
    // msg: {qid, correct, correctIndex}
    if (msg.correct) state.score++;
    stopTimer();
    paintAnswers(msg.correctIndex);
    state.waiting = true; // server sẽ gửi câu tiếp theo sau ~1s
}

function onTimeout(msg) {
    // msg: {qid, correctIndex}
    stopTimer();
    paintAnswers(msg.correctIndex);
    state.waiting = true;
}

function onFinal(msg) {
    // msg: {score, total}
    stopTimer();
    state.score = msg.score ?? state.score;
    quizScreen.classList.remove('active');
    showPopup(state.score, msg.total ?? TOTAL_QUESTIONS);
}

// ---------- TIMER ----------
function startTimer() {
    stopTimer();
    updateTimerUI();
    state.timer = setInterval(() => {
        state.timeLeft--;
        updateTimerUI();
        if (state.timeLeft <= 0) {
            stopTimer();
            // Server sẽ tự chấm hết giờ và gửi 'timeout' → client chỉ chờ
            questionText.textContent = 'Hết thời gian! Đang chờ kết quả...';
            answerButtons.forEach(b => b.disabled = true);
        }
    }, 1000);
}

function stopTimer() {
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
}

function updateTimerUI() {
    timerDisplay.textContent = Math.max(0, state.timeLeft).toString();
    const wrap = timerDisplay.parentElement; // .timer
    if (state.timeLeft <= 10) wrap.classList.add('warning'); else wrap.classList.remove('warning');
}

// ---------- RESET / CHỌN LEVEL MỚI ----------
function resetToStart() {
    hidePopup();
    // đóng socket nếu còn mở
    try { socket && socket.readyState === WebSocket.OPEN && socket.close(); } catch {}

    // UI
    startScreen.classList.add('active');
    quizScreen.classList.remove('active');

    // Reset form (giữ tên nếu muốn)
    // playerNameInput.value = '';
    levelButtons.forEach(b => b.classList.remove('selected'));
    startGameBtn.disabled = true;

    // State
    state = {
        playerName: "",
        level: "",
        index: 0,
        score: 0,
        timeLeft: DEFAULT_SECONDS,
        timer: null,
        currentQ: null,
        selectedAnswer: null,
        waiting: false
    };
}

