package uth.edu.toanvui.Game;

import org.springframework.web.socket.WebSocketSession;
import uth.edu.toanvui.Logic.Difficulty;

public class PlayerSession {
    public final WebSocketSession ws;
    public final String name;
    public final Difficulty level;
    public int score = 0;
    public int currentIndex = -1; // đang ở câu thứ mấy
    public long startTs; // bắt đầu câu hiện tại

    public PlayerSession(WebSocketSession ws, String name, Difficulty level) {
        this.ws = ws;
        this.name = name;
        this.level = level;
    }
}