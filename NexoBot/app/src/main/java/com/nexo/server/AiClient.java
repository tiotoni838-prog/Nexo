package com.nexo.server;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.concurrent.TimeUnit;

import okhttp3.MediaType;
import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.RequestBody;
import okhttp3.Response;

public class AiClient {

    private static final MediaType JSON = MediaType.parse("application/json");

    private static final OkHttpClient CLIENT = new OkHttpClient.Builder()
            .readTimeout(120, TimeUnit.SECONDS)
            .connectTimeout(30, TimeUnit.SECONDS)
            .build();

    public static String complete(OkHttpClient http, String base, String key, String model,
                                  JSONArray messages) {
        try {
            JSONObject body = new JSONObject()
                    .put("model", model)
                    .put("messages", messages)
                    .put("temperature", 0.7)
                    .put("max_tokens", 1500);

            Request req = new Request.Builder()
                    .url(base + "/chat/completions")
                    .header("Authorization", "Bearer " + key)
                    .post(RequestBody.create(body.toString(), JSON))
                    .build();

            try (Response r = http.newCall(req).execute()) {
                String text = r.body() != null ? r.body().string() : "";
                if (!r.isSuccessful()) {
                    throw new IllegalStateException("HTTP " + r.code() + ": " + text);
                }
                return new JSONObject(text)
                        .getJSONArray("choices")
                        .getJSONObject(0)
                        .getJSONObject("message")
                        .getString("content")
                        .trim();
            }
        } catch (Exception e) {
            return null;
        }
    }
}
