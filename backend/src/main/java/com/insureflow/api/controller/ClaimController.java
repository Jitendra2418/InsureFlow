package com.insureflow.api.controller;

import com.insureflow.api.support.Auth;
import com.insureflow.api.support.Db;
import com.insureflow.api.support.JsDate;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
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

/** Claims management (INS-9). */
@RestController
public class ClaimController {

    private static final List<String> VALID_STATUSES = List.of("SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED");

    private final Db db;

    public ClaimController(Db db) { this.db = db; }

    @GetMapping("/api/admin/claims")
    public ResponseEntity<Object> list(HttpServletRequest req) {
        Auth.staff(req);
        String status = req.getParameter("status");
        try {
            StringBuilder query = new StringBuilder("""
                      SELECT
                        c.id,
                        c.claim_number AS "claimNumber",
                        c.policy_id AS "policyId",
                        p.policy_number AS "policyNumber",
                        c.user_id AS "userId",
                        u.first_name AS "insuredFirstName",
                        u.last_name AS "insuredLastName",
                        CONCAT(u.first_name, ' ', u.last_name) AS "insuredName",
                        u.email AS "insuredEmail",
                        u.phone AS "insuredPhone",
                        pr.id AS "productId",
                        pr.name AS "productName",
                        pr.code AS "productCode",
                        c.incident_type AS "incidentType",
                        c.incident_date AS "incidentDate",
                        c.description,
                        c.status,
                        c.claimed_amount AS "claimedAmount",
                        c.approved_amount AS "approvedAmount",
                        c.reviewer_notes AS "reviewerNotes",
                        c.reviewed_at AS "reviewedAt",
                        c.created_at AS "createdAt",
                        c.updated_at AS "updatedAt",
                        COALESCE(
                          json_agg(
                            json_build_object(
                              'id', cd.id,
                              'fileName', cd.file_name,
                              's3Key', cd.s3_key,
                              'contentType', cd.content_type,
                              'fileSize', cd.file_size,
                              'uploadedAt', cd.uploaded_at
                            )
                          ) FILTER (WHERE cd.id IS NOT NULL),
                          '[]'::json
                        ) AS documents
                      FROM claims c
                      JOIN policies p ON c.policy_id = p.id
                      JOIN users u ON c.user_id = u.id
                      JOIN products pr ON p.product_id = pr.id
                      LEFT JOIN claim_documents cd ON cd.claim_id = c.id
                    """);
            List<Object> params = new ArrayList<>();
            if (truthy(status) && !"ALL".equals(status)) {
                params.add(status);
                query.append(" WHERE c.status = $1");
            }
            query.append("""
                      GROUP BY c.id, p.policy_number, u.first_name, u.last_name, u.email, u.phone, pr.id, pr.name, pr.code
                      ORDER BY c.created_at DESC
                    """);
            return ok(db.query(query.toString(), params.toArray()));
        } catch (RuntimeException e) {
            return dbFail("Error fetching admin claims:", e);
        }
    }

    @PatchMapping("/api/admin/claims/{id}/status")
    public ResponseEntity<Object> updateStatus(HttpServletRequest req, @PathVariable String id, @RequestBody(required = false) String raw) {
        Object b = parseBody(raw);
        Object user = Auth.staff(req);
        Object status = prop(b, "status"), reviewerNotes = prop(b, "reviewerNotes"), approvedAmount = prop(b, "approvedAmount");

        if (!truthy(status) || !(status instanceof String s && VALID_STATUSES.contains(s))) {
            return error(400, "Invalid status. Must be one of: " + String.join(", ", VALID_STATUSES));
        }

        try {
            List<Map<String, Object>> result = db.query("""
                      UPDATE claims
                      SET
                        status = $1::text,
                        reviewer_notes = COALESCE($2::text, reviewer_notes),
                        approved_amount = CASE\s
                          WHEN $1::text = 'APPROVED' AND $3::numeric IS NOT NULL THEN $3::numeric
                          WHEN $1::text = 'APPROVED' AND approved_amount IS NULL THEN claimed_amount
                          WHEN $1::text = 'REJECTED' THEN 0::numeric
                          ELSE approved_amount
                        END,
                        reviewed_by = $4::uuid,
                        reviewed_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                      WHERE id = $5::uuid
                      RETURNING *
                    """,
                    status, or(reviewerNotes, null), isUndefined(approvedAmount) ? null : approvedAmount, Auth.id(user), id);

            if (result.isEmpty()) return error(404, "Claim not found.");
            return ok(obj("message", "Claim status successfully updated to \"" + status + "\".", "claim", result.get(0)));
        } catch (RuntimeException e) {
            return dbFail("Error updating claim status:", e);
        }
    }

    @GetMapping("/api/claims")
    public ResponseEntity<Object> listCustomerClaims(HttpServletRequest req) {
        Object user = Auth.user(req);
        try {
            List<Map<String, Object>> rows = db.query("""
                      SELECT
                        c.id,
                        c.claim_number AS "claimNumber",
                        c.policy_id AS "policyId",
                        p.policy_number AS "policyNumber",
                        c.user_id AS "userId",
                        u.first_name AS "insuredFirstName",
                        u.last_name AS "insuredLastName",
                        CONCAT(u.first_name, ' ', u.last_name) AS "insuredName",
                        u.email AS "insuredEmail",
                        u.phone AS "insuredPhone",
                        pr.id AS "productId",
                        pr.name AS "productName",
                        pr.code AS "productCode",
                        c.incident_type AS "incidentType",
                        c.incident_date AS "incidentDate",
                        c.description,
                        c.status,
                        c.claimed_amount AS "claimedAmount",
                        c.approved_amount AS "approvedAmount",
                        c.reviewer_notes AS "reviewerNotes",
                        c.reviewed_at AS "reviewedAt",
                        c.created_at AS "createdAt",
                        c.updated_at AS "updatedAt",
                        COALESCE(
                          json_agg(
                            json_build_object(
                              'id', cd.id,
                              'fileName', cd.file_name,
                              's3Key', cd.s3_key,
                              'contentType', cd.content_type,
                              'fileSize', cd.file_size,
                              'uploadedAt', cd.uploaded_at
                            )
                          ) FILTER (WHERE cd.id IS NOT NULL),
                          '[]'::json
                        ) AS documents
                      FROM claims c
                      JOIN policies p ON c.policy_id = p.id
                      JOIN users u ON c.user_id = u.id
                      JOIN products pr ON p.product_id = pr.id
                      LEFT JOIN claim_documents cd ON cd.claim_id = c.id
                      WHERE c.user_id = $1
                      GROUP BY c.id, p.policy_number, u.first_name, u.last_name, u.email, u.phone, pr.id, pr.name, pr.code
                      ORDER BY c.created_at DESC
                    """, Auth.id(user));
            return ok(rows);
        } catch (RuntimeException e) {
            return dbFail("Error fetching customer claims:", e);
        }
    }

    @PostMapping("/api/claims")
    public ResponseEntity<Object> submit(HttpServletRequest req, @RequestBody(required = false) String raw) {
        Object b = parseBody(raw);
        Object user = Auth.user(req);
        Object policyId = prop(b, "policyId"), incidentType = prop(b, "incidentType"), incidentDate = prop(b, "incidentDate"),
                description = prop(b, "description"), claimedAmount = prop(b, "claimedAmount"), documents = prop(b, "documents"),
                claimNumberProp = prop(b, "claimNumber");

        if (!truthy(policyId) || !truthy(incidentType) || !truthy(incidentDate)) {
            return error(400, "Policy ID, Incident Type, and Incident Date are required.");
        }

        try {
            List<Map<String, Object>> policyRes = db.query("SELECT * FROM policies WHERE id = $1 AND user_id = $2", policyId, Auth.id(user));
            if (policyRes.isEmpty()) return error(404, "Policy not found or unauthorized.");
            Map<String, Object> policy = policyRes.get(0);

            String claimNumber;
            if (truthy(claimNumberProp)) {
                claimNumber = str(claimNumberProp).trim();
            } else {
                claimNumber = "CLM-" + numberToString(JsDate.now().getFullYear()) + "-"
                        + (int) Math.floor(100000 + ThreadLocalRandom.current().nextDouble() * 900000);
            }

            double numClaimedAmount;
            if (truthy(claimedAmount)) {
                numClaimedAmount = parseFloat(claimedAmount);
            } else {
                numClaimedAmount = parseFloat(policy.get("cover_amount"));
            }

            Map<String, Object> createdClaim = db.query("""
                      INSERT INTO claims (
                        policy_id, user_id, claim_number, incident_type, incident_date,
                        description, status, claimed_amount
                      )
                      VALUES ($1, $2, $3, $4, $5, $6, 'SUBMITTED', $7)
                      RETURNING *
                    """,
                    policyId, policy.get("user_id"), claimNumber, incidentType, incidentDate, or(description, null),
                    numClaimedAmount).get(0);

            List<Object> insertedDocs = new ArrayList<>();
            if (documents instanceof List<?> docs && !docs.isEmpty()) {
                for (Object doc : docs) {
                    Object s3Key = prop(doc, "s3Key");
                    if (!truthy(s3Key)) {
                        s3Key = "claims/" + str(createdClaim.get("id")) + "/" + System.currentTimeMillis() + "_"
                                + str(or(prop(doc, "fileName"), "document.pdf")).replaceAll("(?U)\\s+", "_");
                    }
                    insertedDocs.add(db.query("""
                              INSERT INTO claim_documents (
                                claim_id, file_name, s3_key, content_type, file_size
                              )
                              VALUES ($1, $2, $3, $4, $5)
                              RETURNING *
                            """,
                            createdClaim.get("id"), or(prop(doc, "fileName"), "Supporting_Document.pdf"), s3Key,
                            or(prop(doc, "contentType"), "application/pdf"), or(prop(doc, "fileSize"), 102400)).get(0));
                }
            }

            Map<String, Object> claim = new LinkedHashMap<>(createdClaim);
            claim.put("documents", insertedDocs);
            return json(201, obj("message", "Claim " + claimNumber + " submitted successfully.", "claim", claim));
        } catch (RuntimeException e) {
            return dbFail("Error submitting claim:", e);
        }
    }
}
