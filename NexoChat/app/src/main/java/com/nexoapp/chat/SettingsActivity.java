package com.nexoapp.chat;

import android.app.Activity;
import android.os.Bundle;
import android.widget.Button;
import android.widget.EditText;

public class SettingsActivity extends Activity {

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_settings);

        EditText endpoint = findViewById(R.id.fieldEndpoint);
        EditText model = findViewById(R.id.fieldModel);
        EditText apiKey = findViewById(R.id.fieldApiKey);
        Button save = findViewById(R.id.btnSave);

        endpoint.setText(Store.get(this, "endpoint", "https://api.openai.com/v1"));
        model.setText(Store.get(this, "model", "gpt-4o-mini"));
        String savedKey = Store.get(this, "apiKey", "");
        if (!savedKey.isEmpty()) {
            apiKey.setText("••••••••");
            apiKey.setHint("API key guardada (déjala igual o cambia)");
        }

        save.setOnClickListener(v -> {
            String ep = endpoint.getText().toString().trim();
            String md = model.getText().toString().trim();
            String key = apiKey.getText().toString().trim();

            if (!ep.isEmpty()) Store.set(this, "endpoint", ep);
            if (!md.isEmpty()) Store.set(this, "model", md);

            String current = Store.get(this, "apiKey", "");
            if (!key.isEmpty() && !key.contains("••")) {
                Store.set(this, "apiKey", key);
            } else if (!current.isEmpty() && (key.isEmpty() || key.contains("••"))) {
                Store.set(this, "apiKey", current);
            }

            setResult(RESULT_OK);
            finish();
        });
    }
}
