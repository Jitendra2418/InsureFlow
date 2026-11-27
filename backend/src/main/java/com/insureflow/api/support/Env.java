package com.insureflow.api.support;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Configuration exactly as the Node server read it: `require('dotenv').config()` loads `.env`
 * from the working directory without overriding real environment variables, then each setting
 * is `process.env.X || default`.
 */
public final class Env {

    private Env() {}

    // dotenv 16 LINE regex
    private static final Pattern LINE = Pattern.compile(
            "(?:^|^)\\s*(?:export\\s+)?([\\w.-]+)(?:\\s*=\\s*?|:\\s+?)(\\s*'(?:\\\\'|[^'])*'|\\s*\"(?:\\\\\"|[^\"])*\"|\\s*`(?:\\\\`|[^`])*`|[^#\\r\\n]+)?\\s*(?:#.*)?(?:$|$)",
            Pattern.MULTILINE);

    private static final Map<String, String> DOTENV = load(Path.of(".env"));

    static Map<String, String> load(Path file) {
        Map<String, String> out = new HashMap<>();
        if (!Files.isRegularFile(file)) return out;
        try {
            String src = Files.readString(file).replaceAll("\\r\\n?", "\n");
            Matcher m = LINE.matcher(src);
            while (m.find()) {
                String value = m.group(2) == null ? "" : m.group(2).trim();
                boolean doubleQuoted = value.startsWith("\"");
                value = value.replaceAll("^(['\"`])([\\s\\S]*)\\1$", "$2");
                if (doubleQuoted) value = value.replace("\\n", "\n").replace("\\r", "\r");
                out.put(m.group(1), value);
            }
        } catch (IOException e) {
            System.err.println("[dotenv] failed to load .env: " + e.getMessage());
        }
        return out;
    }

    /** `process.env[key] || fallback` */
    public static String get(String key, String fallback) {
        String v = System.getenv(key);
        if (v == null) v = DOTENV.get(key);
        return v == null || v.isEmpty() ? fallback : v;
    }

    /** `process.env[key]`, or null when unset. */
    public static String raw(String key) {
        String v = System.getenv(key);
        return v != null ? v : DOTENV.get(key);
    }
}
