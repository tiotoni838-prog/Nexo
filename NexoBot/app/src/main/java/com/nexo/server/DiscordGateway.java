package com.nexo.server;

import android.util.Log;

import org.json.JSONObject;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.MediaType;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

public class DiscordGateway {

    public interface Listener {
        void onStatus(boolean connected, String message);

        void onMessage(String channelId, String content, String authorName, boolean isBot);
    }

    private static final String TAG = "DiscordGateway";
    private static final int INTENTS = (1 << 9) | (1 << 15);

    private final OkHttpClient http;
    private final String token;
    private final Listener listener;

    private volatile WebSocket ws;
    private Thread heartbeat;
    private volatile long lastSeq = -1;
    private volatile boolean closedByUser = false;
    private volatile String myUserId = null;
    private String sessionId = null;

    public DiscordGateway(OkHttpClient http, String token, Listener listener) {
        this.http = http;
        this.token = token;
        this.listener = listener;
    }

    public void connect() {
        closedByUser = false;
        openSocket();
    }

    private void openSocket() {
        listener.onStatus(false, "Conectando a Discord…");
        Request req = new Request.Builder()
                .url("wss://gateway.discord.gg/?v=10&encoding=json")
                .build();
        ws = http.newWebSocket(req, new WebSocketListener() {

            @Override
            public void onMessage(WebSocket webSocket, String text) {
                handle(text);
            }

            @Override
            public void onFailure(WebSocket webSocket, Throwable t, Response response) {
                listener.onStatus(false, "Conexión perdida: " + String.valueOf(t.getMessage()));
                scheduleReconnect();
            }

            @Override
            public void onClosed(WebSocket webSocket, int code, String reason) {
                listener.onStatus(false, "Conexión cerrada (" + code + ")");
                if (!closedByUser) scheduleReconnect();
            }
        });
    }

    private void scheduleReconnect() {
        if (closedByUser) return;
        Thread t = new Thread(() -> {
            try {
                listener.onStatus(false, "Reconectando en 5s…");
                Thread.sleep(5000);
            } catch (InterruptedException e) {
                return;
            }
            if (!closedByUser) openSocket();
        }, "gw-reconnect");
        t.start();
    }

    private void handle(String text) {
        try {
            JSONObject p = new JSONObject(text);
            int op = p.optInt("op", -1);
            String t = p.optString("t", null);
            long s = p.optLong("s", -1);
            if (s >= 0) lastSeq = s;
            JSONObject d = p.optJSONObject("d");

            if (op == -1) throw new Exception("op indefinido: " + text);

            switch (op) {
                case 10:
                    long interval = d.getLong("heartbeat_interval");
                    startHeartbeat(interval);
                    if (sessionId != null) {
                        JSONObject r = new JSONObject()
                                .put("op", 6)
                                .put("d", new JSONObject()
                                        .put("token", token)
                                        .put("session_id", sessionId)
                                        .put("seq", lastSeq));
                        ws.send(r.toString());
                    } else {
                        JSONObject id = new JSONObject()
                                .put("op", 2)
                                .put("d", new JSONObject()
                                        .put("token", token)
                                        .put("intents", INTENTS)
                                        .put("properties", new JSONObject()
                                                .put("os", "linux")
                                                .put("browser", "nexo-server")
                                                .put("device", "nexo-server")));
                        ws.send(id.toString());
                    }
                    break;

                case 11:
                    break;

                case 9:
                case 7:
                    sessionId = null;
                    if (ws != null) ws.close(4000, "reconnect requested");
                    break;

                default:
                    if ("READY".equals(t) && d != null) {
                        myUserId = d.getJSONObject("user").getString("id");
                        sessionId = d.getString("session_id");
                        listener.onStatus(true, "Conectado como bot");
                    } else if ("MESSAGE_CREATE".equals(t) && d != null) {
                        JSONObject author = d.optJSONObject("author");
                        if (author == null) break;
                        boolean isBot = author.optBoolean("bot", false)
                                || author.optString("id").equals(myUserId);
                        String content = d.optString("content", "");
                        if (content.isEmpty()) break;
                        listener.onMessage(d.getString("channel_id"), content,
                                author.optString("username", "usuario"), isBot);
                    }
                    break;
            }
        } catch (Exception e) {
            Log.e(TAG, "Error procesando gateway", e);
        }
    }

    private void startHeartbeat(long interval) {
        if (heartbeat != null) heartbeat.interrupt();
        heartbeat = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    Thread.sleep(interval);
                    WebSocket socket = ws;
                    if (socket != null) {
                        JSONObject hb = new JSONObject().put("op", 1).put("d",
                                lastSeq < 0 ? JSONObject.NULL : lastSeq);
                        socket.send(hb.toString());
                    }
                } catch (InterruptedException e) {
                    return;
                } catch (Exception e) {
                    Log.e(TAG, "Error heartbeat", e);
                }
            }
        }, "gw-heartbeat");
        heartbeat.start();
    }

    public void stop() {
        closedByUser = true;
        if (heartbeat != null) heartbeat.interrupt();
        if (ws != null) ws.close(1000, "stop");
    }
}
