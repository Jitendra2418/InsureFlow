package com.insureflow.api.support;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import com.fasterxml.jackson.databind.ser.std.StdSerializer;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * JavaScript value semantics used by the former Express server, so every route
 * validates, coerces and serializes exactly as Node did. Request bodies are kept as
 * plain Map/List/String/Number/Boolean/null, with UNDEFINED for absent keys.
 */
public final class Js {

    private Js() {}

    /** JavaScript `undefined`: absent object keys. Omitted from JSON objects, null in arrays. */
    public static final Object UNDEFINED = new Object() {
        @Override public String toString() { return "undefined"; }
    };

    /** A TypeError thrown by JavaScript code (e.g. calling .trim() on null). */
    public static class JsError extends RuntimeException {
        public JsError(String message) { super(message); }
    }

    public static final ObjectMapper MAPPER = new ObjectMapper();

    static {
        SimpleModule m = new SimpleModule("js-numbers");
        m.addSerializer(Double.class, new StdSerializer<>(Double.class) {
            @Override public void serialize(Double v, JsonGenerator g, SerializerProvider p) throws IOException {
                writeJsNumber(v, g);
            }
        });
        m.addSerializer(Float.class, new StdSerializer<>(Float.class) {
            @Override public void serialize(Float v, JsonGenerator g, SerializerProvider p) throws IOException {
                writeJsNumber(v.doubleValue(), g);
            }
        });
        m.addSerializer(JsDate.class, new StdSerializer<>(JsDate.class) {
            @Override public void serialize(JsDate v, JsonGenerator g, SerializerProvider p) throws IOException {
                if (v.isValid()) g.writeString(v.toISOString()); else g.writeNull();
            }
        });
        MAPPER.registerModule(m);
    }

    private static void writeJsNumber(double d, JsonGenerator g) throws IOException {
        if (Double.isNaN(d) || Double.isInfinite(d)) g.writeNull(); else g.writeNumber(numberToString(d));
    }

    // ---------------------------------------------------------------- objects

    /** Parse a request body like express.json(): empty body -> {}. */
    public static Object parseBody(String raw) {
        if (raw == null || raw.isBlank()) return new LinkedHashMap<String, Object>();
        try {
            return MAPPER.readValue(raw, Object.class);
        } catch (IOException e) {
            throw new ApiError(400, Map.of("error", "Invalid JSON body"));
        }
    }

    /** `o.key` */
    public static Object prop(Object o, String key) {
        if (o == null || o == UNDEFINED) {
            throw new JsError("Cannot read properties of " + (o == null ? "null" : "undefined") + " (reading '" + key + "')");
        }
        if (o instanceof Map<?, ?> m) return m.containsKey(key) ? m.get(key) : UNDEFINED;
        if (o instanceof List<?> l && key.equals("length")) return l.size();
        if (o instanceof String s && key.equals("length")) return s.length();
        return UNDEFINED;
    }

    public static boolean isUndefined(Object v) { return v == UNDEFINED; }

    /** `v` used as a condition. */
    public static boolean truthy(Object v) {
        if (v == null || v == UNDEFINED) return false;
        if (v instanceof Boolean b) return b;
        if (v instanceof Number n) { double d = n.doubleValue(); return d != 0 && !Double.isNaN(d); }
        if (v instanceof String s) return !s.isEmpty();
        return true;
    }

    /** `a || b` */
    public static Object or(Object a, Object b) { return truthy(a) ? a : b; }

    /** `v.trim()`; `expr` is the source expression, used in the TypeError message. */
    public static String trim(Object v, String expr) {
        if (v instanceof String s) return jsTrim(s);
        if (v == null || v == UNDEFINED) {
            throw new JsError("Cannot read properties of " + (v == null ? "null" : "undefined") + " (reading 'trim')");
        }
        throw new JsError(expr + ".trim is not a function");
    }

    /** String.prototype.trim() */
    public static String jsTrim(String s) { return s.strip(); }

    /** `v === w` for the primitive comparisons the server makes. */
    public static boolean strictEquals(Object v, Object w) {
        if (v == w) return true;
        if (v == null || w == null || v == UNDEFINED || w == UNDEFINED) return false;
        if (v instanceof Number a && w instanceof Number b) return a.doubleValue() == b.doubleValue();
        return v.equals(w);
    }

    // ---------------------------------------------------------------- strings

    /** `String(v)` / template literal interpolation. */
    public static String str(Object v) {
        if (v == null) return "null";
        if (v == UNDEFINED) return "undefined";
        if (v instanceof String s) return s;
        if (v instanceof Boolean b) return b.toString();
        if (v instanceof Integer || v instanceof Long || v instanceof Short) return v.toString();
        if (v instanceof Number n) return numberToString(n.doubleValue());
        if (v instanceof JsDate d) return d.toString();
        if (v instanceof List<?> l) {
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < l.size(); i++) {
                if (i > 0) sb.append(',');
                Object e = l.get(i);
                if (e != null && e != UNDEFINED) sb.append(str(e));
            }
            return sb.toString();
        }
        if (v instanceof Map) return "[object Object]";
        return v.toString();
    }

    /** Number.prototype.toString() for a double. */
    public static String numberToString(double d) {
        if (Double.isNaN(d)) return "NaN";
        if (Double.isInfinite(d)) return d > 0 ? "Infinity" : "-Infinity";
        if (d == 0) return "0";
        double abs = Math.abs(d);
        String java = Double.toString(d); // shortest round-trip digits; uses E notation in this range
        if (abs >= 1e21 || abs < 1e-6) {
            int e = java.indexOf('E');
            String mant = java.substring(0, e);
            String exp = java.substring(e + 1);
            if (mant.endsWith(".0")) mant = mant.substring(0, mant.length() - 2);
            return mant + "e" + (exp.startsWith("-") ? exp : "+" + exp);
        }
        return new BigDecimal(java).stripTrailingZeros().toPlainString();
    }

    /** Number.prototype.toFixed(digits). */
    public static String toFixed(double d, int digits) {
        if (Double.isNaN(d)) return "NaN";
        if (Math.abs(d) >= 1e21 || Double.isInfinite(d)) return numberToString(d);
        return new BigDecimal(d).setScale(digits, RoundingMode.HALF_UP).toPlainString();
    }

    // ---------------------------------------------------------------- numbers

    private static final Pattern DECIMAL_LITERAL =
            Pattern.compile("[+-]?(?:Infinity|(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)");
    private static final Pattern PARSE_FLOAT_PREFIX =
            Pattern.compile("^[+-]?(?:Infinity|(?:\\d+\\.?\\d*|\\.\\d+)(?:[eE][+-]?\\d+)?)");
    private static final Pattern PARSE_INT_PREFIX = Pattern.compile("^[+-]?\\d+");

    /** `Number(v)`, also the implicit coercion used by `<`, `>` and `%`. */
    public static double toNumber(Object v) {
        if (v == null) return 0;
        if (v == UNDEFINED) return Double.NaN;
        if (v instanceof Boolean b) return b ? 1 : 0;
        if (v instanceof Number n) return n.doubleValue();
        if (v instanceof List<?> l) {
            if (l.isEmpty()) return 0;
            return l.size() == 1 ? toNumber(str(l.get(0))) : Double.NaN;
        }
        if (v instanceof String s) {
            String t = jsTrim(s);
            if (t.isEmpty()) return 0;
            String lower = t.toLowerCase();
            try {
                if (lower.startsWith("0x")) return Long.parseLong(t.substring(2), 16);
                if (lower.startsWith("0o")) return Long.parseLong(t.substring(2), 8);
                if (lower.startsWith("0b")) return Long.parseLong(t.substring(2), 2);
            } catch (NumberFormatException e) {
                return Double.NaN;
            }
            if (!DECIMAL_LITERAL.matcher(t).matches()) return Double.NaN;
            return parseDecimal(t);
        }
        return Double.NaN;
    }

    /** Global `parseFloat(v)`. */
    public static double parseFloat(Object v) {
        if (v instanceof Number n) return n.doubleValue();
        Matcher m = PARSE_FLOAT_PREFIX.matcher(str(v).stripLeading());
        return m.find() ? parseDecimal(m.group()) : Double.NaN;
    }

    /** Global `parseInt(v, 10)`. */
    public static double parseInt(Object v) {
        Matcher m = PARSE_INT_PREFIX.matcher(str(v).stripLeading());
        return m.find() ? new BigDecimal(m.group()).doubleValue() : Double.NaN;
    }

    private static double parseDecimal(String s) {
        if (s.endsWith("Infinity")) return s.startsWith("-") ? Double.NEGATIVE_INFINITY : Double.POSITIVE_INFINITY;
        return Double.parseDouble(s);
    }

    // ---------------------------------------------------------------- JSON

    /** `JSON.stringify(v)`. */
    public static String stringify(Object v) {
        try {
            return MAPPER.writeValueAsString(clean(v));
        } catch (IOException e) {
            throw new IllegalStateException(e);
        }
    }

    /** Drops UNDEFINED members from objects and turns UNDEFINED array items into null. */
    public static Object clean(Object v) {
        if (v instanceof Map<?, ?> m) {
            Map<String, Object> out = new LinkedHashMap<>();
            for (Map.Entry<?, ?> e : m.entrySet()) {
                if (e.getValue() != UNDEFINED) out.put(String.valueOf(e.getKey()), clean(e.getValue()));
            }
            return out;
        }
        if (v instanceof List<?> l) {
            List<Object> out = new ArrayList<>(l.size());
            for (Object e : l) out.add(e == UNDEFINED ? null : clean(e));
            return out;
        }
        return v;
    }

    /** Value as node-pg sends it to Postgres (prepareValue): everything as text. */
    public static String paramString(Object v) {
        if (v == null || v == UNDEFINED) return null;
        if (v instanceof Map || v instanceof List) return stringify(v);
        return str(v);
    }

    /** LinkedHashMap from alternating key/value arguments, like an object literal. */
    public static Map<String, Object> obj(Object... kv) {
        Map<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) m.put((String) kv[i], kv[i + 1]);
        return m;
    }
}
