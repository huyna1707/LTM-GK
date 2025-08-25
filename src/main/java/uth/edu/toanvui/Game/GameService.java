package uth.edu.toanvui.Game;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import uth.edu.toanvui.Logic.Question;
import uth.edu.toanvui.Logic.QuestionGenerator;

import java.util.*;
import java.util.concurrent.*;

@Service
public class GameService {
    private final ObjectMapper om = new ObjectMapper();
    private final QuestionGenerator gen = new QuestionGenerator();
    private final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(2);
    private final Map<String, PlayerSession> players = new ConcurrentHashMap<>();
    private final int TOTAL_QUESTIONS = 10;
    private final int PER_QUESTION_SECONDS = 30;

    public void register(String sid, PlayerSession ps) {
        players.put(sid, ps);
    }
    public void unregister(String sid) {
        players.remove(sid);
    }

    public void startFor(String sid) {
        PlayerSession ps = players.get(sid);
        if (ps == null) return;
        ps.currentIndex = -1;
        ps.score = 0;
        nextQuestion(ps);
    }

    private void nextQuestion(PlayerSession ps) {
        ps.currentIndex++;
        if (ps.currentIndex >= TOTAL_QUESTIONS) {
            sendResult(ps);
            return;
        }

        String qid = "q" + (ps.currentIndex + 1); // vd q1, q2,...
        Question q = gen.next(ps.level, qid);
        ps.startTs = System.currentTimeMillis();

        cacheCurrentQ(ps.ws.getId(), q);

        send(ps, Map.of(
                "type","question",
                "index", ps.currentIndex + 1,
                "total", TOTAL_QUESTIONS,
                "time", PER_QUESTION_SECONDS,
                "data", q
        ));

        scheduler.schedule(() -> timeoutCheck(ps, q.id), PER_QUESTION_SECONDS, TimeUnit.SECONDS);
    }


    // Client gửi {type:"answer", qid:"q1", choice: 0..3}
    public void handleAnswer(String sid, String qid, int choice) {
        PlayerSession ps = players.get(sid);
        if (ps == null) return;

        // Chỉ chấm nếu qid khớp câu hiện tại
        int expectedIndex = ps.currentIndex;
        if (expectedIndex < 0 || expectedIndex >= TOTAL_QUESTIONS) return;

        // server cần biết đúng/sai => regenerate cùng seed? Đơn giản: gửi lại đáp án đúng trong payload trước đó.
        // Ở đây để đơn giản, ta lưu đáp án đúng tạm thời trong một cache nhẹ:
        // -> Với demo ngắn gọn, ta cho client gửi lại "correctIndex" là không an toàn.
        // Sản phẩm thực: bạn lưu q vào một map tạm theo sid+qid. (Minh hoạ nhanh bên dưới)
    }

    // ===== Simplify: lưu câu hiện tại theo sid =====
    private final Map<String, Question> currentQ = new ConcurrentHashMap<>();

    public void cacheCurrentQ(String sid, Question q) {
        currentQ.put(sid, q);
    }

    public void onClientAnswer(String sid, String qid, int choice) {
        PlayerSession ps = players.get(sid);
        if (ps == null) return;
        Question q = currentQ.get(sid);
        if (q == null || !qid.equals(q.id)) return;

        boolean correct = (choice == q.correctIndex);
        if (correct) ps.score++;

        send(ps, Map.of(
                "type","answer_result",
                "qid", qid,
                "correct", correct,
                "correctIndex", q.correctIndex
        ));

        // sang câu tiếp theo sau 1 giây
        scheduler.schedule(() -> nextQuestion(ps), 1, TimeUnit.SECONDS);
    }

    private void timeoutCheck(PlayerSession ps, String qid) {
        // nếu vẫn đang ở qid này thì coi như sai
        Question q = currentQ.get(ps.ws.getId());
        if (q != null && q.id.equals(qid)) {
            send(ps, Map.of(
                    "type","timeout",
                    "qid", qid,
                    "correctIndex", q.correctIndex
            ));
            nextQuestion(ps);
        }
    }

    private void sendResult(PlayerSession ps) {
        send(ps, Map.of(
                "type","final",
                "score", ps.score,
                "total", TOTAL_QUESTIONS
        ));
        currentQ.remove(ps.ws.getId());
    }

    public void sendQuestion(PlayerSession ps, Question q) {
        cacheCurrentQ(ps.ws.getId(), q);
    }

    private void send(PlayerSession ps, Object payload) {
        try {
            ps.ws.sendMessage(new TextMessage(om.writeValueAsString(payload)));
        } catch (Exception e) { /* log */ }
    }
}
