package uth.edu.toanvui.Logic;


import java.util.*;

public class QuestionGenerator {
    private final Random rnd = new Random();

    public Question next(Difficulty level, String id) {
        switch (level) {
            case EASY: return easy(id);
            case MEDIUM: return medium(id);
            case HARD: return hard(id);
            default: return easy(id);
        }
    }

    private Question easy(String id) {
        int a = rnd.nextInt(10) + 1; // 1-10
        int b = rnd.nextInt(10) + 1;
        boolean plus = rnd.nextBoolean();

        int ans = plus ? a + b : Math.abs(a - b);
        String text = plus ? (a + " + " + b + " = ?") :
                (Math.max(a,b) + " - " + Math.min(a,b) + " = ?");
        // xuất câu hỏi sang text, dùng min max để phép trừ luôn dương
        return pack(id, text, ans);
    }

    private Question medium(String id) {
        int mode = rnd.nextInt(3); // +, -, x, ÷ (chia hết)
        int a, b, ans;
        String text;

        if (mode == 0) { // +/-
            a = rnd.nextInt(90) + 10; // 10-99
            b = rnd.nextInt(90) + 10;
            boolean plus = rnd.nextBoolean();
            ans = plus ? a + b : Math.abs(a - b);
            text = plus ? (a + " + " + b + " = ?") :
                    (Math.max(a,b) + " - " + Math.min(a,b) + " = ?");
        } else if (mode == 1) { // nhân 1 chữ số
            a = rnd.nextInt(9) + 1; // 1-9
            b = rnd.nextInt(10) + 1; // 1-10
            ans = a * b;
            text = a + " × " + b + " = ?";
        } else { // chia hết
            b = rnd.nextInt(9) + 1;
            ans = rnd.nextInt(10) + 1;
            a = b * ans;
            text = a + " ÷ " + b + " = ?";
        }
        return pack(id, text, ans);
    }

    private Question hard(String id) {
        int mode = rnd.nextInt(3); // nhân 2 chữ số, chia hết 2 chữ số, (a+b)*c
        int a, b, c, ans;
        String text;

        if (mode == 0) {
            a = rnd.nextInt(20) + 10; // 10-29
            b = rnd.nextInt(20) + 10;
            ans = a * b;
            text = a + " × " + b + " = ?";
        } else if (mode == 1) {
            b = rnd.nextInt(20) + 5;
            ans = rnd.nextInt(15) + 2;
            a = b * ans;
            text = a + " ÷ " + b + " = ?";
        } else {
            a = rnd.nextInt(15) + 5;
            b = rnd.nextInt(15) + 5;
            c = rnd.nextInt(9) + 2;
            ans = (a + b) * c;
            text = "(" + a + " + " + b + ") × " + c + " = ?";
        }
        return pack(id, text, ans);
    }

    private Question pack(String id, String text, int correct) {
        Set<Integer> pool = new LinkedHashSet<>();
        pool.add(correct);
        while (pool.size() < 4) {
            int delta = (rnd.nextInt(7) + 1) * (rnd.nextBoolean() ? 1 : -1);
            int candidate = Math.max(0, correct + delta);
            pool.add(candidate);
        }
        List<Integer> options = new ArrayList<>(pool);
        Collections.shuffle(options, rnd);
        int correctIndex = options.indexOf(correct);

        Question q = new Question();
        q.id = id;
        q.text = text;
        q.options = options;
        q.correctIndex = correctIndex;
        return q;
    }
}
