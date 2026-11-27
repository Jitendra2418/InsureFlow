package com.insureflow.api.support;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * HS256 tokens compatible with the `jsonwebtoken` package the Node server used: the same
 * header, claims and 24h expiry, and the same verification rules. Tokens issued by either
 * server are accepted by the other. Written on the JDK instead of jjwt because jjwt rejects
 * secrets shorter than 32 bytes, which jsonwebtoken accepts.
 */
public final class Jwt {

    private Jwt() {}

    public static class JwtError extends Exception {
        public JwtError(String message) { super(message); }
    }

    private static final Map<String, String> ALGS = Map.of("HS256", "HmacSHA256", "HS384", "HmacSHA384", "HS512", "HmacSHA512");
    private static final Set<String> ALLOWED = ALGS.keySet();
    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64D = Base64.getUrlDecoder();

    /** `jwt.sign(claims, secret, { expiresIn: '24h' })` */
    public static String sign(Map<String, Object> claims, String secret) {
        long iat = System.currentTimeMillis() / 1000;
        Map<String, Object> payload = new LinkedHashMap<>(claims);
        payload.put("iat", iat);
        payload.put("exp", iat + 24 * 60 * 60);
        String head = B64.encodeToString("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
        String body = B64.encodeToString(Js.stringify(payload).getBytes(StandardCharsets.UTF_8));
        return head + "." + body + "." + hmac("HS256", head + "." + body, secret);
    }

    /** `jwt.verify(token, secret)`: returns the payload or throws. */
    public static Object verify(String token, String secret) throws JwtError {
        String[] parts = token.split("\\.", -1);
        if (parts.length != 3) throw new JwtError("jwt malformed");
        Object header;
        String payloadText;
        try {
            header = Js.MAPPER.readValue(B64D.decode(parts[0]), Object.class);
            payloadText = new String(B64D.decode(parts[1]), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new JwtError("invalid token");
        }
        if (!(header instanceof Map<?, ?> h) || !(h.get("alg") instanceof String alg)) throw new JwtError("invalid token");
        if (parts[2].isEmpty()) throw new JwtError("jwt signature is required");
        if (!ALLOWED.contains(alg)) throw new JwtError("invalid algorithm");
        byte[] expected = hmac(alg, parts[0] + "." + parts[1], secret).getBytes(StandardCharsets.US_ASCII);
        if (!MessageDigest.isEqual(expected, parts[2].getBytes(StandardCharsets.US_ASCII))) throw new JwtError("invalid signature");

        Object payload;
        try {
            payload = Js.MAPPER.readValue(payloadText, Object.class);
        } catch (Exception e) {
            payload = payloadText;
        }
        if (payload instanceof Map<?, ?> p) {
            double now = Math.floor(System.currentTimeMillis() / 1000.0);
            if (p.containsKey("nbf")) {
                if (!(p.get("nbf") instanceof Number nbf)) throw new JwtError("invalid nbf value");
                if (nbf.doubleValue() > now) throw new JwtError("jwt not active");
            }
            if (p.containsKey("exp")) {
                if (!(p.get("exp") instanceof Number exp)) throw new JwtError("invalid exp value");
                if (now >= exp.doubleValue()) throw new JwtError("jwt expired");
            }
        }
        return payload;
    }

    private static String hmac(String alg, String data, String secret) {
        try {
            Mac mac = Mac.getInstance(ALGS.get(alg));
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), ALGS.get(alg)));
            return B64.encodeToString(mac.doFinal(data.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
