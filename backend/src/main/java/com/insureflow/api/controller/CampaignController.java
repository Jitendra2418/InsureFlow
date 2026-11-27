package com.insureflow.api.controller;

import com.insureflow.api.support.Auth;
import com.insureflow.api.support.Db;
import com.insureflow.api.support.Http;
import com.insureflow.api.support.JsDate;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

import static com.insureflow.api.support.Http.*;
import static com.insureflow.api.support.Js.*;

/** Admin campaign and campaign event management (INS-4, INS-5). */
@RestController
public class CampaignController {

    private final Db db;

    public CampaignController(Db db) { this.db = db; }

    @GetMapping("/api/admin/campaigns")
    public ResponseEntity<Object> campaigns(HttpServletRequest req) {
        Auth.staff(req);
        try {
            return ok(db.query("""
                      SELECT
                        c.id,
                        c.campaign_id AS "campaignId",
                        c.name,
                        c.description,
                        c.status,
                        c.start_date AS "startDate",
                        c.end_date AS "endDate",
                        c.created_at AS "createdAt",
                        c.client_id AS "clientId",
                        cl.name AS "clientName",
                        c.product_id AS "productId",
                        pr.name AS "productName",
                        pr.code AS "productCode",
                        COUNT(ce.id)::int AS "eventsCount"
                      FROM campaigns c
                      JOIN clients cl ON c.client_id = cl.id
                      JOIN products pr ON c.product_id = pr.id
                      LEFT JOIN campaign_events ce ON ce.campaign_id = c.id
                      GROUP BY c.id, cl.name, pr.name, pr.code
                      ORDER BY c.created_at DESC
                    """));
        } catch (RuntimeException e) {
            return dbFail("Error fetching campaigns:", e);
        }
    }

    @PostMapping("/api/admin/campaigns")
    public ResponseEntity<Object> createCampaign(HttpServletRequest req, @RequestBody(required = false) String raw) {
        Object b = parseBody(raw);
        Auth.staff(req);
        Object clientId = prop(b, "clientId"), productId = prop(b, "productId"), campaignId = prop(b, "campaignId"),
                name = prop(b, "name"), description = prop(b, "description"), startMonth = prop(b, "startMonth"),
                endMonth = prop(b, "endMonth"), status = prop(b, "status");

        if (!truthy(clientId) || !truthy(productId) || !truthy(campaignId) || !truthy(startMonth) || !truthy(endMonth)) {
            return error(400, "Client, Product, Campaign ID, Start Month, and End Month are required.");
        }

        String startDate = str(startMonth) + "-01";
        String endDate = str(endMonth) + "-01";
        if (JsDate.parse(startDate).getTime() > JsDate.parse(endDate).getTime()) {
            return error(400, "Start month cannot be after End month.");
        }

        Object selectedStatus = or(status, "PLANNED");
        Object campaignName = or(name, campaignId);

        // In server.js this loop sits outside the try block
        String finalCampaignId = str(campaignId);
        for (int suffix = 2; suffix <= 99; suffix++) {
            if (db.query("SELECT id FROM campaigns WHERE campaign_id = $1", finalCampaignId).isEmpty()) break;
            finalCampaignId = str(campaignId) + "-" + suffix;
        }

        try {
            List<Map<String, Object>> result = db.query("""
                      INSERT INTO campaigns (client_id, product_id, campaign_id, name, description, status, start_date, end_date)
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                      RETURNING
                        id,
                        campaign_id AS "campaignId",
                        name,
                        description,
                        status,
                        start_date AS "startDate",
                        end_date AS "endDate",
                        created_at AS "createdAt",
                        client_id AS "clientId",
                        product_id AS "productId"
                    """,
                    clientId, productId, finalCampaignId, campaignName, or(description, null), selectedStatus, startDate, endDate);

            return json(201, obj("message", "Campaign \"" + finalCampaignId + "\" successfully created.", "campaign", first(result)));
        } catch (RuntimeException e) {
            return dbFail("Error creating campaign:", e);
        }
    }

    @GetMapping("/api/admin/events")
    public ResponseEntity<Object> events(HttpServletRequest req) {
        Auth.staff(req);
        String campaignId = req.getParameter("campaignId");
        try {
            StringBuilder query = new StringBuilder("""
                      SELECT
                        ce.id,
                        ce.campaign_id AS "campaignId",
                        ce.event_id AS "eventId",
                        ce.channel,
                        ce.media,
                        COALESCE(ce.scheduled_drop, ce.send_date) AS "scheduledDrop",
                        ce.final_description AS "finalDescription",
                        ce.event_type AS "eventType",
                        ce.quantity,
                        ce.created_at AS "createdAt",
                        c.campaign_id AS "campaignCode",
                        c.name AS "campaignName",
                        cl.name AS "clientName",
                        pr.name AS "productName",
                        COUNT(s.id)::int AS "segmentsCount",
                        COALESCE(SUM(s.target), 0)::int AS "allocatedTarget"
                      FROM campaign_events ce
                      JOIN campaigns c ON ce.campaign_id = c.id
                      JOIN clients cl ON c.client_id = cl.id
                      JOIN products pr ON c.product_id = pr.id
                      LEFT JOIN segments s ON s.event_id = ce.id
                    """);
            List<Object> params = new ArrayList<>();
            if (truthy(campaignId)) {
                query.append(" WHERE ce.campaign_id = $1");
                params.add(campaignId);
            }
            query.append("""
                      GROUP BY ce.id, c.campaign_id, c.name, cl.name, pr.name
                      ORDER BY ce.created_at DESC
                    """);
            return ok(db.query(query.toString(), params.toArray()));
        } catch (RuntimeException e) {
            return dbFail("Error fetching campaign events:", e);
        }
    }

    @PostMapping("/api/admin/events")
    public ResponseEntity<Object> createEvent(HttpServletRequest req, @RequestBody(required = false) String raw) {
        Object b = parseBody(raw);
        Auth.staff(req);
        Object campaignId = prop(b, "campaignId"), eventId = prop(b, "eventId"), channel = prop(b, "channel"),
                media = prop(b, "media"), scheduledDrop = prop(b, "scheduledDrop"),
                finalDescription = prop(b, "finalDescription"), type = prop(b, "type"), quantity = prop(b, "quantity");

        if (!truthy(campaignId)) return error(400, "Campaign is required. Please select a campaign.");
        if (!truthy(channel)) return error(400, "Channel is required.");
        if (!truthy(media)) return error(400, "Media is required.");
        if (!truthy(scheduledDrop)) return error(400, "Scheduled drop date is required.");
        if (!truthy(type)) return error(400, "Type is required.");

        double parsedQty = parseInt(or(quantity, "0"));
        if (Double.isNaN(parsedQty) || parsedQty < 0) return error(400, "Quantity must be a valid positive number.");

        String finalEventId = trim(or(eventId, ""), "(eventId || '')");
        if (finalEventId.isEmpty()) {
            finalEventId = "EVT-" + (int) Math.floor(100000 + ThreadLocalRandom.current().nextDouble() * 900000);
        }

        // In server.js this loop sits outside the try block
        for (int suffix = 2; suffix <= 99; suffix++) {
            if (db.query("SELECT id FROM campaign_events WHERE event_id = $1", finalEventId).isEmpty()) break;
            finalEventId = str(or(eventId, "EVT")) + "-" + suffix;
        }

        try {
            Object createdEvent = first(db.query("""
                      INSERT INTO campaign_events (
                        campaign_id, event_id, channel, media, scheduled_drop, send_date, final_description, event_type, quantity
                      )
                      VALUES ($1, $2, $3, $4, $5, $5, $6, $7, $8)
                      RETURNING
                        id,
                        campaign_id AS "campaignId",
                        event_id AS "eventId",
                        channel,
                        media,
                        scheduled_drop AS "scheduledDrop",
                        final_description AS "finalDescription",
                        event_type AS "eventType",
                        quantity,
                        created_at AS "createdAt"
                    """,
                    campaignId, finalEventId, channel, media, scheduledDrop, or(finalDescription, null), type, parsedQty));

            List<Map<String, Object>> joined = db.query("""
                      SELECT c.campaign_id AS "campaignCode", c.name AS "campaignName", cl.name AS "clientName", pr.name AS "productName"
                      FROM campaigns c
                      JOIN clients cl ON c.client_id = cl.id
                      JOIN products pr ON c.product_id = pr.id
                      WHERE c.id = $1
                    """, campaignId);

            Map<String, Object> enriched = new LinkedHashMap<>();
            if (createdEvent instanceof Map<?, ?> ev) ev.forEach((k, v) -> enriched.put((String) k, v));
            if (!joined.isEmpty()) enriched.putAll(joined.get(0));

            return json(201, obj("message", "Event \"" + finalEventId + "\" successfully created.", "event", enriched));
        } catch (RuntimeException e) {
            return Http.dbFail("Error creating campaign event:", e);
        }
    }
}
