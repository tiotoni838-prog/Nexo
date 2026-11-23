package com.nexoapp.chat;

import android.content.Context;
import android.content.SharedPreferences;

public class Store {
    private static SharedPreferences sp(Context c) {
        return c.getSharedPreferences("nexo_chat", Context.MODE_PRIVATE);
    }

    public static String get(Context c, String key, String def) {
        return sp(c).getString(key, def);
    }

    public static void set(Context c, String key, String value) {
        sp(c).edit().putString(key, value).apply();
    }

    public static String endpoint(Context c) {
        String e = get(c, "endpoint", "");
        if (e.isEmpty()) return "https://api.openai.com/v1";
        return e.endsWith("/") ? e.substring(0, e.length() - 1) : e;
    }

    public static String model(Context c) {
        String m = get(c, "model", "");
        return m.isEmpty() ? "gpt-4o-mini" : m;
    }
}
