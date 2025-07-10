// Load environment variables
require('dotenv').config();

const express = require('express');
const multer = require('multer');
const path = require('path');
const { exec } = require('child_process');
const cors = require('cors');

// Import authentication routes
const authRoutes = require('./login_signup');

const app = express();
const port = 5000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: 'http://localhost:3000', // Allow frontend to connect
  credentials: true
}));

// Routes
app.use('/api/auth', authRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    success: true, 
    message: 'Server is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ 
    success: false, 
    message: 'Internal server error' 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    success: false, 
    message: 'Route not found' 
  });
});

app.listen(port, () => {
    console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📝 API Documentation:`);
  console.log(`   POST /api/auth/signup/user - Register general user`);
  console.log(`   POST /api/auth/signup/police - Register police officer`);
  console.log(`   POST /api/auth/signup/doctor - Register doctor`);
  console.log(`   POST /api/auth/login - Login for all user types`);
  console.log(`   GET /api/auth/profile - Get user profile (requires token)`);
  console.log(`   PUT /api/auth/profile - Update user profile (requires token)`);
  });