package com.insureflow.api.controller;

import com.insureflow.api.support.Auth;
import com.insureflow.api.support.Db;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

import static com.insureflow.api.support.Http.*;
import static com.insureflow.api.support.Js.*;

/** Segment management (INS-6). */
@RestController
public class SegmentController {

    private final Db db;

    public SegmentController(Db db) { this.db = db; }

    @GetMapping("/api/admin/segments/customer-stats")
    public ResponseEntity<Object> customerStats(HttpServletRequest req) {
        Auth.staff(req);
        try {
            return ok(first(db.query("""
                      SELECT
                        COUNT(DISTINCT u.id) FILTER (WHERE p.id IS NOT NULL)::int AS "insuredCount",
                        COUNT(DISTINCT u.id) FILTER (WHERE p.id IS NULL AND u.role = 'CUSTOMER')::int AS "uninsuredCount",
                        COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'CUSTOMER')::int AS "totalCustomers"
                      FROM users u
                      LEFT JOIN policies p ON p.user_id = u.id;
                    """)));
        } catch (RuntimeException e) {
            return dbFail("Error fetching customer stats:", e);
        }
    }

    @GetMapping("/api/admin/segments")
    public ResponseEntity<Object> segments(HttpServletRequest req) {
        Auth.staff(req);
        String eventId = req.getParameter("eventId");
        try {
            StringBuilder query = new StringBuilder("""
                      SELECT
                        s.id,
                        s.event_id AS "eventId",
                        s.name,
                        s.insurance_status AS "insuranceStatus",
                        s.client_id AS "clientId",
                        cl.name AS "clientName",
                        cl.code AS "clientCode",
                        s.state,
                        s.spoken_key AS "spokenKey",
                        s.target,
                        s.description,
                        s.created_at AS "createdAt",
                        ce.event_id AS "eventCode",
                        ce.quantity AS "eventQuantity",
                        ce.channel AS "eventChannel",
                        c.campaign_id AS "campaignCode",
                        c.name AS "campaignName"
                      FROM segments s
                      JOIN campaign_events ce ON s.event_id = ce.id
                      JOIN campaigns c ON ce.campaign_id = c.id
                      LEFT JOIN clients cl ON s.client_id = cl.id
                    """);
            List<Object> params = new ArrayList<>();
            if (truthy(eventId)) {
                query.append(" WHERE s.event_id = $1");
                params.add(eventId);
            }
            query.append(" ORDER BY s.created_at DESC");
            return ok(db.query(query.toString(), params.toArray()));
        } catch (RuntimeException e) {
            return dbFail("Error fetching segments:", e);
        }
    }

    @PostMapping("/api/admin/segments")
    public ResponseEntity<Object> create(HttpServletRequest req, @RequestBody(required = false) String raw) {
        Object b = parseBody(raw);
        Auth.staff(req);
        Object eventId = prop(b, "eventId"), insuranceStatus = prop(b, "insuranceStatus"), clientId = prop(b, "clientId"),
                target = prop(b, "target"), description = prop(b, "description");

        if (!truthy(eventId)) return error(400, "Event selection is required.");
        if (!truthy(insuranceStatus) || !("I".equals(insuranceStatus) || "UI".equals(insuranceStatus))) {
            return error(400, "Insurance status must be \"I\" (Insured) or \"UI\" (Uninsured).");
        }
        if (!truthy(clientId)) return error(400, "Bank (Client) selection is required.");

        double parsedTarget = parseInt(target);
        if (Double.isNaN(parsedTarget) || parsedTarget <= 0) return error(400, "Target must be a positive number greater than 0.");

        try {
            List<Map<String, Object>> eventRes = db.query("""
                      SELECT ce.id, ce.event_id, ce.quantity, c.name as campaign_name
                      FROM campaign_events ce
                      JOIN campaigns c ON ce.campaign_id = c.id
                      WHERE ce.id = $1
                    """, eventId);
            if (eventRes.isEmpty()) return error(404, "Selected event not found in database.");

            Map<String, Object> event = eventRes.get(0);
            Object eventQuantity = or(event.get("quantity"), 0);
            double qty = toNumber(eventQuantity);

            Object allocatedTarget = db.query("""
                      SELECT COALESCE(SUM(target), 0)::int AS "allocatedTarget"
                      FROM segments
                      WHERE event_id = $1
                    """, eventId).get(0).get("allocatedTarget");
            double allocated = toNumber(allocatedTarget);
            double remainingTarget = qty - allocated;

            if (allocated + parsedTarget > qty) {
                return error(400, "Target (" + numberToString(parsedTarget) + ") exceeds event remaining capacity! Current event quantity is "
                        + str(eventQuantity) + ", already allocated is " + str(allocatedTarget) + ", remaining available is "
                        + numberToString(remainingTarget) + ".");
            }

            List<Map<String, Object>> clientRes = db.query("SELECT id, name, code, state FROM clients WHERE id = $1", clientId);
            if (clientRes.isEmpty()) return error(404, "Selected bank/client not found in database.");
            Map<String, Object> client = clientRes.get(0);

            Object cState = client.get("state");
            String clientState = truthy(cState) && !trim(cState, "client.state").isEmpty()
                    ? trim(cState, "client.state").toUpperCase(Locale.ROOT) : "ALL";
            String bankIdentifier = str(or(or(client.get("name"), client.get("code")), "BANK"))
                    .replaceAll("[^a-zA-Z0-9]", "").toUpperCase(Locale.ROOT);

            String spokenKey = str(insuranceStatus) + "-" + bankIdentifier + "-" + clientState;
            String segmentName = spokenKey + " Segment";

            Object createdSegment = first(db.query("""
                      INSERT INTO segments (
                        event_id,
                        name,
                        insurance_status,
                        client_id,
                        state,
                        spoken_key,
                        target,
                        target_count,
                        description
                      )
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $7, $8)
                      RETURNING
                        id,
                        event_id AS "eventId",
                        name,
                        insurance_status AS "insuranceStatus",
                        client_id AS "clientId",
                        state,
                        spoken_key AS "spokenKey",
                        target,
                        description,
                        created_at AS "createdAt"
                    """,
                    eventId, segmentName, insuranceStatus, clientId, clientState, spokenKey, parsedTarget, or(description, null)));

            Map<String, Object> enriched = new LinkedHashMap<>();
            if (createdSegment instanceof Map<?, ?> s) s.forEach((k, v) -> enriched.put((String) k, v));
            enriched.put("clientName", client.get("name"));
            enriched.put("clientCode", client.get("code"));
            enriched.put("eventCode", event.get("event_id"));
            enriched.put("eventQuantity", eventQuantity);
            enriched.put("campaignName", event.get("campaign_name"));

            return json(201, obj("message", "Segment \"" + spokenKey + "\" created successfully with target " + numberToString(parsedTarget) + ".",
                    "segment", enriched));
        } catch (RuntimeException e) {
            return dbFail("Error creating segment:", e);
        }
    }
}
