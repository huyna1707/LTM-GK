// Game state variables
let gameState = {
    playerName: '',
    currentLevel: '',
    currentQuestionIndex: 0,
    score: 0,
    timeLeft: 30,
    timer: null,
    currentQuestion: null,
    selectedAnswer: null,
    isWaitingForQuestion: false
};

// WebSocket connection
let socket = null;
const WEBSOCKET_URL = 'ws://localhost:8080/quiz'; // Backend WebSocket endpoint

// DOM elements
const startScreen = document.getElementById('start-screen');
const quizScreen = document.getElementById('quiz-screen');
const resultPopup = document.getElementById('result-popup');
const playerNameInput = document.getElementById('player-name');
const levelButtons = document.querySelectorAll('.level-btn');
const startGameBtn = document.getElementById('start-game');
const questionNumberSpan = document.getElementById('question-number');
const timerDisplay = document.getElementById('timer-display');
const questionText = document.getElementById('question-text');
const answerButtons = document.querySelectorAll('.answer-btn');
const congratulations = document.getElementById('congratulations');
const scoreDisplay = document.getElementById('score-display');
const finishBtn = document.getElementById('finish-btn');
const newLevelBtn = document.getElementById('new-level-btn');

// Event listeners
document.addEventListener('DOMContentLoaded', function() {
    initializeGame();
    connectWebSocket();
});

// WebSocket Functions
function connectWebSocket() {
    try {
        socket = new WebSocket(WEBSOCKET_URL);
        
        socket.onopen = function(event) {
            console.log('Connected to server');
        };
        
        socket.onmessage = function(event) {
            const data = JSON.parse(event.data);
            handleServerMessage(data);
        };
        
        socket.onclose = function(event) {
            console.log('Disconnected from server');
            // Attempt to reconnect after 3 seconds
            setTimeout(connectWebSocket, 3000);
        };
        
        socket.onerror = function(error) {
            console.error('WebSocket error:', error);
        };
    } catch (error) {
        console.error('Cannot connect to WebSocket:', error);
    }
}

function sendToServer(message) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
    } else {
        console.error('WebSocket is not connected');
    }
}

function handleServerMessage(data) {
    switch (data.type) {
        case 'QUESTION':
            receiveQuestion(data);
            break;
        case 'ANSWER_RESULT':
            receiveAnswerResult(data);
            break;
        case 'GAME_END':
            receiveGameEnd(data);
            break;
        case 'ERROR':
            console.error('Server error:', data.message);
            break;
        default:
            console.log('Unknown message type:', data.type);
    }
}

function initializeGame() {
    // Player name input validation
    playerNameInput.addEventListener('input', function() {
        checkStartButtonState();
    });

    // Level selection
    levelButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            levelButtons.forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            gameState.currentLevel = this.dataset.level;
            checkStartButtonState();
        });
    });

    // Start game button
    startGameBtn.addEventListener('click', function() {
        if (gameState.playerName && gameState.currentLevel) {
            startGame();
        }
    });

    // Answer buttons
    answerButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            selectAnswer(parseInt(this.dataset.answer));
        });
    });

    // Result popup buttons
    finishBtn.addEventListener('click', function() {
        resetGame();
    });

    newLevelBtn.addEventListener('click', function() {
        chooseNewLevel();
    });
}

function checkStartButtonState() {
    const nameValid = playerNameInput.value.trim().length > 0;
    const levelSelected = gameState.currentLevel !== '';
    
    if (nameValid && levelSelected) {
        startGameBtn.disabled = false;
        gameState.playerName = playerNameInput.value.trim();
    } else {
        startGameBtn.disabled = true;
    }
}

function startGame() {
    // Reset game state
    gameState.currentQuestionIndex = 0;
    gameState.score = 0;
    gameState.isWaitingForQuestion = true;
    
    // Switch to quiz screen
    startScreen.classList.remove('active');
    quizScreen.classList.add('active');
    
    // Send start game request to server
    sendToServer({
        type: 'START_GAME',
        playerName: gameState.playerName,
        level: gameState.currentLevel
    });
    
    // Show waiting message
    questionText.textContent = 'Đang chờ câu hỏi...';
    answerButtons.forEach(btn => {
        btn.textContent = '';
        btn.disabled = true;
    });
}

// Remove shuffleArray function as questions are now managed by backend

function receiveQuestion(data) {
    gameState.currentQuestion = data.question;
    gameState.currentQuestionIndex = data.questionNumber;
    gameState.isWaitingForQuestion = false;
    
    // Update question number
    questionNumberSpan.textContent = gameState.currentQuestionIndex;
    
    // Update question text
    questionText.textContent = data.question.text;
    
    // Update answer buttons
    answerButtons.forEach((btn, index) => {
        btn.textContent = `${String.fromCharCode(65 + index)}. ${data.question.answers[index]}`;
        btn.classList.remove('selected', 'correct', 'incorrect');
        btn.disabled = false;
    });
    
    // Reset timer
    gameState.timeLeft = 30;
    gameState.selectedAnswer = null;
    startTimer();
}

function receiveAnswerResult(data) {
    clearInterval(gameState.timer);
    timerDisplay.parentElement.classList.remove('warning');
    
    // Update score if correct
    if (data.isCorrect) {
        gameState.score = data.score;
    }
    
    // Show answer feedback
    answerButtons.forEach((btn, index) => {
        btn.disabled = true;
        if (index === gameState.selectedAnswer) {
            btn.classList.add(data.isCorrect ? 'correct' : 'incorrect');
        }
        if (index === data.correctAnswer) {
            btn.classList.add('correct');
        }
    });
    
    // Wait for next question or game end
    gameState.isWaitingForQuestion = true;
    setTimeout(() => {
        questionText.textContent = 'Đang chờ câu hỏi tiếp theo...';
        answerButtons.forEach(btn => {
            btn.textContent = '';
            btn.classList.remove('selected', 'correct', 'incorrect');
        });
    }, 2000);
}

function receiveGameEnd(data) {
    // Hide quiz screen
    quizScreen.classList.remove('active');
    
    // Update result popup
    congratulations.textContent = `Chúc mừng ${gameState.playerName} đã hoàn thành bài thi!`;
    scoreDisplay.textContent = `${data.finalScore}/10`;
    
    // Show result popup
    resultPopup.classList.add('active');
}

function showQuestion() {
    // This function is now replaced by receiveQuestion()
    // Keeping for compatibility, but it will not be used
    console.log('showQuestion() called - this should be handled by receiveQuestion()');
}

function startTimer() {
    clearInterval(gameState.timer);
    updateTimerDisplay();
    
    gameState.timer = setInterval(() => {
        gameState.timeLeft--;
        updateTimerDisplay();
        
        if (gameState.timeLeft <= 10) {
            timerDisplay.parentElement.classList.add('warning');
        }
        
        if (gameState.timeLeft <= 0) {
            timeUp();
        }
    }, 1000);
}

function updateTimerDisplay() {
    timerDisplay.textContent = gameState.timeLeft;
}

function timeUp() {
    clearInterval(gameState.timer);
    timerDisplay.parentElement.classList.remove('warning');
    
    // Send timeout to server
    sendToServer({
        type: 'ANSWER_TIMEOUT',
        questionId: gameState.currentQuestion?.id
    });
    
    // Disable all answer buttons
    answerButtons.forEach(btn => btn.disabled = true);
    
    // Show waiting message
    questionText.textContent = 'Hết thời gian! Đang chờ kết quả...';
}

function selectAnswer(answerIndex) {
    if (gameState.selectedAnswer !== null || gameState.isWaitingForQuestion) return;
    
    gameState.selectedAnswer = answerIndex;
    clearInterval(gameState.timer);
    timerDisplay.parentElement.classList.remove('warning');
    
    // Mark selected answer
    answerButtons[answerIndex].classList.add('selected');
    
    // Disable all buttons
    answerButtons.forEach(btn => btn.disabled = true);
    
    // Send answer to server
    sendToServer({
        type: 'SUBMIT_ANSWER',
        questionId: gameState.currentQuestion?.id,
        selectedAnswer: answerIndex,
        timeRemaining: gameState.timeLeft
    });
    
    // Show waiting message
    questionText.textContent = 'Đang chờ kết quả...';
}

function showCorrectAnswer() {
    const currentQuestion = gameState.questions[gameState.currentQuestionIndex];
    answerButtons[currentQuestion.correct].classList.add('correct');
}

function nextQuestion() {
    gameState.currentQuestionIndex++;
    showQuestion();
}

function endGame() {
    // Hide quiz screen
    quizScreen.classList.remove('active');
    
    // Update result popup
    congratulations.textContent = `Chúc mừng ${gameState.playerName} đã hoàn thành bài thi!`;
    scoreDisplay.textContent = `${gameState.score}/10`;
    
    // Show result popup
    resultPopup.classList.add('active');
}

function resetGame() {
    // Close WebSocket connection if exists
    if (socket) {
        sendToServer({
            type: 'QUIT_GAME'
        });
    }
    
    // Hide result popup
    resultPopup.classList.remove('active');
    
    // Reset game state
    gameState = {
        playerName: '',
        currentLevel: '',
        currentQuestionIndex: 0,
        score: 0,
        timeLeft: 30,
        timer: null,
        currentQuestion: null,
        selectedAnswer: null,
        isWaitingForQuestion: false
    };
    
    // Reset form
    playerNameInput.value = '';
    levelButtons.forEach(btn => btn.classList.remove('selected'));
    startGameBtn.disabled = true;
    
    // Clear timer
    clearInterval(gameState.timer);
    
    // Show start screen
    startScreen.classList.add('active');
}

function chooseNewLevel() {
    // Send quit current game to server
    if (socket) {
        sendToServer({
            type: 'QUIT_GAME'
        });
    }
    
    // Hide result popup
    resultPopup.classList.remove('active');
    
    // Reset some game state but keep player name
    gameState.currentLevel = '';
    gameState.currentQuestionIndex = 0;
    gameState.score = 0;
    gameState.timeLeft = 30;
    gameState.timer = null;
    gameState.currentQuestion = null;
    gameState.selectedAnswer = null;
    gameState.isWaitingForQuestion = false;
    
    // Reset level selection
    levelButtons.forEach(btn => btn.classList.remove('selected'));
    startGameBtn.disabled = true;
    
    // Clear timer
    clearInterval(gameState.timer);
    
    // Show start screen
    startScreen.classList.add('active');
}
