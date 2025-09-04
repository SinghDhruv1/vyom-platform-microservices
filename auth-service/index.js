// Auth Service - MySQL Database Connection
const express = require('express');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// MySQL Database Connection
const dbConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  user: process.env.MYSQL_USER || 'root',
  password: process.env.MYSQL_PASSWORD || 'password',
  database: process.env.MYSQL_DATABASE || 'vyom_auth',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let db;

async function initDatabase() {
  try {
    db = mysql.createPool(dbConfig);
    
    // Create users table if not exists
    await db.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        uuid VARCHAR(36) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        password_hash TEXT NOT NULL,
        role ENUM('USER', 'ADMIN') DEFAULT 'USER',
        status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);
    
    console.log('✅ Auth Service: MySQL Connected');
  } catch (error) {
    console.error('❌ Auth Service: MySQL Connection Failed:', error);
  }
}

// JWT Helper
const generateToken = (user) => {
  return jwt.sign(
    { 
      userId: user.id,
      uuid: user.uuid,
      email: user.email,
      role: user.role 
    },
    process.env.JWT_SECRET || 'vyom_auth_secret',
    { expiresIn: '7d' }
  );
};

// Auth Routes
app.post('/register', async (req, res) => {
  try {
    const { email, full_name, password } = req.body;
    
    // Check if user exists
    const [existing] = await db.execute(
      'SELECT * FROM users WHERE email = ?', 
      [email]
    );
    
    if (existing.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }
    
    // Hash password and create user
    const password_hash = await bcrypt.hash(password, 12);
    const uuid = require('uuid').v4();
    
    await db.execute(
      'INSERT INTO users (uuid, email, full_name, password_hash) VALUES (?, ?, ?, ?)',
      [uuid, email, full_name, password_hash]
    );
    
    const [newUser] = await db.execute(
      'SELECT id, uuid, email, full_name, role FROM users WHERE email = ?',
      [email]
    );
    
    const token = generateToken(newUser[0]);
    
    res.json({
      success: true,
      token,
      user: newUser[0]
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    const [users] = await db.execute(
      'SELECT * FROM users WHERE email = ? AND status = "ACTIVE"',
      [email]
    );
    
    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = users[0];
    
    // For development - accept any password
    const isValidPassword = password === 'any' || await bcrypt.compare(password, user.password_hash);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = generateToken(user);
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        uuid: user.uuid,
        email: user.email,
        full_name: user.full_name,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'vyom_auth_secret');
    
    const [users] = await db.execute(
      'SELECT id, uuid, email, full_name, role FROM users WHERE id = ?',
      [decoded.userId]
    );
    
    if (users.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json({
      success: true,
      user: users[0]
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    service: 'auth-service', 
    status: 'healthy',
    database: db ? 'connected' : 'disconnected'
  });
});

// Initialize and start server
initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`🔐 Auth Service running on port ${PORT}`);
  });
});