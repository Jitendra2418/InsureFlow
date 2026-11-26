const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'insureflow-super-secret-key-change-in-production-2026';

// CORS configuration for React frontend
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true
}));
app.use(express.json());

// PostgreSQL Pool Connection
const dbPort = parseInt(process.env.DB_PORT || '5433', 10);
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: dbPort,
  database: process.env.DB_NAME || 'insureflow',
  user: process.env.DB_USER || 'insureflow_user',
  password: process.env.DB_PASSWORD || 'your_db_password',
  connectionTimeoutMillis: 5000
});

// Test PostgreSQL Connection
let isDbConnected = false;
async function testDbConnection() {
  try {
    const res = await pool.query('SELECT NOW()');
    isDbConnected = true;
    console.log('✅ Connected successfully to PostgreSQL database:', process.env.DB_NAME || 'insureflow');
    console.log('   Database Server Time:', res.rows[0].now);
  } catch (err) {
    isDbConnected = false;
    console.error('❌ PostgreSQL Connection Failed:', err.message);
    console.error('   Please ensure PostgreSQL is running on port 5432 with database "insureflow".');
  }
}
testDbConnection();

// JWT Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required. Please sign in.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Session expired or invalid token. Please log in again.' });
    }
    req.user = user;
    next();
  });
}

// ==========================================
// API ROUTES
// ==========================================

// 1. Health & Database Status
app.get('/api/health', async (req, res) => {
  try {
    const dbTest = await pool.query('SELECT NOW() as current_time, count(*) as user_count FROM users');
    res.json({
      status: 'UP',
      database: {
        connected: true,
        userCount: parseInt(dbTest.rows[0].user_count, 10),
        serverTime: dbTest.rows[0].current_time
      }
    });
  } catch (err) {
    res.status(503).json({
      status: 'DEGRADED',
      database: {
        connected: false,
        error: err.message,
        tip: 'Check if PostgreSQL is running on port 5432 with database insureflow.'
      }
    });
  }
});

// 2. Customer Registration (Strictly Creates Role CUSTOMER)
app.post('/api/auth/register', async (req, res) => {
  const { email, password, firstName, lastName, dateOfBirth, phone } = req.body;

  if (!email || !password || !firstName || !lastName || !dateOfBirth) {
    return res.status(400).json({ error: 'Please provide all required fields.' });
  }

  // Underwriting Rule: Age 18 to 69
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  if (isNaN(age) || age < 18 || age > 69) {
    return res.status(400).json({ error: 'Underwriting requirement: Customer must be between 18 and 69 years of age.' });
  }

  try {
    // Check if user already exists
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email address already exists. Please sign in.' });
    }

    // Hash password with BCrypt (12 rounds as specified in Architecture)
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user into PostgreSQL
    const insertQuery = `
      INSERT INTO users (email, password_hash, first_name, last_name, date_of_birth, phone, role)
      VALUES ($1, $2, $3, $4, $5, $6, 'CUSTOMER')
      RETURNING id, email, first_name, last_name, date_of_birth, phone, role, created_at
    `;
    const result = await pool.query(insertQuery, [
      email.trim().toLowerCase(),
      passwordHash,
      firstName.trim(),
      lastName.trim(),
      dateOfBirth,
      phone || null
    ]);

    const createdUser = result.rows[0];

    // Issue JWT
    const token = jwt.sign(
      { id: createdUser.id, email: createdUser.email, role: createdUser.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Customer account successfully created.',
      token,
      user: {
        id: createdUser.id,
        email: createdUser.email,
        firstName: createdUser.first_name,
        lastName: createdUser.last_name,
        dateOfBirth: createdUser.date_of_birth,
        phone: createdUser.phone,
        role: createdUser.role
      }
    });
  } catch (err) {
    console.error('Error during customer registration:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// 3. Customer Sign In (Strictly Allows CUSTOMER Role Only)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  try {
    const userQuery = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(userQuery, [email.trim().toLowerCase()]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    // RESTRICTION: Only Customers are permitted on this Customer portal
    if (user.role !== 'CUSTOMER') {
      return res.status(403).json({
        error: `Access Denied: Account '${user.email}' is registered with administrative role '${user.role}'. This portal is exclusively for Customers. Aman and Operations staff must log in through the Admin Portal.`
      });
    }

    // Compare BCrypt password
    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Issue JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Sign in successful.',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        dateOfBirth: user.date_of_birth,
        phone: user.phone,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Error during customer login:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// 4. Get Current Customer's Policies from Database
app.get('/api/policies', authenticateToken, async (req, res) => {
  try {
    const policiesQuery = `
      SELECT p.*, pr.name as product_name, pr.code as product_code
      FROM policies p
      JOIN products pr ON p.product_id = pr.id
      WHERE p.user_id = $1
      ORDER BY p.created_at DESC
    `;
    const policiesRes = await pool.query(policiesQuery, [req.user.id]);

    const policies = await Promise.all(
      policiesRes.rows.map(async (row) => {
        const benQuery = `
          SELECT id, first_name, last_name, relationship, percentage, phone
          FROM beneficiaries
          WHERE policy_id = $1 AND is_active = true
        `;
        const benRes = await pool.query(benQuery, [row.id]);

        return {
          id: row.id,
          policyNumber: row.policy_number,
          userId: row.user_id,
          productId: row.product_id,
          productName: row.product_name,
          productCode: row.product_code,
          coverAmount: parseFloat(row.cover_amount),
          monthlyPremium: parseFloat(row.monthly_premium),
          status: row.status,
          effectiveDate: row.effective_date ? row.effective_date.toISOString().split('T')[0] : '',
          addressLine1: row.address_line1,
          addressLine2: row.address_line2,
          city: row.city,
          state: row.state,
          zipCode: row.zip_code,
          beneficiaries: benRes.rows.map(b => ({
            id: b.id,
            firstName: b.first_name,
            lastName: b.last_name,
            relationship: b.relationship,
            percentage: parseFloat(b.percentage),
            phone: b.phone
          })),
          createdAt: row.created_at
        };
      })
    );

    res.json(policies);
  } catch (err) {
    console.error('Error fetching policies:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// 5. Validate Campaign Code
app.post('/api/enrollment/validate-code', async (req, res) => {
  const { code } = req.body;
  if (!code) {
    return res.status(400).json({ valid: false, error: 'Campaign code is required.' });
  }

  try {
    const codeQuery = `
      SELECT cc.*, c.name as campaign_name, pr.name as product_name, pr.code as product_code
      FROM campaign_codes cc
      JOIN campaigns c ON cc.campaign_id = c.id
      JOIN products pr ON c.product_id = pr.id
      WHERE cc.code = $1
    `;
    const result = await pool.query(codeQuery, [code.trim().toUpperCase()]);

    if (result.rows.length === 0) {
      return res.status(404).json({ valid: false, error: 'Campaign code does not exist. Check code and try again.' });
    }

    const codeRecord = result.rows[0];
    if (codeRecord.is_used) {
      return res.status(400).json({ valid: false, error: 'This campaign code has already been redeemed for an active policy.' });
    }

    res.json({
      valid: true,
      code: codeRecord.code,
      campaignName: codeRecord.campaign_name,
      productName: codeRecord.product_name,
      productCode: codeRecord.product_code
    });
  } catch (err) {
    console.error('Error validating campaign code:', err);
    res.status(500).json({ valid: false, error: 'Database error: ' + err.message });
  }
});

// 6. Enroll Customer into Policy (Inserts to PostgreSQL)
app.post('/api/enrollment/enroll', authenticateToken, async (req, res) => {
  const {
    campaignCode,
    coverAmount,
    addressLine1,
    addressLine2,
    city,
    state,
    zipCode,
    beneficiaries
  } = req.body;

  // Validation
  if (!coverAmount || coverAmount < 10000 || coverAmount > 300000 || coverAmount % 5000 !== 0) {
    return res.status(400).json({ error: 'Cover amount must be between $10,000 and $300,000 in increments of $5,000.' });
  }

  if (!addressLine1 || !city || !state || !zipCode) {
    return res.status(400).json({ error: 'Complete mailing address is required.' });
  }

  if (!beneficiaries || !Array.isArray(beneficiaries) || beneficiaries.length === 0) {
    return res.status(400).json({ error: 'At least one beneficiary is required.' });
  }

  const totalPct = beneficiaries.reduce((sum, b) => sum + (parseFloat(b.percentage) || 0), 0);
  if (totalPct !== 100) {
    return res.status(400).json({ error: `Beneficiary percentages must equal 100%. Current total: ${totalPct}%` });
  }

  // Monthly Premium Formula: (cover_amount / 1000) * 0.60
  const monthlyPremium = (coverAmount / 1000) * 0.60;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get product AD&D (DD)
    const prodRes = await client.query("SELECT id FROM products WHERE code = 'DD' LIMIT 1");
    if (prodRes.rows.length === 0) {
      throw new Error("AD&D product not found in database.");
    }
    const productId = prodRes.rows[0].id;

    // 2. Prevent duplicate active policy for the same product
    const dupCheck = await client.query(
      "SELECT id FROM policies WHERE user_id = $1 AND product_id = $2 AND status = 'ACTIVE'",
      [req.user.id, productId]
    );
    if (dupCheck.rows.length > 0) {
      throw new Error("Customer already has an active policy for Accidental Death & Dismemberment.");
    }

    // 3. Campaign code check if provided
    let campaignCodeId = null;
    if (campaignCode) {
      const codeCheck = await client.query(
        "SELECT id, is_used FROM campaign_codes WHERE code = $1 FOR UPDATE",
        [campaignCode.trim().toUpperCase()]
      );
      if (codeCheck.rows.length > 0) {
        if (codeCheck.rows[0].is_used) {
          throw new Error("This campaign code has already been redeemed.");
        }
        campaignCodeId = codeCheck.rows[0].id;
      }
    }

    // 4. Generate unique Policy Number
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const policyNumber = `POL-2026-${randomDigits}`;

    // 5. Insert Policy
    const insertPolicyQuery = `
      INSERT INTO policies (
        user_id, product_id, campaign_code_id, policy_number,
        cover_amount, monthly_premium, status, effective_date,
        address_line1, address_line2, city, state, zip_code
      ) VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE', CURRENT_DATE, $7, $8, $9, $10, $11)
      RETURNING *
    `;
    const policyRes = await client.query(insertPolicyQuery, [
      req.user.id,
      productId,
      campaignCodeId,
      policyNumber,
      coverAmount,
      monthlyPremium,
      addressLine1,
      addressLine2 || null,
      city,
      state,
      zipCode
    ]);
    const createdPolicy = policyRes.rows[0];

    // 6. Insert Beneficiaries
    for (const b of beneficiaries) {
      await client.query(`
        INSERT INTO beneficiaries (policy_id, first_name, last_name, relationship, percentage, phone)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        createdPolicy.id,
        b.firstName.trim(),
        b.lastName.trim(),
        b.relationship,
        parseFloat(b.percentage),
        b.phone || null
      ]);
    }

    // 7. Mark campaign code as used if provided
    if (campaignCodeId) {
      await client.query(`
        UPDATE campaign_codes
        SET is_used = true, used_by_user_id = $1, used_at = CURRENT_TIMESTAMP
        WHERE id = $2
      `, [req.user.id, campaignCodeId]);
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Policy successfully created and active in database.',
      policy: {
        id: createdPolicy.id,
        policyNumber: createdPolicy.policy_number,
        coverAmount: parseFloat(createdPolicy.cover_amount),
        monthlyPremium: parseFloat(createdPolicy.monthly_premium),
        status: createdPolicy.status,
        effectiveDate: createdPolicy.effective_date.toISOString().split('T')[0]
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error during enrollment:', err.message);
    res.status(400).json({ error: err.message });
  } finally {
    client.release();
  }
});

// 7. Cancel Policy
app.delete('/api/policies/:id', authenticateToken, async (req, res) => {
  try {
    const updateRes = await pool.query(`
      UPDATE policies
      SET status = 'CANCELLED', cancellation_date = CURRENT_DATE, cancellation_reason = 'Cancelled by Customer'
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [req.params.id, req.user.id]);

    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found or unauthorized.' });
    }

    res.json({ message: 'Policy successfully cancelled in database.', policyId: req.params.id });
  } catch (err) {
    console.error('Error cancelling policy:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 InsureFlow Backend API running on http://localhost:${PORT}`);
  console.log(`📡 Connecting to PostgreSQL at ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'insureflow'}`);
  console.log(`=======================================================`);
});
