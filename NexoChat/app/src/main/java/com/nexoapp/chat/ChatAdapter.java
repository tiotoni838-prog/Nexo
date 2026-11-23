package com.nexoapp.chat;

import android.content.Context;
import android.graphics.Color;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.widget.BaseAdapter;
import android.widget.FrameLayout;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

public class ChatAdapter extends BaseAdapter {

    private final Context ctx;
    private final JSONArray messages;

    public ChatAdapter(Context ctx, JSONArray messages) {
        this.ctx = ctx;
        this.messages = messages;
    }

    @Override
    public int getCount() {
        return messages.length();
    }

    @Override
    public JSONObject getItem(int position) {
        return messages.optJSONObject(position);
    }

    @Override
    public long getItemId(int position) {
        return position;
    }

    @Override
    public View getView(int position, View convertView, ViewGroup parent) {
        FrameLayout root = (convertView instanceof FrameLayout)
                ? (FrameLayout) convertView
                : (FrameLayout) android.view.LayoutInflater.from(ctx)
                        .inflate(R.layout.item_chat, parent, false);
        TextView bubble = root.findViewById(R.id.bubble);

        JSONObject m = getItem(position);
        boolean user = m != null && "user".equals(m.optString("role"));
        String text = m == null ? "" : m.optString("content", "");

        bubble.setText(text.isEmpty() ? "…" : text);

        FrameLayout.LayoutParams lp = (FrameLayout.LayoutParams) bubble.getLayoutParams();
        if (user) {
            lp.gravity = Gravity.END;
            lp.topMargin = dp(6);
            int h = dp(6);
            bubble.setPadding(bubble.getPaddingLeft(), bubble.getPaddingTop(),
                    bubble.getPaddingRight() + h, bubble.getPaddingBottom());
            bubble.setBackgroundResource(R.drawable.bg_user_bubble);
            bubble.setTextColor(ctx.getColor(R.color.text));
        } else {
            lp.gravity = Gravity.START;
            lp.topMargin = dp(6);
            bubble.setBackground(null);
            bubble.setPadding(dp(4), bubble.getPaddingTop(), dp(4), bubble.getPaddingBottom());
            bubble.setTextColor(ctx.getColor(R.color.text));
        }
        bubble.setLayoutParams(lp);
        return root;
    }

    private int dp(int v) {
        return (int) TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v,
                ctx.getResources().getDisplayMetrics());
    }
}
