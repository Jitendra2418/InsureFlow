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

// GET /api/admin/campaigns — list all campaigns with client & product names and event count
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
        pr.code AS "productCode",
        COUNT(ce.id)::int AS "eventsCount"
      FROM campaigns c
      JOIN clients cl ON c.client_id = cl.id
      JOIN products pr ON c.product_id = pr.id
      LEFT JOIN campaign_events ce ON ce.campaign_id = c.id
      GROUP BY c.id, cl.name, pr.name, pr.code
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

// ==========================================
// ADMIN CAMPAIGN EVENTS MANAGEMENT
// ==========================================

// GET /api/admin/events — list events (optional ?campaignId=...)
app.get('/api/admin/events', authenticateToken, authorizeStaff, async (req, res) => {
  const { campaignId } = req.query;
  try {
    let query = `
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
    `;
    const params = [];
    if (campaignId) {
      query += ` WHERE ce.campaign_id = $1`;
      params.push(campaignId);
    }
    query += `
      GROUP BY ce.id, c.campaign_id, c.name, cl.name, pr.name
      ORDER BY ce.created_at DESC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching campaign events:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// POST /api/admin/events — create new campaign event
app.post('/api/admin/events', authenticateToken, authorizeStaff, async (req, res) => {
  const {
    campaignId,
    eventId,
    channel,
    media,
    scheduledDrop,
    finalDescription,
    type,
    quantity
  } = req.body;

  if (!campaignId) {
    return res.status(400).json({ error: 'Campaign is required. Please select a campaign.' });
  }
  if (!channel) {
    return res.status(400).json({ error: 'Channel is required.' });
  }
  if (!media) {
    return res.status(400).json({ error: 'Media is required.' });
  }
  if (!scheduledDrop) {
    return res.status(400).json({ error: 'Scheduled drop date is required.' });
  }
  if (!type) {
    return res.status(400).json({ error: 'Type is required.' });
  }

  const parsedQty = parseInt(quantity || '0', 10);
  if (isNaN(parsedQty) || parsedQty < 0) {
    return res.status(400).json({ error: 'Quantity must be a valid positive number.' });
  }

  // Auto-generate eventId if empty or check collision
  let finalEventId = (eventId || '').trim();
  if (!finalEventId) {
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    finalEventId = `EVT-${randomDigits}`;
  }

  // Handle unique constraint collision
  let suffix = 2;
  while (suffix <= 99) {
    const existing = await pool.query(
      'SELECT id FROM campaign_events WHERE event_id = $1',
      [finalEventId]
    );
    if (existing.rows.length === 0) break;
    finalEventId = `${eventId || 'EVT'}-${suffix}`;
    suffix++;
  }

  try {
    const insertQuery = `
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
    `;
    const result = await pool.query(insertQuery, [
      campaignId,
      finalEventId,
      channel,
      media,
      scheduledDrop,
      finalDescription || null,
      type,
      parsedQty
    ]);

    const createdEvent = result.rows[0];
    const joinedRes = await pool.query(`
      SELECT c.campaign_id AS "campaignCode", c.name AS "campaignName", cl.name AS "clientName", pr.name AS "productName"
      FROM campaigns c
      JOIN clients cl ON c.client_id = cl.id
      JOIN products pr ON c.product_id = pr.id
      WHERE c.id = $1
    `, [campaignId]);

    const enriched = {
      ...createdEvent,
      ...(joinedRes.rows[0] || {})
    };

    res.status(201).json({
      message: `Event "${finalEventId}" successfully created.`,
      event: enriched
    });
  } catch (err) {
    console.error('Error creating campaign event:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// =======================================================
// SEGMENT MANAGEMENT ENDPOINTS (INS-6)
// =======================================================

// GET /api/admin/segments/customer-stats — live counts of insured vs uninsured
app.get('/api/admin/segments/customer-stats', authenticateToken, authorizeStaff, async (req, res) => {
  try {
    const statsQuery = `
      SELECT
        COUNT(DISTINCT u.id) FILTER (WHERE p.id IS NOT NULL)::int AS "insuredCount",
        COUNT(DISTINCT u.id) FILTER (WHERE p.id IS NULL AND u.role = 'CUSTOMER')::int AS "uninsuredCount",
        COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'CUSTOMER')::int AS "totalCustomers"
      FROM users u
      LEFT JOIN policies p ON p.user_id = u.id;
    `;
    const result = await pool.query(statsQuery);
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching customer stats:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// GET /api/admin/segments — list segments (optional ?eventId=...)
app.get('/api/admin/segments', authenticateToken, authorizeStaff, async (req, res) => {
  const { eventId } = req.query;
  try {
    let query = `
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
    `;
    const params = [];
    if (eventId) {
      query += ` WHERE s.event_id = $1`;
      params.push(eventId);
    }
    query += ` ORDER BY s.created_at DESC`;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching segments:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// POST /api/admin/segments — create a new segment
app.post('/api/admin/segments', authenticateToken, authorizeStaff, async (req, res) => {
  const { eventId, insuranceStatus, clientId, target, description } = req.body;

  if (!eventId) {
    return res.status(400).json({ error: 'Event selection is required.' });
  }
  if (!insuranceStatus || !['I', 'UI'].includes(insuranceStatus)) {
    return res.status(400).json({ error: 'Insurance status must be "I" (Insured) or "UI" (Uninsured).' });
  }
  if (!clientId) {
    return res.status(400).json({ error: 'Bank (Client) selection is required.' });
  }

  const parsedTarget = parseInt(target, 10);
  if (isNaN(parsedTarget) || parsedTarget <= 0) {
    return res.status(400).json({ error: 'Target must be a positive number greater than 0.' });
  }

  try {
    // 1. Fetch parent event details & quantity
    const eventRes = await pool.query(`
      SELECT ce.id, ce.event_id, ce.quantity, c.name as campaign_name
      FROM campaign_events ce
      JOIN campaigns c ON ce.campaign_id = c.id
      WHERE ce.id = $1
    `, [eventId]);

    if (eventRes.rows.length === 0) {
      return res.status(404).json({ error: 'Selected event not found in database.' });
    }

    const event = eventRes.rows[0];
    const eventQuantity = event.quantity || 0;

    // 2. Fetch current allocated target sum for this event
    const sumRes = await pool.query(`
      SELECT COALESCE(SUM(target), 0)::int AS "allocatedTarget"
      FROM segments
      WHERE event_id = $1
    `, [eventId]);

    const allocatedTarget = sumRes.rows[0].allocatedTarget;
    const remainingTarget = eventQuantity - allocatedTarget;

    if (allocatedTarget + parsedTarget > eventQuantity) {
      return res.status(400).json({
        error: `Target (${parsedTarget}) exceeds event remaining capacity! Current event quantity is ${eventQuantity}, already allocated is ${allocatedTarget}, remaining available is ${remainingTarget}.`
      });
    }

    // 3. Fetch client details to determine bank name and state
    const clientRes = await pool.query('SELECT id, name, code, state FROM clients WHERE id = $1', [clientId]);
    if (clientRes.rows.length === 0) {
      return res.status(404).json({ error: 'Selected bank/client not found in database.' });
    }
    const client = clientRes.rows[0];

    // Determine state (fallback to XX if not set)
    const clientState = (client.state && client.state.trim()) ? client.state.trim().toUpperCase() : 'ALL';
    // Format bank identifier: uppercase, alphanumeric only
    const bankIdentifier = (client.name || client.code || 'BANK').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
    
    // Spoken Key format: UI-AXIS-TX or I-ICICI-MH
    const spokenKey = `${insuranceStatus}-${bankIdentifier}-${clientState}`;
    const segmentName = `${spokenKey} Segment`;

    // 4. Insert into segments table
    const insertQuery = `
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
    `;

    const insertRes = await pool.query(insertQuery, [
      eventId,
      segmentName,
      insuranceStatus,
      clientId,
      clientState,
      spokenKey,
      parsedTarget,
      description || null
    ]);

    const createdSegment = insertRes.rows[0];
    const enriched = {
      ...createdSegment,
      clientName: client.name,
      clientCode: client.code,
      eventCode: event.event_id,
      eventQuantity: eventQuantity,
      campaignName: event.campaign_name
    };

    res.status(201).json({
      message: `Segment "${spokenKey}" created successfully with target ${parsedTarget}.`,
      segment: enriched
    });
  } catch (err) {
    console.error('Error creating segment:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// =======================================================
// CLAIMS MANAGEMENT ENDPOINTS (INS-9)
// =======================================================

// GET /api/admin/claims — list all claims with insured person name, product, policy, and uploaded documents
app.get('/api/admin/claims', authenticateToken, authorizeStaff, async (req, res) => {
  const { status } = req.query;
  try {
    let query = `
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
    `;

    const params = [];
    if (status && status !== 'ALL') {
      params.push(status);
      query += ` WHERE c.status = $1`;
    }

    query += `
      GROUP BY c.id, p.policy_number, u.first_name, u.last_name, u.email, u.phone, pr.id, pr.name, pr.code
      ORDER BY c.created_at DESC
    `;

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching admin claims:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// PATCH /api/admin/claims/:id/status — update claim status (SUBMITTED, UNDER_REVIEW, APPROVED, REJECTED)
app.patch('/api/admin/claims/:id/status', authenticateToken, authorizeStaff, async (req, res) => {
  const { id } = req.params;
  const { status, reviewerNotes, approvedAmount } = req.body;

  const validStatuses = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'];
  if (!status || !validStatuses.includes(status)) {
    return res.status(400).json({ 
      error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` 
    });
  }

  try {
    const updateQuery = `
      UPDATE claims
      SET
        status = $1::text,
        reviewer_notes = COALESCE($2::text, reviewer_notes),
        approved_amount = CASE 
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
    `;

    const result = await pool.query(updateQuery, [
      status,
      reviewerNotes || null,
      approvedAmount !== undefined ? approvedAmount : null,
      req.user.id,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Claim not found.' });
    }

    res.json({
      message: `Claim status successfully updated to "${status}".`,
      claim: result.rows[0]
    });
  } catch (err) {
    console.error('Error updating claim status:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// POST /api/claims — allow customer or admin to submit a claim (with optional document metadata)
app.post('/api/claims', authenticateToken, async (req, res) => {
  const { policyId, incidentType, incidentDate, description, claimedAmount, documents } = req.body;

  if (!policyId || !incidentType || !incidentDate || !claimedAmount) {
    return res.status(400).json({ error: 'Policy ID, Incident Type, Incident Date, and Claimed Amount are required.' });
  }

  try {
    // Verify policy exists and belongs to user (or staff)
    const policyRes = await pool.query('SELECT * FROM policies WHERE id = $1', [policyId]);
    if (policyRes.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found.' });
    }
    const policy = policyRes.rows[0];

    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    const claimNumber = `CLM-${new Date().getFullYear()}-${randomDigits}`;

    const claimInsert = `
      INSERT INTO claims (
        policy_id, user_id, claim_number, incident_type, incident_date,
        description, status, claimed_amount
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'SUBMITTED', $7)
      RETURNING *
    `;

    const claimRes = await pool.query(claimInsert, [
      policyId,
      policy.user_id,
      claimNumber,
      incidentType,
      incidentDate,
      description || null,
      parseFloat(claimedAmount)
    ]);

    const createdClaim = claimRes.rows[0];

    // Insert attached documents (S3 metadata)
    const insertedDocs = [];
    if (Array.isArray(documents) && documents.length > 0) {
      for (const doc of documents) {
        const docInsert = `
          INSERT INTO claim_documents (
            claim_id, file_name, s3_key, content_type, file_size
          )
          VALUES ($1, $2, $3, $4, $5)
          RETURNING *
        `;
        const s3Key = doc.s3Key || `claims/${createdClaim.id}/${Date.now()}_${(doc.fileName || 'document.pdf').replace(/\s+/g, '_')}`;
        const docRes = await pool.query(docInsert, [
          createdClaim.id,
          doc.fileName || 'Supporting_Document.pdf',
          s3Key,
          doc.contentType || 'application/pdf',
          doc.fileSize || 102400
        ]);
        insertedDocs.push(docRes.rows[0]);
      }
    }

    res.status(201).json({
      message: `Claim ${claimNumber} submitted successfully.`,
      claim: {
        ...createdClaim,
        documents: insertedDocs
      }
    });
  } catch (err) {
    console.error('Error submitting claim:', err);
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
          SELECT id, first_name, last_name, relationship, percentage, phone, is_primary, guardian_name
          FROM beneficiaries
          WHERE policy_id = $1 AND is_active = true
          ORDER BY is_primary DESC, percentage DESC, created_at ASC
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
            phone: b.phone,
            isPrimary: b.is_primary !== false,
            guardianName: b.guardian_name || ''
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

// 4b. GET /api/policies/:id — Fetch Single Policy with Full Actuarial & Audit Details (INS-19)
app.get('/api/policies/:id', authenticateToken, async (req, res) => {
  const policyId = req.params.id;
  try {
    const policyQuery = `
      SELECT p.*, pr.name as product_name, pr.code as product_code, cc.code as campaign_code
      FROM policies p
      JOIN products pr ON p.product_id = pr.id
      LEFT JOIN campaign_codes cc ON p.campaign_code_id = cc.id
      WHERE p.id = $1 AND p.user_id = $2
    `;
    const policyRes = await pool.query(policyQuery, [policyId, req.user.id]);
    if (policyRes.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found or unauthorized.' });
    }
    const row = policyRes.rows[0];

    // Fetch Beneficiaries
    const benRes = await pool.query(`
      SELECT id, first_name, last_name, relationship, percentage, phone, is_primary, guardian_name
      FROM beneficiaries
      WHERE policy_id = $1 AND is_active = true
      ORDER BY is_primary DESC, percentage DESC, created_at ASC
    `, [policyId]);

    // Fetch Audit Logs
    let auditLogs = [];
    try {
      const auditRes = await pool.query(`
        SELECT pal.id, pal.action, pal.old_value, pal.new_value, pal.changed_at,
               u.first_name, u.last_name
        FROM policy_audit_logs pal
        LEFT JOIN users u ON pal.changed_by_user_id = u.id
        WHERE pal.policy_id = $1
        ORDER BY pal.changed_at DESC
      `, [policyId]);
      auditLogs = auditRes.rows;
    } catch (auditErr) {
      console.warn('Audit fetch warning:', auditErr.message);
    }

    const monthlyPrem = parseFloat(row.monthly_premium);
    const annualPrem = parseFloat((monthlyPrem * 12).toFixed(2));
    const dailyMicro = parseFloat(((monthlyPrem * 12) / 365).toFixed(2));

    res.json({
      id: row.id,
      policyNumber: row.policy_number,
      userId: row.user_id,
      productId: row.product_id,
      productName: row.product_name,
      productCode: row.product_code,
      campaignCode: row.campaign_code || '',
      coverAmount: parseFloat(row.cover_amount),
      monthlyPremium: monthlyPrem,
      annualPremium: annualPrem,
      dailyRate: dailyMicro,
      status: row.status,
      effectiveDate: row.effective_date ? row.effective_date.toISOString().split('T')[0] : '',
      cancellationDate: row.cancellation_date ? row.cancellation_date.toISOString().split('T')[0] : null,
      cancellationReason: row.cancellation_reason || null,
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
        phone: b.phone,
        isPrimary: b.is_primary !== false,
        guardianName: b.guardian_name || ''
      })),
      auditLogs,
      createdAt: row.created_at
    });
  } catch (err) {
    console.error('Error fetching policy details:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// 4c. GET /api/policies/:id/audit-logs — Dedicated Policy Audit History (INS-19)
app.get('/api/policies/:id/audit-logs', authenticateToken, async (req, res) => {
  const policyId = req.params.id;
  try {
    const check = await pool.query('SELECT id FROM policies WHERE id = $1 AND user_id = $2', [policyId, req.user.id]);
    if (check.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found or unauthorized.' });
    }

    const auditRes = await pool.query(`
      SELECT pal.id, pal.action, pal.old_value, pal.new_value, pal.changed_at,
             u.first_name, u.last_name
      FROM policy_audit_logs pal
      LEFT JOIN users u ON pal.changed_by_user_id = u.id
      WHERE pal.policy_id = $1
      ORDER BY pal.changed_at DESC
    `, [policyId]);

    res.json(auditRes.rows);
  } catch (err) {
    console.error('Error fetching policy audit history:', err);
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

// Beneficiary Validation Helper (ERISA & Insurance Compliance Standards)
function validateBeneficiaries(beneficiaries) {
  if (!beneficiaries || !Array.isArray(beneficiaries) || beneficiaries.length === 0) {
    return { valid: false, error: 'At least one primary beneficiary designation is required.' };
  }

  const primary = beneficiaries.filter(b => b.isPrimary !== false);
  const contingent = beneficiaries.filter(b => b.isPrimary === false);

  if (primary.length === 0) {
    return { valid: false, error: 'At least one Primary beneficiary must be designated.' };
  }

  const primarySum = primary.reduce((sum, b) => sum + (parseFloat(b.percentage) || 0), 0);
  if (Math.abs(primarySum - 100) > 0.01) {
    return { valid: false, error: `Primary beneficiary allocations must sum to exactly 100%. Current total: ${primarySum.toFixed(1)}%` };
  }

  if (contingent.length > 0) {
    const contSum = contingent.reduce((sum, b) => sum + (parseFloat(b.percentage) || 0), 0);
    if (Math.abs(contSum - 100) > 0.01) {
      return { valid: false, error: `Contingent beneficiary allocations must sum to exactly 100%. Current total: ${contSum.toFixed(1)}%` };
    }
  }

  for (const b of beneficiaries) {
    if (!b.firstName || !b.firstName.trim() || !b.lastName || !b.lastName.trim()) {
      return { valid: false, error: 'First and last name are required for every beneficiary.' };
    }
    const pct = parseFloat(b.percentage);
    if (isNaN(pct) || pct <= 0 || pct > 100) {
      return { valid: false, error: `Invalid allocation percentage for ${b.firstName} ${b.lastName}. Must be between 0.01% and 100%.` };
    }
    const isMinor = b.relationship === 'Child' || b.relationship === 'Child (Minor under 18)';
    if (isMinor && (!b.guardianName || !b.guardianName.trim())) {
      return { valid: false, error: `Legal Guardian / Trustee is required for minor beneficiary ${b.firstName} ${b.lastName}.` };
    }
  }

  return { valid: true };
}

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

  const benValidation = validateBeneficiaries(beneficiaries);
  if (!benValidation.valid) {
    return res.status(400).json({ error: benValidation.error });
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
        INSERT INTO beneficiaries (policy_id, first_name, last_name, relationship, percentage, phone, is_primary, guardian_name)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        createdPolicy.id,
        b.firstName.trim(),
        b.lastName.trim(),
        b.relationship || 'Spouse',
        parseFloat(b.percentage),
        b.phone ? b.phone.trim() : null,
        b.isPrimary !== false,
        b.guardianName ? b.guardianName.trim() : null
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
      const benValidation = validateBeneficiaries(beneficiaries);
      if (!benValidation.valid) {
        return res.status(400).json({ error: benValidation.error });
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
            INSERT INTO beneficiaries (policy_id, first_name, last_name, relationship, percentage, phone, is_primary, guardian_name)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          `, [
            policyId,
            b.firstName.trim(),
            b.lastName.trim(),
            b.relationship || 'Spouse',
            parseFloat(b.percentage),
            b.phone ? b.phone.trim() : null,
            b.isPrimary !== false,
            b.guardianName ? b.guardianName.trim() : null
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

// 7b. Dedicated Update Policy Beneficiaries Endpoint (ERISA / Insurance Compliance)
app.put('/api/policies/:id/beneficiaries', authenticateToken, async (req, res) => {
  const policyId = req.params.id;
  const { beneficiaries } = req.body;

  const validation = validateBeneficiaries(beneficiaries);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const curRes = await pool.query(
      'SELECT id, policy_number, status FROM policies WHERE id = $1 AND user_id = $2',
      [policyId, req.user.id]
    );

    if (curRes.rows.length === 0) {
      return res.status(404).json({ error: 'Policy not found or unauthorized.' });
    }

    if (curRes.rows[0].status !== 'ACTIVE') {
      return res.status(400).json({ error: 'Only ACTIVE policies can have beneficiaries modified.' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM beneficiaries WHERE policy_id = $1', [policyId]);

      for (const b of beneficiaries) {
        await client.query(`
          INSERT INTO beneficiaries (policy_id, first_name, last_name, relationship, percentage, phone, is_primary, guardian_name)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        `, [
          policyId,
          b.firstName.trim(),
          b.lastName.trim(),
          b.relationship || 'Spouse',
          parseFloat(b.percentage),
          b.phone ? b.phone.trim() : null,
          b.isPrimary !== false,
          b.guardianName ? b.guardianName.trim() : null
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

      await client.query('COMMIT');
      res.json({ message: 'Beneficiaries successfully updated in database.', policyId, beneficiaries });
    } catch (err) {
      await client.query('ROLLBACK');
      console.error('Error updating beneficiaries:', err);
      res.status(500).json({ error: 'Database error: ' + err.message });
    } finally {
      client.release();
    }
  } catch (err) {
    console.error('Error in PUT /api/policies/:id/beneficiaries:', err);
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

// =======================================================
// BILLING ROUTES
// =======================================================

// Ensure payment_retry_queue table exists (idempotent)
(async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_retry_queue (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        premium_record_id UUID NOT NULL REFERENCES premium_records(id) ON DELETE CASCADE,
        retry_number INT NOT NULL,
        scheduled_at TIMESTAMPTZ NOT NULL,
        attempted_at TIMESTAMPTZ,
        result TEXT,
        created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`ALTER TABLE premium_records ADD COLUMN IF NOT EXISTS payment_attempt_count INT DEFAULT 0`).catch(() => {});
    await pool.query(`ALTER TABLE premium_records ADD COLUMN IF NOT EXISTS last_attempted_at TIMESTAMPTZ`).catch(() => {});
  } catch (e) {
    console.error('Billing table init error:', e.message);
  }
})();

// GET /api/admin/billing — list all premium records with full customer + policy info
app.get('/api/admin/billing', authenticateToken, authorizeStaff, async (req, res) => {
  const { status, search } = req.query;
  try {
    let query = `
      SELECT
        pr.id,
        pr.billing_month AS "billingMonth",
        pr.amount,
        pr.status,
        pr.retry_count AS "retryCount",
        pr.due_date AS "dueDate",
        pr.paid_at AS "paidAt",
        pr.created_at AS "createdAt",
        p.id AS "policyId",
        p.policy_number AS "policyNumber",
        p.cover_amount AS "coverAmount",
        p.monthly_premium AS "monthlyPremium",
        p.effective_date AS "effectiveDate",
        p.address_line1 AS "addressLine1",
        p.address_line2 AS "addressLine2",
        p.city,
        p.state,
        p.zip_code AS "zipCode",
        u.id AS "userId",
        u.first_name AS "firstName",
        u.last_name AS "lastName",
        CONCAT(u.first_name, ' ', u.last_name) AS "customerName",
        u.email AS "customerEmail",
        u.phone AS "customerPhone",
        pr2.name AS "productName",
        COALESCE(
          (SELECT json_agg(json_build_object(
            'id', rq.id,
            'retryNumber', rq.retry_number,
            'scheduledAt', rq.scheduled_at,
            'attemptedAt', rq.attempted_at,
            'result', rq.result
          ) ORDER BY rq.retry_number)
          FROM payment_retry_queue rq
          WHERE rq.premium_record_id = pr.id),
          '[]'::json
        ) AS "retryHistory"
      FROM premium_records pr
      JOIN policies p ON pr.policy_id = p.id
      JOIN users u ON p.user_id = u.id
      JOIN products pr2 ON p.product_id = pr2.id
    `;

    const params = [];
    const conditions = [];

    if (status && status !== 'ALL') {
      params.push(status);
      conditions.push(`pr.status = $${params.length}::text`);
    }
    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`);
      conditions.push(`(LOWER(CONCAT(u.first_name, ' ', u.last_name)) LIKE $${params.length} OR LOWER(p.policy_number) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length})`);
    }

    if (conditions.length > 0) query += ' WHERE ' + conditions.join(' AND ');
    query += ' ORDER BY pr.billing_month DESC, pr.created_at DESC';

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching billing records:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// GET /api/admin/billing/stats — summary counts by status
app.get('/api/admin/billing/stats', authenticateToken, authorizeStaff, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'PAID') AS paid,
        COUNT(*) FILTER (WHERE status = 'PENDING') AS pending,
        COUNT(*) FILTER (WHERE status = 'FAILED') AS failed,
        COUNT(*) FILTER (WHERE status = 'RETRY_SCHEDULED') AS retry_scheduled,
        COALESCE(SUM(amount) FILTER (WHERE status = 'PAID'), 0) AS total_collected,
        COALESCE(SUM(amount) FILTER (WHERE status IN ('PENDING','RETRY_SCHEDULED','FAILED')), 0) AS total_outstanding,
        COUNT(DISTINCT policy_id) AS total_policies
      FROM premium_records
    `);
    const row = result.rows[0];
    res.json({
      paid: parseInt(row.paid, 10),
      pending: parseInt(row.pending, 10),
      failed: parseInt(row.failed, 10),
      retryScheduled: parseInt(row.retry_scheduled, 10),
      totalCollected: parseFloat(row.total_collected),
      totalOutstanding: parseFloat(row.total_outstanding),
      totalPolicies: parseInt(row.total_policies, 10),
    });
  } catch (err) {
    console.error('Error fetching billing stats:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// POST /api/admin/billing/trigger — manually trigger billing run (admin tool)
app.post('/api/admin/billing/trigger', authenticateToken, authorizeStaff, async (req, res) => {
  try {
    const { generateMonthlyPremiumRecords, processPendingCharges } = require('./services/billingService');
    const genResult = await generateMonthlyPremiumRecords(new Date());
    const chargeResult = await processPendingCharges();
    res.json({
      message: 'Billing run triggered successfully.',
      generated: genResult,
      charged: chargeResult,
    });
  } catch (err) {
    console.error('Error triggering billing run:', err);
    res.status(500).json({ error: 'Billing trigger error: ' + err.message });
  }
});

// POST /api/admin/billing/retry — manually trigger retry processing
app.post('/api/admin/billing/retry', authenticateToken, authorizeStaff, async (req, res) => {
  try {
    const { processDueRetries } = require('./services/billingService');
    const retryResult = await processDueRetries();
    res.json({
      message: 'Retry job triggered successfully.',
      result: retryResult,
    });
  } catch (err) {
    console.error('Error triggering retry run:', err);
    res.status(500).json({ error: 'Retry trigger error: ' + err.message });
  }
});

// POST /api/admin/billing/:id/send-reminder — mock send payment reminder email
app.post('/api/admin/billing/:id/send-reminder', authenticateToken, authorizeStaff, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT pr.id, pr.amount, pr.billing_month, pr.status,
             p.policy_number, u.email, u.first_name, u.last_name
      FROM premium_records pr
      JOIN policies p ON pr.policy_id = p.id
      JOIN users u ON p.user_id = u.id
      WHERE pr.id = $1::uuid
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Billing record not found.' });
    }

    const record = result.rows[0];
    const billingMonth = new Date(record.billing_month).toLocaleString('default', { month: 'long', year: 'numeric' });

    // Mock email (in production: integrate Nodemailer / SendGrid / SES)
    console.log(`\n📧 [Mock Email] Payment reminder sent to ${record.email}`);
    console.log(`   Policy: ${record.policy_number}`);
    console.log(`   Amount: $${record.amount}`);
    console.log(`   Month:  ${billingMonth}`);
    console.log(`   Status: ${record.status}\n`);

    res.json({
      message: `Payment reminder email sent to ${record.email}`,
      recipient: {
        name: `${record.first_name} ${record.last_name}`,
        email: record.email,
      },
      policyNumber: record.policy_number,
      amount: parseFloat(record.amount),
      billingMonth,
      sentAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Error sending reminder:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 InsureFlow Backend API running on http://localhost:${PORT}`);
  console.log(`📡 Connecting to PostgreSQL at ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'insureflow'}`);
  console.log(`=======================================================`);
});
