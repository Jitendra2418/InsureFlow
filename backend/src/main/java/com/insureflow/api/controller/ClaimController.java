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
        Object claimedAmount = or(prop(b, "claimedAmount"), prop(b, "approvedAmount"));

        if (!truthy(status) || !(status instanceof String s && VALID_STATUSES.contains(s))) {
            return error(400, "Invalid status. Must be one of: " + String.join(", ", VALID_STATUSES));
        }

        try {
            List<Map<String, Object>> result = db.query("""
                      UPDATE claims
                      SET
                        status = $1::text,
                        reviewer_notes = COALESCE($2::text, reviewer_notes),
                        claimed_amount = CASE 
                          WHEN $3::numeric IS NOT NULL THEN $3::numeric 
                          ELSE claimed_amount 
                        END,
                        approved_amount = CASE 
                          WHEN $1::text = 'APPROVED' AND $4::numeric IS NOT NULL THEN $4::numeric
                          WHEN $1::text = 'APPROVED' AND approved_amount IS NULL THEN COALESCE($3::numeric, claimed_amount)
                          WHEN $1::text = 'REJECTED' THEN 0::numeric
                          ELSE approved_amount
                        END,
                        reviewed_by = $5::uuid,
                        reviewed_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                      WHERE id = $6::uuid
                      RETURNING *
                    """,
                    status, or(reviewerNotes, null), isUndefined(claimedAmount) ? null : claimedAmount, isUndefined(approvedAmount) ? null : approvedAmount, Auth.id(user), id);

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
            boolean isStaff = false;
            if (user instanceof Map<?, ?> uMap) {
                String role = str(uMap.get("role"));
                isStaff = "ADMIN".equalsIgnoreCase(role) || "OPERATOR".equalsIgnoreCase(role) || "OPERATIONS".equalsIgnoreCase(role);
            }

            List<Map<String, Object>> policyRes;
            if (isStaff) {
                policyRes = db.query("SELECT * FROM policies WHERE (id::text = $1 OR policy_number = $1)", policyId);
            } else {
                policyRes = db.query("SELECT * FROM policies WHERE (id::text = $1 OR policy_number = $1) AND user_id = $2", policyId, Auth.id(user));
                if (policyRes.isEmpty()) {
                    policyRes = db.query("SELECT * FROM policies WHERE (id::text = $1 OR policy_number = $1)", policyId);
                }
            }
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
                    policy.get("id"), policy.get("user_id"), claimNumber, incidentType, incidentDate, or(description, null),
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

    @PostMapping("/api/admin/claims/{id}/send-invoice")
    public ResponseEntity<Object> sendClaimInvoice(HttpServletRequest req, @PathVariable String id) {
        Auth.staff(req);
        try {
            List<Map<String, Object>> result = db.query("""
                      SELECT
                        c.id, c.claim_number, c.policy_id, c.status,
                        c.claimed_amount, c.approved_amount, c.incident_type,
                        c.incident_date, c.description, c.reviewer_notes, c.reviewed_at,
                        p.policy_number, p.cover_amount, p.address_line1, p.city, p.state, p.zip_code,
                        u.email, u.first_name, u.last_name, u.phone,
                        pr.name AS product_name
                      FROM claims c
                      JOIN policies p ON c.policy_id = p.id
                      JOIN users u ON c.user_id = u.id
                      JOIN products pr ON p.product_id = pr.id
                      WHERE c.id = $1::uuid
                    """, id);
            if (result.isEmpty()) return error(404, "Claim not found.");

            Map<String, Object> claim = result.get(0);
            String status = str(claim.get("status"));
            if (!"APPROVED".equalsIgnoreCase(status)) {
                return error(400, "Claim invoice can ONLY be generated and mailed for APPROVED claims. Current status: " + status);
            }

            String claimNumber = str(claim.get("claim_number"));
            String policyNumber = str(claim.get("policy_number"));
            String email = str(claim.get("email"));
            String insuredName = str(claim.get("first_name")) + " " + str(claim.get("last_name"));
            String invoiceNumber = "INV-" + claimNumber.replace("CLM-", "SETTLE-");
            double settlementAmount = claim.get("approved_amount") != null ?
                    parseFloat(claim.get("approved_amount")) : parseFloat(claim.get("claimed_amount"));
            String reviewedAtStr = claim.get("reviewed_at") != null ? claim.get("reviewed_at").toString() : JsDate.now().toISOString();

            // Mock email dispatch for approved claim settlement invoice
            System.out.println("\n🧾 [Mock Email] Approved Claim Settlement Invoice #" + invoiceNumber + " dispatched to " + email);
            System.out.println("   Claimant:         " + insuredName + " <" + email + ">");
            System.out.println("   Claim #:          " + claimNumber);
            System.out.println("   Policy #:         " + policyNumber);
            System.out.println("   Product:          " + str(claim.get("product_name")));
            System.out.println("   Incident:         " + str(claim.get("incident_type")));
            System.out.println("   Approved Payout:  $" + settlementAmount);
            System.out.println("   Reviewed At:      " + reviewedAtStr);
            System.out.println("   Adjudication Note:" + str(or(claim.get("reviewer_notes"), "Claim approved by Claims Administrator")));
            System.out.println("   Status:           APPROVED (Settlement Authorized)\n");

            return ok(obj(
                    "message", "Claim settlement invoice " + invoiceNumber + " sent successfully to " + email,
                    "invoiceNumber", invoiceNumber,
                    "claimNumber", claimNumber,
                    "recipient", obj("name", insuredName, "email", email),
                    "policyNumber", policyNumber,
                    "productName", claim.get("product_name"),
                    "approvedAmount", settlementAmount,
                    "reviewedAt", reviewedAtStr,
                    "sentAt", JsDate.now().toISOString()));
        } catch (RuntimeException e) {
            return dbFail("Error sending claim invoice:", e);
        }
    }

    @GetMapping("/api/admin/claims/{id}/invoice")
    public ResponseEntity<Object> getClaimInvoice(HttpServletRequest req, @PathVariable String id) {
        Auth.staff(req);
        try {
            List<Map<String, Object>> result = db.query("""
                      SELECT
                        c.id, c.claim_number, c.policy_id, c.status,
                        c.claimed_amount, c.approved_amount, c.incident_type,
                        c.incident_date, c.description, c.reviewer_notes, c.reviewed_at,
                        p.policy_number, p.cover_amount, p.address_line1, p.city, p.state, p.zip_code,
                        u.email, u.first_name, u.last_name, u.phone,
                        pr.name AS product_name
                      FROM claims c
                      JOIN policies p ON c.policy_id = p.id
                      JOIN users u ON c.user_id = u.id
                      JOIN products pr ON p.product_id = pr.id
                      WHERE c.id = $1::uuid
                    """, id);
            if (result.isEmpty()) return error(404, "Claim not found.");

            Map<String, Object> claim = result.get(0);
            String status = str(claim.get("status"));
            if (!"APPROVED".equalsIgnoreCase(status)) {
                return error(400, "Claim invoice is only available for claims that have been APPROVED by the administrator.");
            }

            String claimNumber = str(claim.get("claim_number"));
            String invoiceNumber = "INV-" + claimNumber.replace("CLM-", "SETTLE-");
            double settlementAmount = claim.get("approved_amount") != null ?
                    parseFloat(claim.get("approved_amount")) : parseFloat(claim.get("claimed_amount"));

            return ok(obj(
                    "invoiceNumber", invoiceNumber,
                    "claimId", claim.get("id"),
                    "claimNumber", claimNumber,
                    "policyNumber", claim.get("policy_number"),
                    "productName", claim.get("product_name"),
                    "incidentType", claim.get("incident_type"),
                    "incidentDate", claim.get("incident_date"),
                    "description", claim.get("description"),
                    "claimedAmount", parseFloat(claim.get("claimed_amount")),
                    "approvedAmount", settlementAmount,
                    "reviewerNotes", claim.get("reviewer_notes"),
                    "status", "APPROVED",
                    "reviewedAt", claim.get("reviewed_at"),
                    "claimant", obj(
                            "name", str(claim.get("first_name")) + " " + str(claim.get("last_name")),
                            "email", claim.get("email"),
                            "phone", claim.get("phone"),
                            "address", str(claim.get("address_line1")) + ", " + str(claim.get("city")) + ", " + str(claim.get("state")) + " " + str(claim.get("zip_code"))
                    )
            ));
        } catch (RuntimeException e) {
            return dbFail("Error fetching claim invoice:", e);
        }
    }
}
