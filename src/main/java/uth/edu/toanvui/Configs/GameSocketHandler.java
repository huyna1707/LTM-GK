package uth.edu.toanvui.Configs;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.socket.*;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import uth.edu.toanvui.Game.*;
import uth.edu.toanvui.Logic.Difficulty;
import uth.edu.toanvui.Logic.Question;
import uth.edu.toanvui.Logic.QuestionGenerator;

import java.util.Map;

public class GameSocketHandler extends TextWebSocketHandler {
    private final ObjectMapper om = new ObjectMapper();
    private final GameService gameService = new GameService();
    private final QuestionGenerator gen = new QuestionGenerator();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        // chờ client gửi "join"
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        Map<String, Object> msg = om.readValue(message.getPayload(), new TypeReference<>(){});
        String type = (String) msg.get("type");

        if ("join".equals(type)) {
            String name = (String) msg.get("name");
            String lv = ((String) msg.get("level")).toUpperCase();
            Difficulty d = Difficulty.valueOf(lv);

            PlayerSession ps = new PlayerSession(session, name, d);
            gameService.register(session.getId(), ps);

            send(session, Map.of("type","joined","name",name,"level",d.name()));
            gameService.startFor(session.getId()); // <-- gọi service, đừng tự nextQuestion
        }
        else if ("answer".equals(type)) {
            String qid = (String) msg.get("qid");
            int choice = (int) msg.get("choice");
            gameService.onClientAnswer(session.getId(), qid, choice);
        }
    }

    private void nextQuestion(PlayerSession ps) throws Exception {
        int idx = ps.currentIndex + 1;
        Question q = gen.next(ps.level, "q" + (idx + 1));
        ps.currentIndex = idx;
        gameService.sendQuestion(ps, q);

        send(ps.ws, Map.of(
                "type","question",
                "index", ps.currentIndex + 1,
                "total", 10,
                "time", 30,
                "data", q
        ));
    }

    private void send(WebSocketSession ws, Object payload) throws Exception {
        ws.sendMessage(new TextMessage(om.writeValueAsString(payload)));
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        gameService.unregister(session.getId());
    }
}
