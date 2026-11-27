package com.insureflow.api.controller;

import com.insureflow.api.support.Auth;
import com.insureflow.api.support.Db;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

import static com.insureflow.api.support.Http.*;
import static com.insureflow.api.support.Js.*;

/** Health check, products, and admin client management (server.js sections 1, CLIENTS, PRODUCTS). */
@RestController
public class ClientController {

    private final Db db;

    public ClientController(Db db) { this.db = db; }

    /** `row.col`, UNDEFINED when the column is absent. */
    private static Object col(Map<String, Object> row, String c) { return row.containsKey(c) ? row.get(c) : UNDEFINED; }

    @GetMapping("/api/health")
    public ResponseEntity<Object> health() {
        try {
            Map<String, Object> r = db.query("SELECT NOW() as current_time, count(*) as user_count FROM users").get(0);
            return ok(obj("status", "UP", "database", obj(
                    "connected", true,
                    "userCount", parseInt(r.get("user_count")),
                    "serverTime", r.get("current_time"))));
        } catch (RuntimeException e) {
            return json(503, obj("status", "DEGRADED", "database", obj(
                    "connected", false,
                    "error", e.getMessage(),
                    "tip", "Check if PostgreSQL is running on port 5432 with database insureflow.")));
        }
    }

    private ResponseEntity<Object> products() {
        try {
            List<Map<String, Object>> rows = db.query(
                    "SELECT id, name, code, status, description, premium_rate_per_thousand FROM products ORDER BY name ASC");
            return ok(rows.stream().map(row -> obj(
                    "id", row.get("id"),
                    "name", row.get("name"),
                    "code", row.get("code"),
                    "status", row.get("status"),
                    "description", or(row.get("description"), ""),
                    "premiumRatePerThousand", parseFloat(or(row.get("premium_rate_per_thousand"), 0)))).toList());
        } catch (RuntimeException e) {
            return dbFail("Error fetching products:", e);
        }
    }

    @GetMapping("/api/products")
    public ResponseEntity<Object> listProducts() { return products(); }

    @GetMapping("/api/admin/products")
    public ResponseEntity<Object> listAdminProducts() { return products(); }

    private static Map<String, Object> clientJson(Map<String, Object> row) {
        return obj(
                "id", col(row, "id"),
                "name", col(row, "name"),
                "clientId", or(col(row, "client_id"), col(row, "code")),
                "code", col(row, "code"),
                "businessType", col(row, "business_type"),
                "status", col(row, "status"),
                "address", col(row, "address"),
                "state", col(row, "state"),
                "isActive", col(row, "is_active"),
                "createdAt", col(row, "created_at"));
    }

    private static String randomClientId() {
        return "CLI-" + (int) Math.floor(100000 + ThreadLocalRandom.current().nextDouble() * 900000);
    }

    @GetMapping("/api/admin/clients")
    public ResponseEntity<Object> list(HttpServletRequest req) {
        Auth.staff(req);
        try {
            return ok(db.query("SELECT * FROM clients ORDER BY created_at DESC").stream().map(row -> obj(
                    "id", col(row, "id"),
                    "name", col(row, "name"),
                    "clientId", or(col(row, "client_id"), col(row, "code")),
                    "code", col(row, "code"),
                    "businessType", or(col(row, "business_type"), "Bank"),
                    "status", or(col(row, "status"), truthy(col(row, "is_active")) ? "A-ACTIVE" : "IA-INACTIVE"),
                    "address", or(col(row, "address"), ""),
                    "state", or(col(row, "state"), ""),
                    "contactEmail", or(col(row, "contact_email"), ""),
                    "isActive", col(row, "is_active"),
                    "createdAt", col(row, "created_at"))).toList());
        } catch (RuntimeException e) {
            return dbFail("Error fetching clients:", e);
        }
    }

    @PostMapping("/api/admin/clients")
    public ResponseEntity<Object> create(HttpServletRequest req, @RequestBody(required = false) String raw) {
        Object b = parseBody(raw);
        Auth.staff(req);
        Object name = prop(b, "name"), clientId = prop(b, "clientId"), businessType = prop(b, "businessType"),
                status = prop(b, "status"), address = prop(b, "address"), state = prop(b, "state");

        if (!truthy(name) || trim(name, "name").isEmpty()) return error(400, "Client Name is required.");

        String generatedClientId = trim(or(clientId, ""), "(clientId || '')");
        if (generatedClientId.isEmpty()) generatedClientId = randomClientId();

        Object selectedBusinessType = or(businessType, "Bank");
        Object selectedStatus = or(status, "A-ACTIVE");
        boolean isActive = "A-ACTIVE".equals(selectedStatus);

        try {
            if (!db.query("SELECT id FROM clients WHERE code = $1 OR client_id = $1", generatedClientId).isEmpty()) {
                generatedClientId = randomClientId();
            }
            Map<String, Object> created = db.query("""
                      INSERT INTO clients (name, code, client_id, business_type, status, address, state, is_active)
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                      RETURNING *
                    """,
                    trim(name, "name"), generatedClientId, generatedClientId, selectedBusinessType, selectedStatus,
                    truthy(address) ? trim(address, "address") : "", truthy(state) ? trim(state, "state") : "", isActive).get(0);

            return json(201, obj("message", "Client successfully added.", "client", clientJson(created)));
        } catch (RuntimeException e) {
            return dbFail("Error creating client:", e);
        }
    }

    @PutMapping("/api/admin/clients/{id}")
    public ResponseEntity<Object> update(HttpServletRequest req, @PathVariable String id, @RequestBody(required = false) String raw) {
        Object b = parseBody(raw);
        Auth.staff(req);
        Object name = prop(b, "name"), businessType = prop(b, "businessType"), status = prop(b, "status"),
                address = prop(b, "address"), state = prop(b, "state");

        if (!truthy(name) || trim(name, "name").isEmpty()) return error(400, "Client Name cannot be empty.");

        Object selectedBusinessType = or(businessType, "Bank");
        Object selectedStatus = or(status, "A-ACTIVE");
        boolean isActive = "A-ACTIVE".equals(selectedStatus);

        try {
            List<Map<String, Object>> result = db.query("""
                      UPDATE clients
                      SET name = $1, business_type = $2, status = $3, address = $4, state = $5, is_active = $6
                      WHERE id = $7
                      RETURNING *
                    """,
                    trim(name, "name"), selectedBusinessType, selectedStatus,
                    truthy(address) ? trim(address, "address") : "", truthy(state) ? trim(state, "state") : "", isActive, id);

            if (result.isEmpty()) return error(404, "Client not found.");
            return ok(obj("message", "Client profile successfully updated.", "client", clientJson(result.get(0))));
        } catch (RuntimeException e) {
            return dbFail("Error updating client:", e);
        }
    }

    @DeleteMapping("/api/admin/clients/{id}")
    public ResponseEntity<Object> delete(HttpServletRequest req, @PathVariable String id) {
        Auth.staff(req);
        try {
            List<Map<String, Object>> result = db.query("DELETE FROM clients WHERE id = $1 RETURNING id, name", id);
            if (result.isEmpty()) return error(404, "Client not found.");
            return ok(obj("message", "Client \"" + str(result.get(0).get("name")) + "\" successfully deleted.", "deletedId", id));
        } catch (RuntimeException e) {
            return dbFail("Error deleting client:", e);
        }
    }
}
