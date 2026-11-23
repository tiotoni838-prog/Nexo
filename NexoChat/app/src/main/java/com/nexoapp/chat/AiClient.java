package com.nexoapp.chat;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class AiClient {

    public interface StreamListener {
        void onDelta(String delta);

        void onDone();

        void onError(String message);
    }

    private static final ExecutorService POOL = Executors.newCachedThreadPool();
    private volatile HttpURLConnection conn;

    public void stream(String endpoint, String apiKey, String model, JSONArray messages,
                       StreamListener listener) {
        POOL.execute(() -> {
            try {
                JSONObject body = new JSONObject()
                        .put("model", model)
                        .put("messages", messages)
                        .put("stream", true);

                conn = (HttpURLConnection) new URL(endpoint + "/chat/completions").openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Authorization", "Bearer " + apiKey);
                conn.setRequestProperty("Accept", "text/event-stream");
                conn.setDoOutput(true);
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(120000);

                try (OutputStream os = conn.getOutputStream()) {
                    os.write(body.toString().getBytes(StandardCharsets.UTF_8));
                }

                int code = conn.getResponseCode();
                if (code < 200 || code >= 300) {
                    String err = readStream(code >= 400 ? conn.getErrorStream() : conn.getInputStream());
                    listener.onError("Error " + code + ": " + trim(err, 400));
                    return;
                }

                BufferedReader reader = new BufferedReader(
                        new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8));
                String line;
                while ((line = reader.readLine()) != null) {
                    if (Thread.currentThread().isInterrupted()) break;
                    if (!line.startsWith("data:")) continue;
                    String data = line.substring(5).trim();
                    if (data.isEmpty()) continue;
                    if ("[DONE]".equals(data)) break;
                    try {
                        JSONObject delta = new JSONObject(data)
                                .getJSONArray("choices")
                                .getJSONObject(0)
                                .optJSONObject("delta");
                        String piece = delta == null ? null : delta.optString("content", null);
                        if (piece != null && !piece.isEmpty()) listener.onDelta(piece);
                    } catch (Exception ignored) { }
                }
                listener.onDone();
            } catch (Exception e) {
                listener.onError(e.getMessage() == null ? "Error de red" : e.getMessage());
            }
        });
    }

    public void cancel() {
        Thread t = new Thread(() -> {
            try {
                if (conn != null) conn.disconnect();
            } catch (Exception ignored) { }
        });
        t.start();
    }

    private static String readStream(java.io.InputStream in) {
        if (in == null) return "";
        try (BufferedReader r = new BufferedReader(new InputStreamReader(in, StandardCharsets.UTF_8))) {
            StringBuilder sb = new StringBuilder();
            String l;
            while ((l = r.readLine()) != null) sb.append(l);
            return sb.toString();
        } catch (Exception e) {
            return "";
        }
    }

    private static String trim(String s, int max) {
        return s.length() > max ? s.substring(0, max) + "…" : s;
    }
}
