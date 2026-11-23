package com.nexo.server;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Intent;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;

import org.json.JSONArray;
import org.json.JSONObject;

import java.time.Duration;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class BotService extends Service {

    public interface StatusListener {
        void onStatus(boolean connected, String message);

        void appendLog(String line);
    }

    public static volatile boolean running = false;
    public static volatile StatusListener ui = null;

    private static final String CHANNEL_ID = "nexo_bot";
    private static final int NOTIF_ID = 1;

    private OkHttpClient http;
    private DiscordGateway gateway;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private final Map<String, Deque<JSONObject>> history = new ConcurrentHashMap<>();

    @Override
    public void onCreate() {
        super.onCreate();
        http = new OkHttpClient.Builder()
                .readTimeout(Duration.ofSeconds(90))
                .connectTimeout(Duration.ofSeconds(30))
                .build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForeground(NOTIF_ID, buildNotification("Bot encendido"));
        if (!running) {
            running = true;
            log("Servicio iniciado");
            startGateway();
        }
        return START_STICKY;
    }

    private void startGateway() {
        String token = Prefs.get(this, "token", "").trim();
        if (token.isEmpty()) {
            log("Falta el token del bot. Guárdalo y vuelve a iniciar.");
            setStatus(false, "Falta el token");
            stopSelf();
            return;
        }
        gateway = new DiscordGateway(http, token, new DiscordGateway.Listener() {
            @Override
            public void onStatus(boolean connected, String message) {
                log(message);
                setStatus(connected, connected ? "Bot encendido" : message);
                String state = connected ? "Bot encendido" : message;
                NotificationManager nm = getSystemService(NotificationManager.class);
                nm.notify(NOTIF_ID, buildNotification(state));
            }

            @Override
            public void onMessage(String channelId, String content, String authorName, boolean isBot) {
                handleIncoming(channelId, content, authorName, isBot);
            }
        });
        gateway.connect();
    }

    private void handleIncoming(String channelId, String content, String authorName, boolean isBot) {
        if (isBot) return;

        String apiBase = Prefs.get(this, "apiBase", "").trim();
        String apiKey = Prefs.get(this, "apiKey", "").trim();
        String model = Prefs.get(this, "model", "").trim();
        String system = Prefs.get(this, "system", "");

        if (apiBase.isEmpty() || apiKey.isEmpty() || model.isEmpty()) {
            sendDiscordMessage(channelId, "⚠️ Abre la app Nexo Server y configura la IA (URL, modelo y API key).");
            return;
        }

        Deque<JSONObject> h = history.computeIfAbsent(channelId, k -> new ArrayDeque<>());

        JSONObject userMsg = new JSONObject();
        try {
            userMsg.put("role", "user").put("content", authorName + ": " + content);
        } catch (Exception ignored) { }

        synchronized (h) {
            h.addLast(userMsg);
            while (h.size() > 24) h.removeFirst();
        }

        sendTyping(channelId);
        setStatus(true, "Pensando para " + authorName + "…");

        final String base = apiBase.endsWith("/") ? apiBase.substring(0, apiBase.length() - 1) : apiBase;
        executor.execute(() -> {
            String reply;
            try {
                JSONArray msgs = new JSONArray();
                if (!system.trim().isEmpty()) {
                    msgs.put(new JSONObject().put("role", "system").put("content", system));
                }
                synchronized (h) {
                    for (JSONObject m : h) msgs.put(m);
                }
                reply = AiClient.complete(http, base, apiKey, model, msgs);
            } catch (Exception e) {
                reply = null;
            }

            if (reply == null || reply.trim().isEmpty()) {
                reply = "⚠️ No pude contactar la IA. Revisa la URL, el modelo y la API key en la app.";
            }

            sendDiscordMessage(channelId, reply);

            JSONObject botMsg = new JSONObject();
            try {
                botMsg.put("role", "assistant").put("content", reply);
            } catch (Exception ignored) { }
            synchronized (h) {
                h.addLast(botMsg);
                while (h.size() > 24) h.removeFirst();
            }
        });
    }

    private void sendTyping(String channelId) {
        String token = Prefs.get(this, "token", "").trim();
        executor.execute(() -> {
            try {
                Request req = new Request.Builder()
                        .url("https://discord.com/api/v10/channels/" + channelId + "/typing")
                        .header("Authorization", "Bot " + token)
                        .post(RequestBody.create(new byte[0]))
                        .build();
                http.newCall(req).execute().close();
            } catch (Exception ignored) { }
        });
    }

    private void sendDiscordMessage(String channelId, String content) {
        String token = Prefs.get(this, "token", "").trim();
        executor.execute(() -> {
            try {
                int start = 0;
                while (start < content.length()) {
                    int end = Math.min(start + 1900, content.length());
                    if (end < content.length()) {
                        int cut = content.lastIndexOf('\n', end);
                        if (cut > start) end = cut;
                    }
                    String part = content.substring(start, end);

                    JSONObject body = new JSONObject().put("content", part);
                    Request req = new Request.Builder()
                            .url("https://discord.com/api/v10/channels/" + channelId + "/messages")
                            .header("Authorization", "Bot " + token)
                            .post(RequestBody.create(body.toString(), MediaType.parse("application/json")))
                            .build();
                    http.newCall(req).execute().close();
                    start = end;
                }
                log("Respuesta enviada al canal " + channelId);
            } catch (Exception e) {
                log("Error enviando mensaje: " + e.getMessage());
            }
        });
    }

    private void log(String s) {
        main.post(() -> {
            StatusListener l = ui;
            if (l != null) l.appendLog("• " + s);
        });
    }

    private void setStatus(boolean connected, String message) {
        main.post(() -> {
            StatusListener l = ui;
            if (l != null) l.onStatus(connected, message);
        });
    }

    private Notification buildNotification(String text) {
        NotificationManager nm = getSystemService(NotificationManager.class);
        NotificationChannel ch = new NotificationChannel(CHANNEL_ID, "Estado del bot",
                NotificationManager.IMPORTANCE_LOW);
        nm.createNotificationChannel(ch);

        return new Notification.Builder(this, CHANNEL_ID)
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setContentTitle("Nexo Server")
                .setContentText(text)
                .setOngoing(true)
                .build();
    }

    @Override
    public void onDestroy() {
        running = false;
        if (gateway != null) gateway.stop();
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }
}
