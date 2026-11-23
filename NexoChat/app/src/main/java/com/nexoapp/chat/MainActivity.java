package com.nexoapp.chat;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.widget.EditText;
import android.widget.ListView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends Activity {

    private static final int REQ_SETTINGS = 7;

    private ListView chatList;
    private EditText inputField;
    private TextView btnSend;
    private ChatAdapter adapter;
    private JSONArray messages = new JSONArray();
    private final AiClient ai = new AiClient();
    private boolean streaming = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        chatList = findViewById(R.id.chatList);
        inputField = findViewById(R.id.inputField);
        btnSend = findViewById(R.id.btnSend);
        TextView btnNewChat = findViewById(R.id.btnNewChat);
        TextView btnSettings = findViewById(R.id.btnSettings);

        String saved = Store.get(this, "history", null);
        if (saved != null) {
            try {
                messages = new JSONArray(saved);
            } catch (Exception ignored) { }
        }

        adapter = new ChatAdapter(this, messages);
        chatList.setAdapter(adapter);

        btnSend.setOnClickListener(v -> onSend());
        btnNewChat.setOnClickListener(v -> {
            if (streaming) return;
            messages = new JSONArray();
            persist();
            adapter = new ChatAdapter(this, messages);
            chatList.setAdapter(adapter);
        });
        btnSettings.setOnClickListener(v ->
                startActivityForResult(new Intent(this, SettingsActivity.class), REQ_SETTINGS));
    }

    private void onSend() {
        String text = inputField.getText().toString().trim();
        if (text.isEmpty() || streaming) return;
        inputField.setText("");

        addMessage("user", text);

        String apiKey = Store.get(this, "apiKey", "");
        if (apiKey.isEmpty()) {
            addMessage("assistant",
                    "No tengo ninguna API key configurada.\nToca ⚙ y pega tu API key (OpenAI, Mistral, Groq, DeepSeek o la que uses).");
            return;
        }

        streaming = true;
        btnSend.setText("■");

        JSONArray payload = buildPayload();
        addMessage("assistant", "");
        int idx = messages.length() - 1;

        ai.stream(Store.endpoint(this), apiKey, Store.model(this), payload,
                new AiClient.StreamListener() {
                    final StringBuilder sb = new StringBuilder();

                    @Override
                    public void onDelta(String delta) {
                        sb.append(delta);
                        try {
                            messages.getJSONObject(idx).put("content", sb.toString());
                        } catch (Exception ignored) { }
                        runOnUiThread(adapter::notifyDataSetChanged);
                    }

                    @Override
                    public void onDone() {
                        if (sb.length() == 0) {
                            try {
                                messages.getJSONObject(idx).put("content", "(respuesta vacía)");
                            } catch (Exception ignored) { }
                        }
                        finishStream();
                    }

                    @Override
                    public void onError(String message) {
                        try {
                            messages.getJSONObject(idx).put("content",
                                    sb.length() > 0 ? sb.append("\n\n⚠️ ").append(message).toString()
                                            : "⚠️ " + message);
                        } catch (Exception ignored) { }
                        finishStream();
                    }
                });
    }

    private void finishStream() {
        runOnUiThread(() -> {
            streaming = false;
            btnSend.setText("↑");
            adapter.notifyDataSetChanged();
            persist();
        });
    }

    private JSONArray buildPayload() {
        JSONArray arr = new JSONArray();
        for (int i = 0; i < messages.length(); i++) {
            JSONObject m = messages.optJSONObject(i);
            if (m == null) continue;
            String content = m.optString("content", "").trim();
            if (content.isEmpty()) continue;
            try {
                arr.put(new JSONObject().put("role", m.getString("role")).put("content", content));
            } catch (Exception ignored) { }
        }
        return arr;
    }

    private void addMessage(String role, String content) {
        try {
            messages.put(new JSONObject().put("role", role).put("content", content));
        } catch (Exception ignored) { }
        adapter.notifyDataSetChanged();
        chatList.setSelection(messages.length() - 1);
        persist();
    }

    private void persist() {
        Store.set(this, "history", messages.toString());
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_SETTINGS && resultCode == RESULT_OK) {
            Toast.makeText(this, "Configuración guardada", Toast.LENGTH_SHORT).show();
        }
    }
}
