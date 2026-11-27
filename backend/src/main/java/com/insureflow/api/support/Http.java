package com.insureflow.api.support;

import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.bcrypt.BCrypt;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.List;
import java.util.Map;

/** `res.status(s).json(body)` plus the bcryptjs calls the routes share. */
public final class Http {

    private Http() {}

    public static ResponseEntity<Object> json(int status, Object body) {
        return ResponseEntity.status(status).contentType(MediaType.APPLICATION_JSON).body(body);
    }

    public static ResponseEntity<Object> ok(Object body) { return json(200, body); }

    public static ResponseEntity<Object> error(int status, String message) { return json(status, Map.of("error", message)); }

    /** `console.error(log, err); res.status(500).json({ error: prefix + err.message })` */
    public static ResponseEntity<Object> fail(String log, String prefix, Exception e) {
        System.err.println(log + " " + e);
        return error(500, prefix + e.getMessage());
    }

    public static ResponseEntity<Object> dbFail(String log, Exception e) { return fail(log, "Database error: ", e); }

    /** `rows[0]`, or UNDEFINED when there is none. */
    public static Object first(List<Map<String, Object>> rows) { return rows.isEmpty() ? Js.UNDEFINED : rows.get(0); }

    /** `bcrypt.hash(password, await bcrypt.genSalt(12))` */
    public static String hashPassword(Object password) {
        return BCrypt.hashpw(passwordBytes(password), BCrypt.gensalt(12));
    }

    /** `bcrypt.compare(password, hash)` */
    public static boolean checkPassword(Object password, Object hash) {
        if (!(hash instanceof String h)) throw new Js.JsError("Illegal arguments: " + typeOf(password) + ", " + typeOf(hash));
        return BCrypt.checkpw(passwordBytes(password), h);
    }

    /** bcryptjs only uses the first 72 bytes of the password. */
    private static byte[] passwordBytes(Object password) {
        if (!(password instanceof String s)) throw new Js.JsError("Illegal arguments: " + typeOf(password) + ", string");
        byte[] b = s.getBytes(StandardCharsets.UTF_8);
        return b.length > 72 ? Arrays.copyOf(b, 72) : b;
    }

    private static String typeOf(Object v) {
        if (v == Js.UNDEFINED) return "undefined";
        if (v instanceof String) return "string";
        if (v instanceof Number) return "number";
        if (v instanceof Boolean) return "boolean";
        return "object";
    }
}
