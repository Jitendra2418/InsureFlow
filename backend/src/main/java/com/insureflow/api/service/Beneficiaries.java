package com.insureflow.api.service;

import com.insureflow.api.support.Db;

import java.util.List;

import static com.insureflow.api.support.Js.*;

/** server.js `validateBeneficiaries` and the shared beneficiary INSERT. */
public final class Beneficiaries {

    private Beneficiaries() {}

    /** Returns the error message, or null when valid. */
    public static String validate(Object beneficiaries) {
        if (!truthy(beneficiaries) || !(beneficiaries instanceof List<?> list) || list.isEmpty()) {
            return "At least one primary beneficiary designation is required.";
        }

        List<?> primary = list.stream().filter(b -> !Boolean.FALSE.equals(prop(b, "isPrimary"))).toList();
        List<?> contingent = list.stream().filter(b -> Boolean.FALSE.equals(prop(b, "isPrimary"))).toList();

        if (primary.isEmpty()) return "At least one Primary beneficiary must be designated.";

        double primarySum = sum(primary);
        if (Math.abs(primarySum - 100) > 0.01) {
            return "Primary beneficiary allocations must sum to exactly 100%. Current total: " + toFixed(primarySum, 1) + "%";
        }

        if (!contingent.isEmpty()) {
            double contSum = sum(contingent);
            if (Math.abs(contSum - 100) > 0.01) {
                return "Contingent beneficiary allocations must sum to exactly 100%. Current total: " + toFixed(contSum, 1) + "%";
            }
        }

        for (Object b : list) {
            Object firstName = prop(b, "firstName"), lastName = prop(b, "lastName");
            if (!truthy(firstName) || trim(firstName, "b.firstName").isEmpty() || !truthy(lastName) || trim(lastName, "b.lastName").isEmpty()) {
                return "First and last name are required for every beneficiary.";
            }
            double pct = parseFloat(prop(b, "percentage"));
            if (Double.isNaN(pct) || pct <= 0 || pct > 100) {
                return "Invalid allocation percentage for " + str(firstName) + " " + str(lastName) + ". Must be between 0.01% and 100%.";
            }
            Object relationship = prop(b, "relationship");
            boolean isMinor = "Child".equals(relationship) || "Child (Minor under 18)".equals(relationship);
            Object guardianName = prop(b, "guardianName");
            if (isMinor && (!truthy(guardianName) || trim(guardianName, "b.guardianName").isEmpty())) {
                return "Legal Guardian / Trustee is required for minor beneficiary " + str(firstName) + " " + str(lastName) + ".";
            }
        }
        return null;
    }

    /** `list.reduce((sum, b) => sum + (parseFloat(b.percentage) || 0), 0)` */
    private static double sum(List<?> list) {
        double s = 0;
        for (Object b : list) {
            double p = parseFloat(prop(b, "percentage"));
            s += Double.isNaN(p) ? 0 : p;
        }
        return s;
    }

    public static void insertAll(Db.Tx tx, Object policyId, List<?> beneficiaries) {
        for (Object b : beneficiaries) {
            Object phone = prop(b, "phone"), guardianName = prop(b, "guardianName");
            tx.query("""
                      INSERT INTO beneficiaries (policy_id, first_name, last_name, relationship, percentage, phone, is_primary, guardian_name)
                      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                    """,
                    policyId,
                    trim(prop(b, "firstName"), "b.firstName"),
                    trim(prop(b, "lastName"), "b.lastName"),
                    or(prop(b, "relationship"), "Spouse"),
                    parseFloat(prop(b, "percentage")),
                    truthy(phone) ? trim(phone, "b.phone") : null,
                    !Boolean.FALSE.equals(prop(b, "isPrimary")),
                    truthy(guardianName) ? trim(guardianName, "b.guardianName") : null);
        }
    }
}
