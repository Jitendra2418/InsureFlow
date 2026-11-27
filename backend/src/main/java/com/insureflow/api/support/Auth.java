package com.insureflow.api.support;

import com.insureflow.api.config.AppConfig;
import jakarta.servlet.http.HttpServletRequest;

import java.util.Map;

/** The server's `authenticateToken` and `authorizeStaff` middleware. Both return `req.user`. */
public final class Auth {

    private Auth() {}

    public static Object user(HttpServletRequest req) {
        String header = req.getHeader("authorization");
        String token = null;
        if (header != null && !header.isEmpty()) {
            String[] parts = header.split(" ", -1);
            token = parts.length > 1 ? parts[1] : null;
        }
        if (token == null || token.isEmpty()) {
            throw new ApiError(401, Map.of("error", "Access token required. Please sign in."));
        }
        try {
            return Jwt.verify(token, AppConfig.jwtSecret());
        } catch (Jwt.JwtError e) {
            throw new ApiError(403, Map.of("error", "Session expired or invalid token. Please log in again."));
        }
    }

    public static Object staff(HttpServletRequest req) {
        Object user = user(req);
        Object role = Js.prop(user, "role");
        if (!Js.truthy(user) || (!"ADMIN".equals(role) && !"OPERATIONS".equals(role))) {
            throw new ApiError(403, Map.of("error", "Access Denied: Administrative or operations privileges required."));
        }
        return user;
    }

    /** `req.user.id` */
    public static Object id(Object user) { return Js.prop(user, "id"); }
}
