package com.insureflow.api.controller;

import com.insureflow.api.config.AppConfig;
import com.insureflow.api.support.Db;
import com.insureflow.api.support.JsDate;
import com.insureflow.api.support.Jwt;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Locale;
import java.util.Map;

import static com.insureflow.api.support.Http.*;
import static com.insureflow.api.support.Js.*;

/** server.js routes 2, 3, 3b, 3c: customer and staff registration / sign in. */
@RestController
public class AuthController {

    private final Db db;

    public AuthController(Db db) { this.db = db; }

    private static String token(Map<String, Object> user) {
        return Jwt.sign(obj("id", user.get("id"), "email", user.get("email"), "role", user.get("role")), AppConfig.jwtSecret());
    }

    private static String lower(String s) { return s.toLowerCase(Locale.ROOT); }

    @PostMapping("/api/auth/register")
    public ResponseEntity<Object> register(@RequestBody(required = false) String raw) {
        Object b = parseBody(raw);
        Object email = prop(b, "email"), password = prop(b, "password"), firstName = prop(b, "firstName"),
                lastName = prop(b, "lastName"), dateOfBirth = prop(b, "dateOfBirth"), phone = prop(b, "phone"),
                aadharNumber = prop(b, "aadharNumber");

        if (!truthy(email) || !truthy(password) || !truthy(firstName) || !truthy(lastName) || !truthy(dateOfBirth) || !truthy(aadharNumber)) {
            return error(400, "Please provide all required fields, including your 12-digit Aadhaar Number.");
        }

        String cleanAadhar = str(aadharNumber).replaceAll("(?U)[\\s-]", "");
        if (!cleanAadhar.matches("\\d{12}")) {
            return error(400, "Invalid Aadhaar Number. Aadhaar must be exactly 12 numeric digits.");
        }

        JsDate dob = JsDate.parse(dateOfBirth);
        JsDate today = JsDate.now();
        double age = today.getFullYear() - dob.getFullYear();
        double m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m == 0 && today.getDate() < dob.getDate())) age--;

        if (Double.isNaN(age) || age < 18 || age > 69) {
            return error(400, "Underwriting requirement: Customer must be between 18 and 69 years of age.");
        }

        try {
            if (!db.query("SELECT id FROM users WHERE aadhar_number = $1", cleanAadhar).isEmpty()) {
                return error(409, "Duplicate Registration Blocked: A customer account with Aadhaar Number ending in ..."
                        + cleanAadhar.substring(cleanAadhar.length() - 4) + " is already registered in InsureFlow.");
            }
            if (!db.query("SELECT id FROM users WHERE email = $1", lower(trim(email, "email"))).isEmpty()) {
                return error(409, "An account with this email address already exists. Please sign in.");
            }

            String passwordHash = hashPassword(password);
            List<Map<String, Object>> result = db.query("""
                      INSERT INTO users (email, password_hash, first_name, last_name, date_of_birth, phone, aadhar_number, role)
                      VALUES ($1, $2, $3, $4, $5, $6, $7, 'CUSTOMER')
                      RETURNING id, email, first_name, last_name, date_of_birth, phone, aadhar_number, role, created_at
                    """,
                    lower(trim(email, "email")), passwordHash, trim(firstName, "firstName"), trim(lastName, "lastName"),
                    dateOfBirth, or(phone, null), cleanAadhar);
            Map<String, Object> u = result.get(0);

            return json(201, obj(
                    "message", "Customer account successfully created.",
                    "token", token(u),
                    "user", obj("id", u.get("id"), "email", u.get("email"), "firstName", u.get("first_name"),
                            "lastName", u.get("last_name"), "dateOfBirth", u.get("date_of_birth"), "phone", u.get("phone"),
                            "aadharNumber", u.get("aadhar_number"), "role", u.get("role"))));
        } catch (RuntimeException e) {
            return dbFail("Error during customer registration:", e);
        }
    }

    @PostMapping("/api/auth/login")
    public ResponseEntity<Object> login(@RequestBody(required = false) String raw) {
        Object b = parseBody(raw);
        Object email = prop(b, "email"), password = prop(b, "password");

        if (!truthy(email) || !truthy(password)) {
            return error(400, "Email or Aadhaar Number and password are required.");
        }

        try {
            String rawInput = trim(email, "email");
            String cleanDigits = rawInput.replaceAll("(?U)[\\s-]", "");

            List<Map<String, Object>> result = db.query("SELECT * FROM users WHERE email = $1 OR aadhar_number = $2", lower(rawInput), cleanDigits);
            if (result.isEmpty()) return error(401, "Invalid email/Aadhaar or password.");

            Map<String, Object> user = result.get(0);
            if (!"CUSTOMER".equals(user.get("role"))) {
                return error(403, "Access Denied: Account '" + str(user.get("email")) + "' is registered with administrative role '"
                        + str(user.get("role")) + "'. This portal is exclusively for Customers. Aman and Operations staff must log in through the Admin Portal.");
            }
            if (!checkPassword(password, user.get("password_hash"))) return error(401, "Invalid email/Aadhaar or password.");

            return ok(obj(
                    "message", "Sign in successful.",
                    "token", token(user),
                    "user", obj("id", user.get("id"), "email", user.get("email"), "firstName", user.get("first_name"),
                            "lastName", user.get("last_name"), "dateOfBirth", user.get("date_of_birth"), "phone", user.get("phone"),
                            "aadharNumber", user.containsKey("aadhar_number") ? user.get("aadhar_number") : UNDEFINED,
                            "role", user.get("role"))));
        } catch (RuntimeException e) {
            return dbFail("Error during customer login:", e);
        }
    }

    @PostMapping("/api/auth/admin/register")
    public ResponseEntity<Object> adminRegister(@RequestBody(required = false) String raw) {
        Object b = parseBody(raw);
        Object name = prop(b, "name"), firstName = prop(b, "firstName"), lastName = prop(b, "lastName"),
                email = prop(b, "email"), phone = prop(b, "phone"), password = prop(b, "password"), role = prop(b, "role");

        String fName = trim(or(firstName, ""), "(firstName || '')");
        String lName = trim(or(lastName, ""), "(lastName || '')");

        if (fName.isEmpty() && truthy(name)) {
            String[] parts = trim(name, "name").split("(?U)\\s+");
            fName = parts[0];
            lName = parts.length > 1 ? String.join(" ", List.of(parts).subList(1, parts.length)) : "";
            if (lName.isEmpty()) lName = "Staff";
        }

        if (!truthy(email) || !truthy(password) || fName.isEmpty() || lName.isEmpty() || !truthy(phone)) {
            return error(400, "Please provide full name, email, phone number, and password.");
        }
        if (toNumber(prop(password, "length")) < 8) {
            return error(400, "Password must be at least 8 characters long.");
        }

        String assignedRole = ("OPERATIONS".equals(role) || "OPERATOR".equals(role)) ? "OPERATIONS" : "ADMIN";
        String normalizedEmail = lower(trim(email, "email"));

        try {
            if (!db.query("SELECT id FROM users WHERE email = $1", normalizedEmail).isEmpty()) {
                return error(409, "An account with this email address already exists. Please sign in.");
            }

            String passwordHash = hashPassword(password);
            Map<String, Object> u = db.query("""
                      INSERT INTO users (email, password_hash, first_name, last_name, phone, role)
                      VALUES ($1, $2, $3, $4, $5, $6)
                      RETURNING id, email, first_name, last_name, date_of_birth, phone, role, created_at
                    """, normalizedEmail, passwordHash, fName, lName, trim(phone, "phone"), assignedRole).get(0);

            return json(201, obj(
                    "message", ("OPERATIONS".equals(assignedRole) ? "Operator" : "Administrator") + " account successfully created.",
                    "token", token(u),
                    "user", obj("id", u.get("id"), "email", u.get("email"), "firstName", u.get("first_name"),
                            "lastName", u.get("last_name"), "phone", u.get("phone"), "role", u.get("role"))));
        } catch (RuntimeException e) {
            return dbFail("Error during admin/operator registration:", e);
        }
    }

    @PostMapping("/api/auth/admin/login")
    public ResponseEntity<Object> adminLogin(@RequestBody(required = false) String raw) {
        Object b = parseBody(raw);
        Object email = prop(b, "email"), password = prop(b, "password"), role = prop(b, "role");

        if (!truthy(email) || !truthy(password)) return error(400, "Email and password are required.");

        String normalizedEmail = lower(trim(email, "email"));

        try {
            List<Map<String, Object>> result = db.query("SELECT * FROM users WHERE email = $1", normalizedEmail);
            if (result.isEmpty()) return error(401, "Invalid email or password.");

            Map<String, Object> user = result.get(0);
            Object userRole = user.get("role");
            String userEmail = str(user.get("email"));

            if ("CUSTOMER".equals(userRole)) {
                return error(403, "Access Denied: Account '" + userEmail + "' is a Customer account. Please sign in via the Customer Portal.");
            }
            if (!"ADMIN".equals(userRole) && !"OPERATIONS".equals(userRole)) {
                return error(403, "Access Denied: Account '" + userEmail + "' does not have administrative or operational privileges.");
            }
            if (truthy(role)) {
                String targetRole = ("OPERATIONS".equals(role) || "OPERATOR".equals(role)) ? "OPERATIONS" : "ADMIN";
                if (!targetRole.equals(userRole)) {
                    return error(403, "Role Mismatch: Account '" + userEmail + "' is registered as '" + str(userRole)
                            + "'. Please toggle to '" + ("ADMIN".equals(userRole) ? "Administrator" : "Operator") + "' to sign in.");
                }
            }
            if (!checkPassword(password, user.get("password_hash"))) return error(401, "Invalid email or password.");

            return ok(obj(
                    "message", "Sign in successful.",
                    "token", token(user),
                    "user", obj("id", user.get("id"), "email", user.get("email"), "firstName", user.get("first_name"),
                            "lastName", user.get("last_name"), "dateOfBirth", user.get("date_of_birth"),
                            "phone", user.get("phone"), "role", user.get("role"))));
        } catch (RuntimeException e) {
            return dbFail("Error during admin/operator login:", e);
        }
    }
}
