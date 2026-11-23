package com.nexo.server;

import android.Manifest;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.widget.Button;
import android.widget.EditText;
import android.widget.TextView;

public class MainActivity extends android.app.Activity implements BotService.StatusListener {

    private static final long WIPE_DELAY_MS = 10 * 60 * 1000;

    private TextView statusText, logText;
    private android.view.View statusDot;
    private Button btnToggle, btnSave;
    private EditText fieldToken, fieldApiBase, fieldModel, fieldApiKey, fieldSystem;

    private final Handler handler = new Handler(Looper.getMainLooper());
    private final StringBuilder logBuf = new StringBuilder();
    private final Runnable wipeSecrets = this::reloadFields;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        statusText = findViewById(R.id.statusText);
        statusDot = findViewById(R.id.statusDot);
        logText = findViewById(R.id.logText);
        btnToggle = findViewById(R.id.btnToggle);
        btnSave = findViewById(R.id.btnSave);
        fieldToken = findViewById(R.id.fieldToken);
        fieldApiBase = findViewById(R.id.fieldApiBase);
        fieldModel = findViewById(R.id.fieldModel);
        fieldApiKey = findViewById(R.id.fieldApiKey);
        fieldSystem = findViewById(R.id.fieldSystem);

        if (Prefs.get(this, "apiBase", "").isEmpty()) {
            Prefs.set(this, "apiBase", "https://api.mistral.ai/v1");
            Prefs.set(this, "model", "mistral-large-latest");
        }

        reloadFields();

        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                != PackageManager.PERMISSION_GRANTED) {
            requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1);
        }

        btnSave.setOnClickListener(v -> {
            Prefs.set(this, "token", fieldToken.getText().toString().trim());
            Prefs.set(this, "apiBase", fieldApiBase.getText().toString().trim());
            Prefs.set(this, "model", fieldModel.getText().toString().trim());
            Prefs.set(this, "apiKey", fieldApiKey.getText().toString().trim());
            Prefs.set(this, "system", fieldSystem.getText().toString());
            maskSecrets();
            appendLog("• Configuración guardada");
            if (BotService.running) {
                stopService(new Intent(this, BotService.class));
                startForegroundService(new Intent(this, BotService.class));
            }
        });

        btnToggle.setOnClickListener(v -> {
            if (BotService.running) {
                stopService(new Intent(this, BotService.class));
                markStatus(true, "INICIAR BOT", "Bot detenido", R.drawable.dot_off);
            } else {
                Prefs.set(this, "token", fieldToken.getText().toString().trim());
                Prefs.set(this, "apiBase", fieldApiBase.getText().toString().trim());
                Prefs.set(this, "model", fieldModel.getText().toString().trim());
                Prefs.set(this, "apiKey", fieldApiKey.getText().toString().trim());
                Prefs.set(this, "system", fieldSystem.getText().toString());
                if (Prefs.get(this, "token", "").trim().isEmpty()) {
                    appendLog("• Escribe el token del bot primero.");
                    return;
                }
                startForegroundService(new Intent(this, BotService.class));
            }
        });

        if (BotService.running) {
            markStatus(true, "DETENER BOT", BotService.running ? "Bot encendido" : "Bot detenido",
                    R.drawable.dot_on);
        }
    }

    private void reloadFields() {
        fieldToken.setText(Prefs.get(this, "token", "").matches(".*\\*{4}.*")
                ? "••••••••" : Prefs.get(this, "token", ""));
        fieldApiBase.setText(Prefs.get(this, "apiBase", ""));
        fieldModel.setText(Prefs.get(this, "model", ""));
        fieldApiKey.setText("");
        fieldSystem.setText(Prefs.get(this, "system", ""));
        fieldToken.setHint(fieldToken.getText().length() == 0
                ? "Token del bot de Discord" : "Token guardado (déjalo igual o escribe uno nuevo)");
    }

    private void maskSecrets() {
        if (!fieldToken.getText().toString().trim().isEmpty()
                && !fieldToken.getText().toString().contains("••")) {
            fieldToken.setText("••••••••");
            fieldToken.setHint("Token guardado");
        }
        if (!fieldApiKey.getText().toString().trim().isEmpty()) {
            fieldApiKey.setText("••••••••");
            fieldApiKey.setHint("API key guardada");
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        BotService.ui = this;
        maskSecrets();
    }

    @Override
    protected void onPause() {
        BotService.ui = null;
        handler.postDelayed(wipeSecrets, WIPE_DELAY_MS);
        super.onPause();
    }

    @Override
    protected void onStop() {
        super.onStop();
    }

    @Override
    protected void onDestroy() {
        handler.removeCallbacks(wipeSecrets);
        if (BotService.ui == this) BotService.ui = null;
        super.onDestroy();
    }

    private void markStatus(boolean connected, String btn, String text, int dot) {
        btnToggle.setText(btn);
        statusText.setText(text);
        statusDot.setBackgroundResource(dot);
    }

    @Override
    public void onStatus(boolean connected, String message) {
        markStatus(connected,
                connected ? "DETENER BOT" : "INICIAR BOT",
                message,
                connected ? R.drawable.dot_on : R.drawable.dot_off);
    }

    @Override
    public void appendLog(String line) {
        logBuf.insert(0, line + "\n");
        if (logBuf.length() > 4000) logBuf.setLength(4000);
        logText.setText(logBuf.toString());
    }
}
