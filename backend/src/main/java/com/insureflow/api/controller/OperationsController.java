package com.insureflow.api.controller;

import com.insureflow.api.support.Auth;
import com.insureflow.api.support.Db;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.insureflow.api.support.Http.*;
import static com.insureflow.api.support.Js.*;

/**
 * Operations Command Center controller (INS-12).
 * Exposes real-time KPIs, enrollments per campaign, response rate per segment spoken key,
 * active policies registry, and open claims tracking for operators and administrators.
 */
@RestController
public class OperationsController {

    private final Db db;

    public OperationsController(Db db) {
        this.db = db;
    }

    /** Safely converts any value returned by JDBC (Integer, Long, BigDecimal, String, null) to int. */
    private static int toInt(Object val) {
        if (val == null) return 0;
        if (val instanceof Number n) return n.intValue();
        try { return Integer.parseInt(val.toString().trim()); } catch (NumberFormatException e) { return 0; }
    }

    /** Safely converts any value returned by JDBC (Integer, Long, BigDecimal, String, null) to double. */
    private static double toDouble(Object val) {
        if (val == null) return 0.0;
        if (val instanceof Number n) return n.doubleValue();
        try { return Double.parseDouble(val.toString().trim()); } catch (NumberFormatException e) { return 0.0; }
    }

    @GetMapping("/api/operations/metrics")
    public ResponseEntity<Object> getMetrics(HttpServletRequest req) {
        Auth.staff(req); // Accessible by both OPERATIONS and ADMIN roles
        try {
            // 1. Enrollments per Campaign
            List<Map<String, Object>> campaignEnrollments = db.query("""
                SELECT
                    c.id AS "campaignId",
                    c.campaign_id AS "campaignCode",
                    c.name AS "campaignName",
                    c.status AS "status",
                    c.start_date AS "startDate",
                    c.end_date AS "endDate",
                    cl.name AS "clientName",
                    cl.code AS "clientCode",
                    pr.name AS "productName",
                    pr.code AS "productCode",
                    COUNT(DISTINCT p.id)::int AS "enrollmentCount",
                    COALESCE(SUM(p.cover_amount), 0)::numeric AS "totalCoverSum",
                    COALESCE(SUM(p.monthly_premium), 0)::numeric AS "totalMonthlyPremium"
                FROM campaigns c
                JOIN clients cl ON c.client_id = cl.id
                JOIN products pr ON c.product_id = pr.id
                LEFT JOIN campaign_codes cc ON cc.campaign_id = c.id
                LEFT JOIN policies p ON p.campaign_code_id = cc.id
                GROUP BY c.id, c.campaign_id, c.name, c.status, c.start_date, c.end_date, cl.name, cl.code, pr.name, pr.code
                ORDER BY "enrollmentCount" DESC, c.created_at DESC
            """);

            // 2. Response Rate per Segment based on Spoken Key
            // Calculates: (Actual Enrollments for this Spoken Key / Target Count) * 100
            List<Map<String, Object>> segmentResponseRates = db.query("""
                SELECT
                    s.id AS "segmentId",
                    s.name AS "segmentName",
                    s.spoken_key AS "spokenKey",
                    s.insurance_status AS "insuranceStatus",
                    s.state AS "state",
                    s.target::int AS "targetCount",
                    cl.name AS "clientName",
                    cl.code AS "clientCode",
                    ce.event_id AS "eventCode",
                    c.campaign_id AS "campaignCode",
                    c.name AS "campaignName",
                    COUNT(DISTINCT p.id)::int AS "enrolledCount",
                    CASE
                        WHEN COALESCE(s.target, 0) > 0 THEN
                            ROUND((COUNT(DISTINCT p.id)::numeric / s.target::numeric) * 100, 2)
                        ELSE 0
                    END AS "responseRate"
                FROM segments s
                JOIN campaign_events ce ON s.event_id = ce.id
                JOIN campaigns c ON ce.campaign_id = c.id
                LEFT JOIN clients cl ON s.client_id = cl.id
                LEFT JOIN campaign_codes cc ON (cc.campaign_id = c.id AND (cc.code = s.spoken_key OR cc.code ILIKE s.spoken_key || '%'))
                LEFT JOIN policies p ON (p.campaign_code_id = cc.id)
                GROUP BY s.id, s.name, s.spoken_key, s.insurance_status, s.state, s.target, cl.name, cl.code, ce.event_id, c.campaign_id, c.name
                ORDER BY "responseRate" DESC, s.created_at DESC
            """);

            // 3. Active Policies Registry
            List<Map<String, Object>> activePolicies = db.query("""
                SELECT
                    p.id,
                    p.policy_number AS "policyNumber",
                    p.cover_amount AS "coverAmount",
                    p.monthly_premium AS "monthlyPremium",
                    p.status,
                    p.effective_date AS "effectiveDate",
                    p.city,
                    p.state,
                    p.zip_code AS "zipCode",
                    p.created_at AS "createdAt",
                    u.first_name AS "customerFirstName",
                    u.last_name AS "customerLastName",
                    CONCAT(u.first_name, ' ', u.last_name) AS "customerName",
                    u.email AS "customerEmail",
                    u.phone AS "customerPhone",
                    pr.name AS "productName",
                    pr.code AS "productCode",
                    cc.code AS "campaignCode"
                FROM policies p
                JOIN users u ON p.user_id = u.id
                JOIN products pr ON p.product_id = pr.id
                LEFT JOIN campaign_codes cc ON p.campaign_code_id = cc.id
                WHERE p.status = 'ACTIVE'
                ORDER BY p.created_at DESC
            """);

            // 4. Open Claims Tracker (Claims with status SUBMITTED or UNDER_REVIEW)
            List<Map<String, Object>> openClaims = db.query("""
                SELECT
                    c.id,
                    c.claim_number AS "claimNumber",
                    c.policy_id AS "policyId",
                    p.policy_number AS "policyNumber",
                    c.incident_type AS "incidentType",
                    c.incident_date AS "incidentDate",
                    c.description,
                    c.status,
                    c.claimed_amount AS "claimedAmount",
                    c.created_at AS "createdAt",
                    u.first_name AS "insuredFirstName",
                    u.last_name AS "insuredLastName",
                    CONCAT(u.first_name, ' ', u.last_name) AS "insuredName",
                    u.email AS "insuredEmail",
                    u.phone AS "insuredPhone",
                    pr.name AS "productName",
                    pr.code AS "productCode",
                    COUNT(cd.id)::int AS "documentsCount"
                FROM claims c
                JOIN policies p ON c.policy_id = p.id
                JOIN users u ON c.user_id = u.id
                JOIN products pr ON p.product_id = pr.id
                LEFT JOIN claim_documents cd ON cd.claim_id = c.id
                GROUP BY c.id, c.claim_number, c.policy_id, p.policy_number, c.incident_type, c.incident_date,
                         c.description, c.status, c.claimed_amount, c.created_at, u.first_name, u.last_name,
                         u.email, u.phone, pr.name, pr.code
                ORDER BY c.created_at DESC
            """);

            // 5. Aggregate Summary KPIs
            int totalActivePolicies = activePolicies.size();
            int totalOpenClaims = openClaims.size();
            int totalEnrollments = 0;
            for (Map<String, Object> camp : campaignEnrollments) {
                totalEnrollments += toInt(camp.getOrDefault("enrollmentCount", 0));
            }

            double sumResponseRate = 0;
            for (Map<String, Object> seg : segmentResponseRates) {
                sumResponseRate += toDouble(seg.getOrDefault("responseRate", 0.0));
            }
            double avgResponseRate = segmentResponseRates.isEmpty() ? 0.0 :
                    Math.round((sumResponseRate / segmentResponseRates.size()) * 100.0) / 100.0;

            Map<String, Object> kpis = obj(
                "totalActivePolicies", totalActivePolicies,
                "totalOpenClaims", totalOpenClaims,
                "totalEnrollments", totalEnrollments,
                "avgResponseRate", avgResponseRate,
                "totalCampaigns", campaignEnrollments.size(),
                "totalSegments", segmentResponseRates.size()
            );

            return ok(obj(
                "kpis", kpis,
                "campaignEnrollments", campaignEnrollments,
                "segmentResponseRates", segmentResponseRates,
                "activePolicies", activePolicies,
                "openClaims", openClaims
            ));
        } catch (RuntimeException e) {
            return dbFail("Error fetching operations metrics:", e);
        }
    }
}
