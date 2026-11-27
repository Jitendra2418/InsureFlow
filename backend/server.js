const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || 'insureflow-super-secret-key-change-in-production-2026';

// CORS configuration for React frontend (allow localhost, 127.0.0.1, and any local dev origin)
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json());

// Request logging for debugging
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.url}`);
  next();
});

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

// 2. Customer Registration (Strictly Creates Role CUSTOMER with Unique Aadhaar & Email)
app.post('/api/auth/register', async (req, res) => {
  const { email, password, firstName, lastName, dateOfBirth, phone, aadharNumber } = req.body;

  if (!email || !password || !firstName || !lastName || !dateOfBirth || !aadharNumber) {
    return res.status(400).json({ error: 'Please provide all required fields, including your 12-digit Aadhaar Number.' });
  }

  // Validate Aadhaar Number: Must be exactly 12 numeric digits
  const cleanAadhar = aadharNumber.toString().replace(/[\s-]/g, '');
  if (!/^\d{12}$/.test(cleanAadhar)) {
    return res.status(400).json({ error: 'Invalid Aadhaar Number. Aadhaar must be exactly 12 numeric digits.' });
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
    // 1. DUPLICATE CHECK: Verify Aadhaar number is NOT already registered
    const existingAadhar = await pool.query('SELECT id FROM users WHERE aadhar_number = $1', [cleanAadhar]);
    if (existingAadhar.rows.length > 0) {
      return res.status(409).json({
        error: `Duplicate Registration Blocked: A customer account with Aadhaar Number ending in ...${cleanAadhar.slice(-4)} is already registered in InsureFlow.`
      });
    }

    // 2. DUPLICATE CHECK: Verify email is NOT already registered
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.trim().toLowerCase()]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email address already exists. Please sign in.' });
    }

    // Hash password with BCrypt (12 rounds as specified in Architecture)
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert user into PostgreSQL
    const insertQuery = `
      INSERT INTO users (email, password_hash, first_name, last_name, date_of_birth, phone, aadhar_number, role)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'CUSTOMER')
      RETURNING id, email, first_name, last_name, date_of_birth, phone, aadhar_number, role, created_at
    `;
    const result = await pool.query(insertQuery, [
      email.trim().toLowerCase(),
      passwordHash,
      firstName.trim(),
      lastName.trim(),
      dateOfBirth,
      phone || null,
      cleanAadhar
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
        aadharNumber: createdUser.aadhar_number,
        role: createdUser.role
      }
    });
  } catch (err) {
    console.error('Error during customer registration:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// 3. Customer Sign In (Allows Sign In via Email or Aadhaar Number)
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email or Aadhaar Number and password are required.' });
  }

  try {
    const rawInput = email.trim();
    const cleanDigits = rawInput.replace(/[\s-]/g, '');

    // Allow user to log in by either Email or 12-digit Aadhaar Number
    const userQuery = 'SELECT * FROM users WHERE email = $1 OR aadhar_number = $2';
    const result = await pool.query(userQuery, [rawInput.toLowerCase(), cleanDigits]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email/Aadhaar or password.' });
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
      return res.status(401).json({ error: 'Invalid email/Aadhaar or password.' });
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
        aadharNumber: user.aadhar_number,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Error during customer login:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// 3b. Admin / Operator Registration (Creates Role ADMIN or OPERATIONS)
app.post('/api/auth/admin/register', async (req, res) => {
  const { name, firstName, lastName, email, phone, password, role } = req.body;

  let fName = (firstName || '').trim();
  let lName = (lastName || '').trim();

  if (!fName && name) {
    const parts = name.trim().split(/\s+/);
    fName = parts[0] || '';
    lName = parts.slice(1).join(' ') || 'Staff';
  }

  if (!email || !password || !fName || !lName || !phone) {
    return res.status(400).json({ error: 'Please provide full name, email, phone number, and password.' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters long.' });
  }

  const assignedRole = (role === 'OPERATIONS' || role === 'OPERATOR') ? 'OPERATIONS' : 'ADMIN';
  const normalizedEmail = email.trim().toLowerCase();

  try {
    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'An account with this email address already exists. Please sign in.' });
    }

    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(password, salt);

    const insertQuery = `
      INSERT INTO users (email, password_hash, first_name, last_name, phone, role)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, first_name, last_name, date_of_birth, phone, role, created_at
    `;
    const result = await pool.query(insertQuery, [
      normalizedEmail,
      passwordHash,
      fName,
      lName,
      phone.trim(),
      assignedRole
    ]);

    const createdUser = result.rows[0];

    const token = jwt.sign(
      { id: createdUser.id, email: createdUser.email, role: createdUser.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: `${assignedRole === 'OPERATIONS' ? 'Operator' : 'Administrator'} account successfully created.`,
      token,
      user: {
        id: createdUser.id,
        email: createdUser.email,
        firstName: createdUser.first_name,
        lastName: createdUser.last_name,
        phone: createdUser.phone,
        role: createdUser.role
      }
    });
  } catch (err) {
    console.error('Error during admin/operator registration:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// 3c. Admin / Operator Sign In (Allows ADMIN and OPERATIONS Roles Only)
app.post('/api/auth/admin/login', async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const normalizedEmail = email.trim().toLowerCase();

  try {
    const userQuery = 'SELECT * FROM users WHERE email = $1';
    const result = await pool.query(userQuery, [normalizedEmail]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const user = result.rows[0];

    // Block customer accounts from admin portal
    if (user.role === 'CUSTOMER') {
      return res.status(403).json({
        error: `Access Denied: Account '${user.email}' is a Customer account. Please sign in via the Customer Portal.`
      });
    }

    // Role check: Only ADMIN and OPERATIONS are permitted
    if (user.role !== 'ADMIN' && user.role !== 'OPERATIONS') {
      return res.status(403).json({
        error: `Access Denied: Account '${user.email}' does not have administrative or operational privileges.`
      });
    }

    // If specific role requested, verify role matches or guide user
    if (role) {
      const targetRole = (role === 'OPERATIONS' || role === 'OPERATOR') ? 'OPERATIONS' : 'ADMIN';
      if (user.role !== targetRole) {
        return res.status(403).json({
          error: `Role Mismatch: Account '${user.email}' is registered as '${user.role}'. Please toggle to '${user.role === 'ADMIN' ? 'Administrator' : 'Operator'}' to sign in.`
        });
      }
    }

    const passwordMatch = await bcrypt.compare(password, user.password_hash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

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
    console.error('Error during admin/operator login:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// ==========================================
// ADMIN & OPERATIONS CLIENT MANAGEMENT
// ==========================================

// Authorize Admin or Operations roles
function authorizeStaff(req, res, next) {
  if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'OPERATIONS')) {
    return res.status(403).json({ error: 'Access Denied: Administrative or operations privileges required.' });
  }
  next();
}

// 1. Get All Partner Clients from PostgreSQL
app.get('/api/admin/clients', authenticateToken, authorizeStaff, async (req, res) => {
  try {
    const clientsQuery = 'SELECT * FROM clients ORDER BY created_at DESC';
    const result = await pool.query(clientsQuery);
    const clients = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      clientId: row.client_id || row.code,
      code: row.code,
      businessType: row.business_type || 'Bank',
      status: row.status || (row.is_active ? 'A-ACTIVE' : 'IA-INACTIVE'),
      address: row.address || '',
      state: row.state || '',
      contactEmail: row.contact_email || '',
      isActive: row.is_active,
      createdAt: row.created_at
    }));
    res.json(clients);
  } catch (err) {
    console.error('Error fetching clients:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// 2. Add New Client to PostgreSQL
app.post('/api/admin/clients', authenticateToken, authorizeStaff, async (req, res) => {
  const { name, clientId, businessType, status, address, state } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Client Name is required.' });
  }

  // Auto-generate client id if empty
  let generatedClientId = (clientId || '').trim();
  if (!generatedClientId) {
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    generatedClientId = `CLI-${randomDigits}`;
  }

  const selectedBusinessType = businessType || 'Bank';
  const selectedStatus = status || 'A-ACTIVE';
  const isActive = selectedStatus === 'A-ACTIVE';

  try {
    // Check if code/client_id already exists to prevent duplicate key constraint
    const existing = await pool.query(
      'SELECT id FROM clients WHERE code = $1 OR client_id = $1',
      [generatedClientId]
    );
    if (existing.rows.length > 0) {
      const randomDigits = Math.floor(100000 + Math.random() * 900000);
      generatedClientId = `CLI-${randomDigits}`;
    }

    const insertQuery = `
      INSERT INTO clients (name, code, client_id, business_type, status, address, state, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const result = await pool.query(insertQuery, [
      name.trim(),
      generatedClientId,
      generatedClientId,
      selectedBusinessType,
      selectedStatus,
      address ? address.trim() : '',
      state ? state.trim() : '',
      isActive
    ]);

    const created = result.rows[0];
    res.status(201).json({
      message: 'Client successfully added.',
      client: {
        id: created.id,
        name: created.name,
        clientId: created.client_id || created.code,
        code: created.code,
        businessType: created.business_type,
        status: created.status,
        address: created.address,
        state: created.state,
        isActive: created.is_active,
        createdAt: created.created_at
      }
    });
  } catch (err) {
    console.error('Error creating client:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// 3. Update Client Information in PostgreSQL
app.put('/api/admin/clients/:id', authenticateToken, authorizeStaff, async (req, res) => {
  const { id } = req.params;
  const { name, businessType, status, address, state } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Client Name cannot be empty.' });
  }

  const selectedBusinessType = businessType || 'Bank';
  const selectedStatus = status || 'A-ACTIVE';
  const isActive = selectedStatus === 'A-ACTIVE';

  try {
    const updateQuery = `
      UPDATE clients
      SET name = $1, business_type = $2, status = $3, address = $4, state = $5, is_active = $6
      WHERE id = $7
      RETURNING *
    `;
    const result = await pool.query(updateQuery, [
      name.trim(),
      selectedBusinessType,
      selectedStatus,
      address ? address.trim() : '',
      state ? state.trim() : '',
      isActive,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    const updated = result.rows[0];
    res.json({
      message: 'Client profile successfully updated.',
      client: {
        id: updated.id,
        name: updated.name,
        clientId: updated.client_id || updated.code,
        code: updated.code,
        businessType: updated.business_type,
        status: updated.status,
        address: updated.address,
        state: updated.state,
        isActive: updated.is_active,
        createdAt: updated.created_at
      }
    });
  } catch (err) {
    console.error('Error updating client:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// 4. Delete Client from PostgreSQL
app.delete('/api/admin/clients/:id', authenticateToken, authorizeStaff, async (req, res) => {
  const { id } = req.params;

  try {
    const deleteQuery = 'DELETE FROM clients WHERE id = $1 RETURNING id, name';
    const result = await pool.query(deleteQuery, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found.' });
    }

    res.json({
      message: `Client "${result.rows[0].name}" successfully deleted.`,
      deletedId: id
    });
  } catch (err) {
    console.error('Error deleting client:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// ==========================================
// PRODUCTS API
// ==========================================

// Helper to fetch all products from PostgreSQL
async function getProductsFromDb(res) {
  try {
    const result = await pool.query(
      'SELECT id, name, code, status, description, premium_rate_per_thousand FROM products ORDER BY name ASC'
    );
    res.json(result.rows.map(row => ({
      id: row.id,
      name: row.name,
      code: row.code,
      status: row.status,
      description: row.description || '',
      premiumRatePerThousand: parseFloat(row.premium_rate_per_thousand || 0)
    })));
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
}

// GET /api/products — list all products (public)
app.get('/api/products', async (req, res) => {
  await getProductsFromDb(res);
});

// GET /api/admin/products — list all products (admin/staff)
app.get('/api/admin/products', async (req, res) => {
  await getProductsFromDb(res);
});

// ==========================================
// ADMIN CAMPAIGN MANAGEMENT
// ==========================================

// GET /api/admin/campaigns — list all campaigns with client & product names
app.get('/api/admin/campaigns', authenticateToken, authorizeStaff, async (req, res) => {
  try {
    const query = `
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
        pr.code AS "productCode"
      FROM campaigns c
      JOIN clients cl ON c.client_id = cl.id
      JOIN products pr ON c.product_id = pr.id
      ORDER BY c.created_at DESC
    `;
    const result = await pool.query(query);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching campaigns:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// POST /api/admin/campaigns — create a new campaign
app.post('/api/admin/campaigns', authenticateToken, authorizeStaff, async (req, res) => {
  const { clientId, productId, campaignId, name, description, startMonth, endMonth, status } = req.body;

  if (!clientId || !productId || !campaignId || !startMonth || !endMonth) {
    return res.status(400).json({ error: 'Client, Product, Campaign ID, Start Month, and End Month are required.' });
  }

  // Convert YYYY-MM to YYYY-MM-01 date strings
  const startDate = `${startMonth}-01`;
  const endDate = `${endMonth}-01`;

  if (new Date(startDate) > new Date(endDate)) {
    return res.status(400).json({ error: 'Start month cannot be after End month.' });
  }

  const selectedStatus = status || 'PLANNED';
  const campaignName = name || campaignId;

  // Handle potential duplicate campaign_id by appending a suffix
  let finalCampaignId = campaignId;
  let suffix = 2;
  while (suffix <= 99) {
    const existing = await pool.query(
      'SELECT id FROM campaigns WHERE campaign_id = $1',
      [finalCampaignId]
    );
    if (existing.rows.length === 0) break;
    finalCampaignId = `${campaignId}-${suffix}`;
    suffix++;
  }

  try {
    const insertQuery = `
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
    `;
    const result = await pool.query(insertQuery, [
      clientId,
      productId,
      finalCampaignId,
      campaignName,
      description || null,
      selectedStatus,
      startDate,
      endDate
    ]);

    res.status(201).json({
      message: `Campaign "${finalCampaignId}" successfully created.`,
      campaign: result.rows[0]
    });
  } catch (err) {
    console.error('Error creating campaign:', err);
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

// 5. Validate Campaign Code (Multi-use: any customer can enroll via the campaign)
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

    // Note: Campaign codes can be used multiple times by different customers (e.g. from public ads/promotions)
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

  // === ELIGIBILITY CHECK: Age 18–69 at time of enrollment ===
  try {
    const userRes = await pool.query('SELECT date_of_birth, first_name, last_name FROM users WHERE id = $1', [req.user.id]);
    if (userRes.rows.length > 0 && userRes.rows[0].date_of_birth) {
      const dob = new Date(userRes.rows[0].date_of_birth);
      const today = new Date();
      let age = today.getFullYear() - dob.getFullYear();
      const m = today.getMonth() - dob.getMonth();
      if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
      if (age < 18 || age > 69) {
        return res.status(400).json({
          error: `Underwriting eligibility check failed: Customer age ${age} is outside the eligible range of 18–69 years. Policy cannot be issued.`
        });
      }
    }
  } catch (eligErr) {
    console.error('Eligibility check error:', eligErr.message);
  }

  // === INPUT VALIDATION ===
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
  if (Math.abs(totalPct - 100) > 0.01) {
    return res.status(400).json({ error: `Beneficiary percentages must equal 100%. Current total: ${totalPct.toFixed(1)}%` });
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

    // 3. Campaign code check if provided (multi-use allowed)
    let campaignCodeId = null;
    let campaignId = null;
    if (campaignCode) {
      const codeCheck = await client.query(
        "SELECT id, campaign_id FROM campaign_codes WHERE code = $1",
        [campaignCode.trim().toUpperCase()]
      );
      if (codeCheck.rows.length > 0) {
        campaignCodeId = codeCheck.rows[0].id;
        campaignId = codeCheck.rows[0].campaign_id;
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

    // 7. Initial Policy Audit Log
    try {
      await client.query(`
        INSERT INTO policy_audit_logs (policy_id, changed_by_user_id, action, new_value)
        VALUES ($1, $2, 'POLICY_ENROLLED', $3)
      `, [createdPolicy.id, req.user.id, JSON.stringify({ policyNumber, coverAmount, monthlyPremium, campaignCode })]);
    } catch (auditErr) {
      console.warn('Audit log write warning:', auditErr.message);
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

// 7. Update Policy Details (Cover Amount, Address, Beneficiaries with Audit History)
app.put('/api/policies/:id', authenticateToken, async (req, res) => {
  const policyId = req.params.id;
  const {
    coverAmount,
    addressLine1,
    addressLine2,
    city,
    state,
    zipCode,
    beneficiaries
  } = req.body;

  try {
    // 1. Verify policy belongs to this customer
    const curRes = await pool.query(
      'SELECT * FROM policies WHERE id = $1 AND user_id = $2',
      [policyId, req.user.id]
    );

    if (curRes.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found or unauthorized.' });
    }

    const current = curRes.rows[0];
    if (current.status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Only ACTIVE policies can be modified.' });
    }

    // 2. Validate Cover Amount if provided
    let newCoverAmount = parseFloat(current.cover_amount);
    let newMonthlyPremium = parseFloat(current.monthly_premium);

    if (coverAmount !== undefined && coverAmount !== null) {
      const numCover = Number(coverAmount);
      if (numCover < 10000 || numCover > 300000 || numCover % 5000 !== 0) {
        return res.status(400).json({ error: 'Cover amount must be between $10,000 and $300,000 in increments of $5,000.' });
      }
      newCoverAmount = numCover;
      newMonthlyPremium = (numCover / 1000) * 0.60;
    }

    // 3. Validate Address fields
    const newAddress1 = addressLine1 !== undefined ? addressLine1.trim() : current.address_line1;
    const newAddress2 = addressLine2 !== undefined ? (addressLine2 ? addressLine2.trim() : null) : current.address_line2;
    const newCity = city !== undefined ? city.trim() : current.city;
    const newState = state !== undefined ? state.trim() : current.state;
    const newZip = zipCode !== undefined ? zipCode.trim() : current.zip_code;

    if (!newAddress1 || !newCity || !newState || !newZip) {
      return res.status(400).json({ error: 'Complete mailing address (street, city, state, zip) is required.' });
    }

    // 4. Validate Beneficiaries if provided
    if (beneficiaries !== undefined) {
      if (!Array.isArray(beneficiaries) || beneficiaries.length === 0) {
        return res.status(400).json({ error: 'At least one beneficiary is required.' });
      }
      const totalPct = beneficiaries.reduce((sum, b) => sum + (parseFloat(b.percentage) || 0), 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        return res.status(400).json({ error: `Beneficiary percentages must sum to exactly 100%. Current sum: ${totalPct.toFixed(1)}%` });
      }
      for (const b of beneficiaries) {
        if (!b.firstName || !b.firstName.trim() || !b.lastName || !b.lastName.trim()) {
          return res.status(400).json({ error: 'First and last name are required for all beneficiaries.' });
        }
      }
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Update Policy
      await client.query(`
        UPDATE policies
        SET cover_amount = $1, monthly_premium = $2,
            address_line1 = $3, address_line2 = $4, city = $5, state = $6, zip_code = $7,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $8 AND user_id = $9
      `, [newCoverAmount, newMonthlyPremium, newAddress1, newAddress2, newCity, newState, newZip, policyId, req.user.id]);

      // Audit Log for Cover Amount
      if (parseFloat(current.cover_amount) !== newCoverAmount) {
        try {
          await client.query(`
            INSERT INTO policy_audit_logs (policy_id, changed_by_user_id, action, old_value, new_value)
            VALUES ($1, $2, 'UPDATE_COVER_AMOUNT', $3, $4)
          `, [policyId, req.user.id, JSON.stringify({ coverAmount: current.cover_amount }), JSON.stringify({ coverAmount: newCoverAmount })]);
        } catch (logErr) {
          console.warn('Cover audit log warning:', logErr.message);
        }
      }

      // Audit Log for Address
      const oldAddrStr = `${current.address_line1 || ''}, ${current.city || ''}, ${current.state || ''} ${current.zip_code || ''}`;
      const newAddrStr = `${newAddress1}, ${newCity}, ${newState} ${newZip}`;
      if (oldAddrStr !== newAddrStr) {
        try {
          await client.query(`
            INSERT INTO policy_audit_logs (policy_id, changed_by_user_id, action, old_value, new_value)
            VALUES ($1, $2, 'UPDATE_ADDRESS', $3, $4)
          `, [policyId, req.user.id, JSON.stringify({ address: oldAddrStr }), JSON.stringify({ address: newAddrStr })]);
        } catch (logErr) {
          console.warn('Address audit log warning:', logErr.message);
        }
      }

      // Update Beneficiaries if provided
      if (beneficiaries !== undefined) {
        await client.query('DELETE FROM beneficiaries WHERE policy_id = $1', [policyId]);
        for (const b of beneficiaries) {
          await client.query(`
            INSERT INTO beneficiaries (policy_id, first_name, last_name, relationship, percentage, phone)
            VALUES ($1, $2, $3, $4, $5, $6)
          `, [
            policyId,
            b.firstName.trim(),
            b.lastName.trim(),
            b.relationship || 'Spouse',
            parseFloat(b.percentage),
            b.phone || null
          ]);
        }

        try {
          await client.query(`
            INSERT INTO policy_audit_logs (policy_id, changed_by_user_id, action, new_value)
            VALUES ($1, $2, 'UPDATE_BENEFICIARIES', $3)
          `, [policyId, req.user.id, JSON.stringify({ beneficiaries })]);
        } catch (logErr) {
          console.warn('Beneficiary audit log warning:', logErr.message);
        }
      }

      await client.query('COMMIT');

      res.json({
        message: 'Policy successfully updated in database.',
        policyId,
        coverAmount: newCoverAmount,
        monthlyPremium: newMonthlyPremium
      });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error updating policy:', err);
      res.status(500).json({ error: 'Failed to update policy: ' + err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error in policy update route:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// 8. Cancel Policy
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
