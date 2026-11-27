package com.insureflow.api.support;

import com.insureflow.api.service.Beneficiaries;
import org.junit.jupiter.api.Test;
import org.springframework.security.crypto.bcrypt.BCrypt;

import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * The port relies on these helpers behaving exactly like Node. Expected values (including the
 * token and hash) were produced by running the same expressions with Node, jsonwebtoken and bcryptjs.
 */
class JsSemanticsTest {

    @Test
    void numbersPrintLikeJavaScript() {
        Object[][] cases = {{0.0, "0"}, {-0.0, "0"}, {1.0, "1"}, {90.0, "90"}, {0.1 + 0.2, "0.30000000000000004"},
                {60.5, "60.5"}, {1e21, "1e+21"}, {1.5e-7, "1.5e-7"}, {123456789.25, "123456789.25"}, {1e-6, "0.000001"},
                {Math.pow(2, 60), "1152921504606847000"}, {-42.5, "-42.5"}, {59.99999999999999, "59.99999999999999"}};
        for (Object[] c : cases) assertEquals(c[1], Js.numberToString((double) c[0]), "String(" + c[0] + ")");
    }

    @Test
    void toFixedRoundsLikeJavaScript() {
        assertEquals("2.35", Js.toFixed(2.345, 2));
        assertEquals("1.00", Js.toFixed(1.005, 2));
        assertEquals("2.96", Js.toFixed(2.96, 2));
        assertEquals("1080.00", Js.toFixed(1080, 2));
        assertEquals("99.9", Js.toFixed(33.3 * 3, 1));
        assertEquals("1", Js.toFixed(0.5, 0));
        assertEquals("2", Js.toFixed(1.5, 0));
        assertEquals("-1.3", Js.toFixed(-1.25, 1));
    }

    @Test
    void parsingAndCoercionMatchJavaScript() {
        assertEquals("12.5", Js.numberToString(Js.parseFloat("  12.5abc")));
        assertEquals("1000", Js.numberToString(Js.parseFloat("1e3x")));
        assertEquals("0.5", Js.numberToString(Js.parseFloat(".5")));
        assertTrue(Double.isNaN(Js.parseFloat("abc")));
        assertEquals("Infinity", Js.numberToString(Js.parseFloat("Infinity!")));
        assertEquals("100000", Js.numberToString(Js.parseFloat("100000.00")));

        assertEquals("42", Js.numberToString(Js.parseInt("42px")));
        assertEquals("-7", Js.numberToString(Js.parseInt("  -7.9")));
        assertTrue(Double.isNaN(Js.parseInt(" x1")));
        assertEquals("1", Js.numberToString(Js.parseInt(1e21)));

        assertEquals(0, Js.toNumber(""));
        assertEquals(12, Js.toNumber(" 12 "));
        assertEquals(31, Js.toNumber("0x1F"));
        assertEquals(1000, Js.toNumber("1e3"));
        assertTrue(Double.isNaN(Js.toNumber("12px")));
        assertTrue(Double.isNaN(Js.toNumber("-")));
        assertEquals(0.5, Js.toNumber(".5"));
        assertTrue(Double.isNaN(Js.toNumber(Js.UNDEFINED)));
        assertEquals(0, Js.toNumber(null));
    }

    @Test
    void datesParseLikeV8() {
        assertEquals("1990-01-01T00:00:00.000Z", JsDate.parse("1990-01-01").toISOString());
        assertEquals("2026-03-02T00:00:00.000Z", JsDate.parse("2026-02-30").toISOString());
        assertFalse(JsDate.parse("2026-13-01").isValid());
        assertEquals("2026-11-01T00:00:00.000Z", JsDate.parse("2026-11").toISOString());
        assertEquals("2026-11-27T10:00:00.000Z", JsDate.parse("2026-11-27T10:00:00Z").toISOString());
        assertFalse(JsDate.parse("notadate").isValid());
        // date-time without an offset is local time
        long local = LocalDateTime.of(2026, 11, 27, 10, 0).atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
        assertEquals((double) local, JsDate.parse("2026-11-27T10:00:00").getTime());
    }

    @Test
    void jsonOmitsUndefinedAndPrintsNumbersLikeJavaScript() {
        Map<String, Object> o = Js.obj("a", 90.0, "b", Js.UNDEFINED, "c", List.of(1, Js.UNDEFINED), "d", Double.NaN);
        assertEquals("{\"a\":90,\"c\":[1,null],\"d\":null}", Js.stringify(o));
    }

    @Test
    void tokensFromNodeVerifyAndOwnTokensRoundTrip() throws Exception {
        String fromNode = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InUtMSIsImVtYWlsIjoiYUB4LmNvbSIsInJvbGUiOiJBRE1JTiIsImV4cCI6NDEwMjQ0NDgwMCwiaWF0IjoxNzk1Nzk1NTY5fQ.NsIviTbQmrtvkoWKMsUI2hWdxxSjxqQ2xKLN7blhG20";
        assertEquals("ADMIN", ((Map<?, ?>) Jwt.verify(fromNode, "short")).get("role"));
        assertThrows(Jwt.JwtError.class, () -> Jwt.verify(fromNode, "other-secret"));
        assertThrows(Jwt.JwtError.class, () -> Jwt.verify(fromNode.substring(0, fromNode.length() - 2) + "xx", "short"));

        String expired = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6InUtMSIsImV4cCI6MSwiaWF0IjoxNzk1Nzk1NTYyfQ.ISDIB8JaS6yV_VsREaeKXTQK55gLtDRvxEiYuG4rukc";
        assertEquals("jwt expired", assertThrows(Jwt.JwtError.class, () -> Jwt.verify(expired, "short")).getMessage());

        String own = Jwt.sign(Js.obj("id", "u-2", "email", "b@x.com", "role", "CUSTOMER"), "short");
        assertEquals("u-2", ((Map<?, ?>) Jwt.verify(own, "short")).get("id"));
        assertThrows(Jwt.JwtError.class, () -> Jwt.verify("not.a.token.at.all", "short"));
        String unsigned = own.substring(0, own.lastIndexOf('.') + 1);
        assertThrows(Jwt.JwtError.class, () -> Jwt.verify(unsigned, "short"));
    }

    @Test
    void bcryptjsHashesVerify() {
        String fromBcryptjs = "$2a$04$0roxvb7A8XbCBOPJAOav4O7Gm0lLS2KPrg2IBWpg6jZh1I2oJH4Wi";
        assertTrue(Http.checkPassword("Password123!", fromBcryptjs));
        assertFalse(Http.checkPassword("password123!", fromBcryptjs));
        assertTrue(BCrypt.checkpw("Password123!".getBytes(StandardCharsets.UTF_8), Http.hashPassword("Password123!")));
    }

    @Test
    void beneficiaryRulesAndMessages() {
        Map<String, Object> spouse = Js.obj("firstName", "Ben", "lastName", "E", "percentage", 100);
        assertNull(Beneficiaries.validate(List.of(spouse)));
        assertEquals("At least one primary beneficiary designation is required.", Beneficiaries.validate(List.of()));
        assertEquals("Primary beneficiary allocations must sum to exactly 100%. Current total: 90.0%",
                Beneficiaries.validate(List.of(Js.obj("firstName", "A", "lastName", "B", "percentage", 90))));
        assertEquals("Contingent beneficiary allocations must sum to exactly 100%. Current total: 50.0%",
                Beneficiaries.validate(List.of(spouse, Js.obj("firstName", "C", "lastName", "D", "percentage", "50", "isPrimary", false))));
        assertEquals("Legal Guardian / Trustee is required for minor beneficiary Kid D.",
                Beneficiaries.validate(List.of(Js.obj("firstName", "Kid", "lastName", "D", "relationship", "Child", "percentage", 100))));
        // 3 x 33.3 = 99.9: outside the 0.01 tolerance, so rejected exactly as in Node
        Map<String, Object> third = Js.obj("firstName", "A", "lastName", "B", "percentage", 33.3);
        assertEquals("Primary beneficiary allocations must sum to exactly 100%. Current total: 99.9%",
                Beneficiaries.validate(List.of(third, third, third)));
    }
}
