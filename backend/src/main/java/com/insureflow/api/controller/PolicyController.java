package com.insureflow.api.controller;

import com.insureflow.api.service.Beneficiaries;
import com.insureflow.api.support.Auth;
import com.insureflow.api.support.Db;
import com.insureflow.api.support.JsDate;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ThreadLocalRandom;

import static com.insureflow.api.support.Http.*;
import static com.insureflow.api.support.Js.*;

/** Customer policies, enrollment and policy servicing (INS-14 to INS-19). */
@RestController
public class PolicyController {

    private static final String BENEFICIARIES_SQL = """
              SELECT id, first_name, last_name, relationship, percentage, phone, is_primary, guardian_name
              FROM beneficiaries
              WHERE policy_id = $1 AND is_active = true
              ORDER BY is_primary DESC, percentage DESC, created_at ASC
            """;
    private static final String AUDIT_SQL = """
              SELECT pal.id, pal.action, pal.old_value, pal.new_value, pal.changed_at,
                     u.first_name, u.last_name
              FROM policy_audit_logs pal
              LEFT JOIN users u ON pal.changed_by_user_id = u.id
              WHERE pal.policy_id = $1
              ORDER BY pal.changed_at DESC
            """;
    private static final String COVER_ERROR = "Cover amount must be between $10,000 and $300,000 in increments of $5,000.";

    private final Db db;

    public PolicyController(Db db) { this.db = db; }

    private static List<Object> beneficiariesJson(List<Map<String, Object>> rows) {
        List<Object> out = new ArrayList<>();
        for (Map<String, Object> b : rows) {
            out.add(obj(
                    "id", b.get("id"),
                    "firstName", b.get("first_name"),
                    "lastName", b.get("last_name"),
                    "relationship", b.get("relationship"),
                    "percentage", parseFloat(b.get("percentage")),
                    "phone", b.get("phone"),
                    "isPrimary", !Boolean.FALSE.equals(b.get("is_primary")),
                    "guardianName", or(b.get("guardian_name"), "")));
        }
        return out;
    }

    /** `d ? d.toISOString().split('T')[0] : fallback` */
    private static Object isoDate(Object d, Object fallback) {
        return truthy(d) ? ((JsDate) d).toISODate() : fallback;
    }

    @GetMapping("/api/policies")
    public ResponseEntity<Object> list(HttpServletRequest req) {
        Object user = Auth.user(req);
        try {
            List<Map<String, Object>> rows = db.query("""
                      SELECT p.*, pr.name as product_name, pr.code as product_code
                      FROM policies p
                      JOIN products pr ON p.product_id = pr.id
                      WHERE p.user_id = $1
                      ORDER BY p.created_at DESC
                    """, Auth.id(user));

            List<Object> policies = new ArrayList<>();
            for (Map<String, Object> row : rows) {
                policies.add(obj(
                        "id", row.get("id"),
                        "policyNumber", row.get("policy_number"),
                        "userId", row.get("user_id"),
                        "productId", row.get("product_id"),
                        "productName", row.get("product_name"),
                        "productCode", row.get("product_code"),
                        "coverAmount", parseFloat(row.get("cover_amount")),
                        "monthlyPremium", parseFloat(row.get("monthly_premium")),
                        "status", row.get("status"),
                        "effectiveDate", isoDate(row.get("effective_date"), ""),
                        "addressLine1", row.get("address_line1"),
                        "addressLine2", row.get("address_line2"),
                        "city", row.get("city"),
                        "state", row.get("state"),
                        "zipCode", row.get("zip_code"),
                        "beneficiaries", beneficiariesJson(db.query(BENEFICIARIES_SQL, row.get("id"))),
                        "createdAt", row.get("created_at")));
            }
            return ok(policies);
        } catch (RuntimeException e) {
            return dbFail("Error fetching policies:", e);
        }
    }

    @GetMapping("/api/policies/{id}")
    public ResponseEntity<Object> details(HttpServletRequest req, @PathVariable("id") String policyId) {
        Object user = Auth.user(req);
        try {
            List<Map<String, Object>> policyRes = db.query("""
                      SELECT p.*, pr.name as product_name, pr.code as product_code, cc.code as campaign_code
                      FROM policies p
                      JOIN products pr ON p.product_id = pr.id
                      LEFT JOIN campaign_codes cc ON p.campaign_code_id = cc.id
                      WHERE p.id = $1 AND p.user_id = $2
                    """, policyId, Auth.id(user));
            if (policyRes.isEmpty()) return error(404, "Policy not found or unauthorized.");
            Map<String, Object> row = policyRes.get(0);

            List<Map<String, Object>> benRows = db.query(BENEFICIARIES_SQL, policyId);

            Object auditLogs = List.of();
            try {
                auditLogs = db.query(AUDIT_SQL, policyId);
            } catch (Db.DbError auditErr) {
                System.err.println("Audit fetch warning: " + auditErr.getMessage());
            }

            double monthlyPrem = parseFloat(row.get("monthly_premium"));
            double annualPrem = parseFloat(toFixed(monthlyPrem * 12, 2));
            double dailyMicro = parseFloat(toFixed((monthlyPrem * 12) / 365, 2));

            return ok(obj(
                    "id", row.get("id"),
                    "policyNumber", row.get("policy_number"),
                    "userId", row.get("user_id"),
                    "productId", row.get("product_id"),
                    "productName", row.get("product_name"),
                    "productCode", row.get("product_code"),
                    "campaignCode", or(row.get("campaign_code"), ""),
                    "coverAmount", parseFloat(row.get("cover_amount")),
                    "monthlyPremium", monthlyPrem,
                    "annualPremium", annualPrem,
                    "dailyRate", dailyMicro,
                    "status", row.get("status"),
                    "effectiveDate", isoDate(row.get("effective_date"), ""),
                    "cancellationDate", isoDate(row.get("cancellation_date"), null),
                    "cancellationReason", or(row.get("cancellation_reason"), null),
                    "addressLine1", row.get("address_line1"),
                    "addressLine2", row.get("address_line2"),
                    "city", row.get("city"),
                    "state", row.get("state"),
                    "zipCode", row.get("zip_code"),
                    "beneficiaries", beneficiariesJson(benRows),
                    "auditLogs", auditLogs,
                    "createdAt", row.get("created_at")));
        } catch (RuntimeException e) {
            return dbFail("Error fetching policy details:", e);
        }
    }

    @GetMapping("/api/policies/{id}/audit-logs")
    public ResponseEntity<Object> auditLogs(HttpServletRequest req, @PathVariable("id") String policyId) {
        Object user = Auth.user(req);
        try {
            if (db.query("SELECT id FROM policies WHERE id = $1 AND user_id = $2", policyId, Auth.id(user)).isEmpty()) {
                return error(404, "Policy not found or unauthorized.");
            }
            return ok(db.query(AUDIT_SQL, policyId));
        } catch (RuntimeException e) {
            return dbFail("Error fetching policy audit history:", e);
        }
    }

    @PostMapping("/api/enrollment/validate-code")
    public ResponseEntity<Object> validateCode(@RequestBody(required = false) String raw) {
        Object b = parseBody(raw);
        Object code = prop(b, "code");
        Object spokenKey = prop(b, "spokenKey");
        if (!truthy(code)) return json(400, obj("valid", false, "error", "Campaign code is required."));

        try {
            List<Map<String, Object>> result = db.query("""
                      SELECT cc.*, c.name as campaign_name, pr.name as product_name, pr.code as product_code
                      FROM campaign_codes cc
                      JOIN campaigns c ON cc.campaign_id = c.id
                      JOIN products pr ON c.product_id = pr.id
                      WHERE cc.code = $1
                    """, trim(code, "code").toUpperCase(Locale.ROOT));

            if (result.isEmpty()) {
                return json(404, obj("valid", false, "error", "Campaign code does not exist. Check code and try again."));
            }
            Map<String, Object> r = result.get(0);
            return ok(obj("valid", true, "code", r.get("code"), "spokenKey", spokenKey, "campaignName", r.get("campaign_name"),
                    "productName", r.get("product_name"), "productCode", r.get("product_code")));
        } catch (RuntimeException e) {
            System.err.println("Error validating campaign code: " + e);
            return json(500, obj("valid", false, "error", "Database error: " + e.getMessage()));
        }
    }

    @PostMapping("/api/enrollment/enroll")
    public ResponseEntity<Object> enroll(HttpServletRequest req, @RequestBody(required = false) String raw) {
        Object b = parseBody(raw);
        Object user = Auth.user(req);
        Object campaignCode = prop(b, "campaignCode"), coverAmount = prop(b, "coverAmount"),
                addressLine1 = prop(b, "addressLine1"), addressLine2 = prop(b, "addressLine2"), city = prop(b, "city"),
                state = prop(b, "state"), zipCode = prop(b, "zipCode"), beneficiaries = prop(b, "beneficiaries");

        // Eligibility check: age 18-69 at time of enrollment
        try {
            List<Map<String, Object>> userRes = db.query("SELECT date_of_birth, first_name, last_name FROM users WHERE id = $1", Auth.id(user));
            if (!userRes.isEmpty() && truthy(userRes.get(0).get("date_of_birth"))) {
                JsDate dob = JsDate.parse(userRes.get(0).get("date_of_birth"));
                JsDate today = JsDate.now();
                double age = today.getFullYear() - dob.getFullYear();
                double m = today.getMonth() - dob.getMonth();
                if (m < 0 || (m == 0 && today.getDate() < dob.getDate())) age--;
                if (age < 18 || age > 69) {
                    return error(400, "Underwriting eligibility check failed: Customer age " + numberToString(age)
                            + " is outside the eligible range of 18–69 years. Policy cannot be issued.");
                }
            }
        } catch (RuntimeException eligErr) {
            System.err.println("Eligibility check error: " + eligErr.getMessage());
        }

        double cover = toNumber(coverAmount);
        if (!truthy(coverAmount) || cover < 10000 || cover > 300000 || cover % 5000 != 0) return error(400, COVER_ERROR);
        if (!truthy(addressLine1) || !truthy(city) || !truthy(state) || !truthy(zipCode)) {
            return error(400, "Complete mailing address is required.");
        }
        String benError = Beneficiaries.validate(beneficiaries);
        if (benError != null) return error(400, benError);

        double monthlyPremium = (cover / 1000) * 0.60;

        try (Db.Tx tx = db.begin()) {
            List<Map<String, Object>> prodRes = tx.query("SELECT id FROM products WHERE code = 'DD' LIMIT 1");
            if (prodRes.isEmpty()) throw new IllegalStateException("AD&D product not found in database.");
            Object productId = prodRes.get(0).get("id");

            if (!tx.query("SELECT id FROM policies WHERE user_id = $1 AND product_id = $2 AND status = 'ACTIVE'", Auth.id(user), productId).isEmpty()) {
                throw new IllegalStateException("Customer already has an active policy for Accidental Death & Dismemberment.");
            }

            Object campaignCodeId = null;
            if (truthy(campaignCode)) {
                List<Map<String, Object>> codeCheck = tx.query("SELECT id, campaign_id FROM campaign_codes WHERE code = $1",
                        trim(campaignCode, "campaignCode").toUpperCase(Locale.ROOT));
                if (!codeCheck.isEmpty()) campaignCodeId = codeCheck.get(0).get("id");
            }

            String policyNumber = "POL-2026-" + (int) Math.floor(100000 + ThreadLocalRandom.current().nextDouble() * 900000);

            Map<String, Object> createdPolicy = tx.query("""
                      INSERT INTO policies (
                        user_id, product_id, campaign_code_id, policy_number,
                        cover_amount, monthly_premium, status, effective_date,
                        address_line1, address_line2, city, state, zip_code
                      ) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', CURRENT_DATE, $7, $8, $9, $10, $11)
                      RETURNING *
                    """,
                    Auth.id(user), productId, campaignCodeId, policyNumber, coverAmount, monthlyPremium,
                    addressLine1, or(addressLine2, null), city, state, zipCode).get(0);

            Beneficiaries.insertAll(tx, createdPolicy.get("id"), (List<?>) beneficiaries);

            tx.queryQuietly("Audit log write warning:", """
                      INSERT INTO policy_audit_logs (policy_id, changed_by_user_id, action, new_value)
                      VALUES ($1, $2, 'POLICY_ENROLLED', $3)
                    """, createdPolicy.get("id"), Auth.id(user),
                    stringify(obj("policyNumber", policyNumber, "coverAmount", coverAmount, "monthlyPremium", monthlyPremium,
                            "campaignCode", campaignCode)));

            tx.commit();

            return json(201, obj(
                    "message", "Policy successfully created and active in database.",
                    "policy", obj(
                            "id", createdPolicy.get("id"),
                            "policyNumber", createdPolicy.get("policy_number"),
                            "coverAmount", parseFloat(createdPolicy.get("cover_amount")),
                            "monthlyPremium", parseFloat(createdPolicy.get("monthly_premium")),
                            "status", createdPolicy.get("status"),
                            "effectiveDate", ((JsDate) createdPolicy.get("effective_date")).toISODate())));
        } catch (RuntimeException e) {
            System.err.println("Error during enrollment: " + e.getMessage());
            return error(400, String.valueOf(e.getMessage()));
        }
    }

    @PutMapping("/api/policies/{id}")
    public ResponseEntity<Object> update(HttpServletRequest req, @PathVariable("id") String policyId, @RequestBody(required = false) String raw) {
        Object b = parseBody(raw);
        Object user = Auth.user(req);
        Object coverAmount = prop(b, "coverAmount"), addressLine1 = prop(b, "addressLine1"), addressLine2 = prop(b, "addressLine2"),
                city = prop(b, "city"), state = prop(b, "state"), zipCode = prop(b, "zipCode"), beneficiaries = prop(b, "beneficiaries");

        try {
            List<Map<String, Object>> curRes = db.query("SELECT * FROM policies WHERE id = $1 AND user_id = $2", policyId, Auth.id(user));
            if (curRes.isEmpty()) return error(404, "Policy not found or unauthorized.");

            Map<String, Object> current = curRes.get(0);
            if (!"ACTIVE".equals(current.get("status"))) return error(400, "Only ACTIVE policies can be modified.");

            double newCoverAmount = parseFloat(current.get("cover_amount"));
            double newMonthlyPremium = parseFloat(current.get("monthly_premium"));

            if (!isUndefined(coverAmount) && coverAmount != null) {
                double numCover = toNumber(coverAmount);
                if (numCover < 10000 || numCover > 300000 || numCover % 5000 != 0) return error(400, COVER_ERROR);
                newCoverAmount = numCover;
                newMonthlyPremium = (numCover / 1000) * 0.60;
            }

            Object newAddress1 = !isUndefined(addressLine1) ? trim(addressLine1, "addressLine1") : current.get("address_line1");
            Object newAddress2 = !isUndefined(addressLine2) ? (truthy(addressLine2) ? trim(addressLine2, "addressLine2") : null) : current.get("address_line2");
            Object newCity = !isUndefined(city) ? trim(city, "city") : current.get("city");
            Object newState = !isUndefined(state) ? trim(state, "state") : current.get("state");
            Object newZip = !isUndefined(zipCode) ? trim(zipCode, "zipCode") : current.get("zip_code");

            if (!truthy(newAddress1) || !truthy(newCity) || !truthy(newState) || !truthy(newZip)) {
                return error(400, "Complete mailing address (street, city, state, zip) is required.");
            }

            if (!isUndefined(beneficiaries)) {
                String benError = Beneficiaries.validate(beneficiaries);
                if (benError != null) return error(400, benError);
            }

            Db.Tx tx = db.begin();
            try (tx) {
                tx.query("""
                          UPDATE policies
                          SET cover_amount = $1, monthly_premium = $2,
                              address_line1 = $3, address_line2 = $4, city = $5, state = $6, zip_code = $7,
                              updated_at = CURRENT_TIMESTAMP
                          WHERE id = $8 AND user_id = $9
                        """, newCoverAmount, newMonthlyPremium, newAddress1, newAddress2, newCity, newState, newZip, policyId, Auth.id(user));

                if (parseFloat(current.get("cover_amount")) != newCoverAmount) {
                    tx.queryQuietly("Cover audit log warning:", """
                              INSERT INTO policy_audit_logs (policy_id, changed_by_user_id, action, old_value, new_value)
                              VALUES ($1, $2, 'UPDATE_COVER_AMOUNT', $3, $4)
                            """, policyId, Auth.id(user), stringify(obj("coverAmount", current.get("cover_amount"))),
                            stringify(obj("coverAmount", newCoverAmount)));
                }

                String oldAddrStr = str(or(current.get("address_line1"), "")) + ", " + str(or(current.get("city"), "")) + ", "
                        + str(or(current.get("state"), "")) + " " + str(or(current.get("zip_code"), ""));
                String newAddrStr = str(newAddress1) + ", " + str(newCity) + ", " + str(newState) + " " + str(newZip);
                if (!oldAddrStr.equals(newAddrStr)) {
                    tx.queryQuietly("Address audit log warning:", """
                              INSERT INTO policy_audit_logs (policy_id, changed_by_user_id, action, old_value, new_value)
                              VALUES ($1, $2, 'UPDATE_ADDRESS', $3, $4)
                            """, policyId, Auth.id(user), stringify(obj("address", oldAddrStr)), stringify(obj("address", newAddrStr)));
                }

                if (!isUndefined(beneficiaries)) {
                    tx.query("DELETE FROM beneficiaries WHERE policy_id = $1", policyId);
                    Beneficiaries.insertAll(tx, policyId, (List<?>) beneficiaries);
                    tx.queryQuietly("Beneficiary audit log warning:", """
                              INSERT INTO policy_audit_logs (policy_id, changed_by_user_id, action, new_value)
                              VALUES ($1, $2, 'UPDATE_BENEFICIARIES', $3)
                            """, policyId, Auth.id(user), stringify(obj("beneficiaries", beneficiaries)));
                }

                tx.commit();
                return ok(obj("message", "Policy successfully updated in database.", "policyId", policyId,
                        "coverAmount", newCoverAmount, "monthlyPremium", newMonthlyPremium));
            } catch (RuntimeException e) {
                return fail("Error updating policy:", "Failed to update policy: ", e);
            }
        } catch (RuntimeException e) {
            return dbFail("Error in policy update route:", e);
        }
    }

    @PutMapping("/api/policies/{id}/beneficiaries")
    public ResponseEntity<Object> updateBeneficiaries(HttpServletRequest req, @PathVariable("id") String policyId,
                                                      @RequestBody(required = false) String raw) {
        Object b = parseBody(raw);
        Object user = Auth.user(req);
        Object beneficiaries = prop(b, "beneficiaries");

        String validation = Beneficiaries.validate(beneficiaries);
        if (validation != null) return error(400, validation);

        try {
            List<Map<String, Object>> curRes = db.query("SELECT id, policy_number, status FROM policies WHERE id = $1 AND user_id = $2",
                    policyId, Auth.id(user));
            if (curRes.isEmpty()) return error(404, "Policy not found or unauthorized.");
            if (!"ACTIVE".equals(curRes.get(0).get("status"))) return error(400, "Only ACTIVE policies can have beneficiaries modified.");

            Db.Tx tx = db.begin();
            try (tx) {
                tx.query("DELETE FROM beneficiaries WHERE policy_id = $1", policyId);
                Beneficiaries.insertAll(tx, policyId, (List<?>) beneficiaries);
                tx.queryQuietly("Beneficiary audit log warning:", """
                          INSERT INTO policy_audit_logs (policy_id, changed_by_user_id, action, new_value)
                          VALUES ($1, $2, 'UPDATE_BENEFICIARIES', $3)
                        """, policyId, Auth.id(user), stringify(obj("beneficiaries", beneficiaries)));
                tx.commit();
                return ok(obj("message", "Beneficiaries successfully updated in database.", "policyId", policyId,
                        "beneficiaries", beneficiaries));
            } catch (RuntimeException e) {
                return dbFail("Error updating beneficiaries:", e);
            }
        } catch (RuntimeException e) {
            return dbFail("Error in PUT /api/policies/:id/beneficiaries:", e);
        }
    }

    @DeleteMapping("/api/policies/{id}")
    public ResponseEntity<Object> cancel(HttpServletRequest req, @PathVariable("id") String policyId,
                                         @RequestBody(required = false) String raw) {
        Object user = Auth.user(req);
        Object body = parseBody(raw);
        Object reasonProp = prop(body, "cancellationReason");
        String reason = (truthy(reasonProp)) ? str(reasonProp).trim() : "Cancelled by Customer";
        if (reason.isEmpty()) reason = "Cancelled by Customer";

        try {
            List<Map<String, Object>> curRes = db.query(
                    "SELECT id, status FROM policies WHERE id = $1 AND user_id = $2",
                    policyId, Auth.id(user));
            if (curRes.isEmpty()) return error(404, "Policy not found or unauthorized.");
            if (!"ACTIVE".equals(curRes.get(0).get("status")))
                return error(400, "Only ACTIVE policies can be cancelled.");

            Db.Tx tx = db.begin();
            try (tx) {
                tx.query("""
                          UPDATE policies
                          SET status = 'CANCELLED', cancellation_date = CURRENT_DATE, cancellation_reason = $1,
                              updated_at = CURRENT_TIMESTAMP
                          WHERE id = $2 AND user_id = $3
                        """, reason, policyId, Auth.id(user));

                tx.queryQuietly("Cancellation audit log warning:", """
                          INSERT INTO policy_audit_logs (policy_id, changed_by_user_id, action, old_value, new_value)
                          VALUES ($1, $2, 'POLICY_CANCELLED', $3, $4)
                        """, policyId, Auth.id(user),
                        stringify(obj("status", "ACTIVE")),
                        stringify(obj("status", "CANCELLED", "cancellationReason", reason)));

                tx.commit();
            } catch (RuntimeException e) {
                return fail("Error in cancellation transaction:", "Failed to cancel policy: ", e);
            }

            return ok(obj("message", "Policy successfully cancelled.", "policyId", policyId,
                    "cancellationReason", reason));
        } catch (RuntimeException e) {
            return dbFail("Error cancelling policy:", e);
        }
    }
}
