// Load environment variables
require('dotenv').config();

const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

const router = express.Router();




// Middleware
router.use(express.json());
router.use(cors());

// Initialize Supabase client
// Replace these with your actual Supabase URL and key
const supabaseUrl = "https://nrxqcfdbyscqgrdrqegu.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yeHFjZmRieXNjcWdyZHJxZWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMzQzNTIsImV4cCI6MjA2NzYxMDM1Mn0.TR9RdSYoaKwryNAJRlD6rhas4ri3liqT4p2-yvE6Vtg";

// Check if environment variables are set
if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials!');
  console.error('Please set the following environment variables:');
  console.error('SUPABASE_URL=your_supabase_project_url');
  console.error('SUPABASE_ANON_KEY=your_supabase_anon_key');
  console.error('');
  console.error('Example:');
  console.error('SUPABASE_URL=https://your-project-id.supabase.co');
  console.error('SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// JWT Secret - In production, use environment variable
const JWT_SECRET = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yeHFjZmRieXNjcWdyZHJxZWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAzNDM1MiwiZXhwIjoyMDY3NjEwMzUyfQ.bEFQLDvIeX0rfM_zfrMM1mTVFMFc8_wuSy28R1g3qBg";

// Check if JWT secret is set
if (!JWT_SECRET) {
  console.error('❌ Missing JWT secret!');
  console.error('Please set the JWT_SECRET environment variable:');
  console.error('JWT_SECRET=your-secure-jwt-secret-key');
  console.error('');
  console.error('Example:');
  console.error('JWT_SECRET=my-super-secret-jwt-key-change-this-in-production');
  process.exit(1);
}

// Helper function to generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { 
      id: user.id, 
      email: user.email, 
      role: user.role,
      name: user.name 
    }, 
    JWT_SECRET, 
    { expiresIn: '24h' }
  );
};

// Helper function to hash password
const hashPassword = async (password) => {
  const saltRounds = 12;
  return await bcrypt.hash(password, saltRounds);
};

// Helper function to compare password
const comparePassword = async (password, hashedPassword) => {
  return await bcrypt.compare(password, hashedPassword);
};

// Register User (General User)
router.post('/signup/user', async (req, res) => {
  try {
    const { name, email, phone, password, aadhar_number, address, date_of_birth, gender } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password || !aadhar_number || !address || !date_of_birth || !gender) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email format' 
      });
    }

    // Validate phone number (10 digits)
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number must be 10 digits' 
      });
    }

    // Validate Aadhar number (12 digits)
    if (!/^\d{12}$/.test(aadhar_number)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Aadhar number must be 12 digits' 
      });
    }

    // Check if email already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users_table')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already registered' 
      });
    }

    // Check if Aadhar number already exists
    const { data: existingAadhar, error: aadharError } = await supabase
      .from('users_table')
      .select('aadhar_number')
      .eq('aadhar_number', aadhar_number)
      .single();

    if (existingAadhar) {
      return res.status(400).json({ 
        success: false, 
        message: 'Aadhar number already registered' 
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Insert user into database
    const { data: newUser, error: insertError } = await supabase
      .from('users_table')
      .insert([
        {
          name,
          email,
          phone,
          password_hash: hashedPassword,
          aadhar_number,
          address,
          date_of_birth,
          gender
        }
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Database error:', insertError);
      return res.status(500).json({ 
        success: false, 
        message: 'Error creating user account' 
      });
    }

    // Generate JWT token
    const token = generateToken({ 
      id: newUser.user_id, 
      email: newUser.email, 
      role: 'user',
      name: newUser.name 
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: newUser.user_id,
          name: newUser.name,
          email: newUser.email,
          role: 'user'
        },
        token
      }
    });

  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Register Police Officer
router.post('/signup/police', async (req, res) => {
  try {
    const { name, email, phone, password, badge_number, station_name, jurisdiction_area, rank } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password || !badge_number || !station_name || !jurisdiction_area || !rank) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email format' 
      });
    }

    // Validate phone number (10 digits)
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number must be 10 digits' 
      });
    }

    // Check if email already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('police_table')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already registered' 
      });
    }

    // Check if badge number already exists
    const { data: existingBadge, error: badgeError } = await supabase
      .from('police_table')
      .select('badge_number')
      .eq('badge_number', badge_number)
      .single();

    if (existingBadge) {
      return res.status(400).json({ 
        success: false, 
        message: 'Badge number already registered' 
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Insert police officer into database
    const { data: newPolice, error: insertError } = await supabase
      .from('police_table')
      .insert([
        {
          name,
          email,
          phone,
          password_hash: hashedPassword,
          badge_number,
          station_name,
          jurisdiction_area,
          rank,
          verified: false
        }
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Database error:', insertError);
      return res.status(500).json({ 
        success: false, 
        message: 'Error creating police account' 
      });
    }

    // Generate JWT token
    const token = generateToken({ 
      id: newPolice.officer_id, 
      email: newPolice.email, 
      role: 'police',
      name: newPolice.name 
    });

    res.status(201).json({
      success: true,
      message: 'Police officer registered successfully',
      data: {
        user: {
          id: newPolice.officer_id,
          name: newPolice.name,
          email: newPolice.email,
          role: 'police',
          verified: newPolice.verified
        },
        token
      }
    });

  } catch (error) {
    console.error('Police signup error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Register Doctor
router.post('/signup/doctor', async (req, res) => {
  try {
    const { name, email, phone, password, specialization, license_number, hospital_name, location } = req.body;

    // Validate required fields
    if (!name || !email || !phone || !password || !specialization || !license_number || !hospital_name || !location) {
      return res.status(400).json({ 
        success: false, 
        message: 'All fields are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email format' 
      });
    }

    // Validate phone number (10 digits)
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Phone number must be 10 digits' 
      });
    }

    // Check if email already exists
    const { data: existingUser, error: checkError } = await supabase
      .from('doctors_table')
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email already registered' 
      });
    }

    // Check if license number already exists
    const { data: existingLicense, error: licenseError } = await supabase
      .from('doctors_table')
      .select('license_number')
      .eq('license_number', license_number)
      .single();

    if (existingLicense) {
      return res.status(400).json({ 
        success: false, 
        message: 'License number already registered' 
      });
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Insert doctor into database
    const { data: newDoctor, error: insertError } = await supabase
      .from('doctors_table')
      .insert([
        {
          name,
          email,
          phone,
          password_hash: hashedPassword,
          specialization,
          license_number,
          hospital_name,
          location,
          verified: false
        }
      ])
      .select()
      .single();

    if (insertError) {
      console.error('Database error:', insertError);
      return res.status(500).json({ 
        success: false, 
        message: 'Error creating doctor account' 
      });
    }

    // Generate JWT token
    const token = generateToken({ 
      id: newDoctor.doctor_id, 
      email: newDoctor.email, 
      role: 'doctor',
      name: newDoctor.name 
    });

    res.status(201).json({
      success: true,
      message: 'Doctor registered successfully',
      data: {
        user: {
          id: newDoctor.doctor_id,
          name: newDoctor.name,
          email: newDoctor.email,
          role: 'doctor',
          verified: newDoctor.verified
        },
        token
      }
    });

  } catch (error) {
    console.error('Doctor signup error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { email, password, role } = req.body;

    // Validate required fields
    if (!email || !password || !role) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email, password, and role are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid email format' 
      });
    }

    let user = null;
    let tableName = '';

    // Check user based on role
    switch (role) {
      case 'user':
        tableName = 'users_table';
        const { data: userData, error: userError } = await supabase
          .from('users_table')
          .select('*')
          .eq('email', email)
          .single();
        user = userData;
        break;

      case 'police':
        tableName = 'police_table';
        const { data: policeData, error: policeError } = await supabase
          .from('police_table')
          .select('*')
          .eq('email', email)
          .single();
        user = policeData;
        break;

      case 'doctor':
        tableName = 'doctors_table';
        const { data: doctorData, error: doctorError } = await supabase
          .from('doctors_table')
          .select('*')
          .eq('email', email)
          .single();
        user = doctorData;
        break;

      default:
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid role specified' 
        });
    }

    // Check if user exists
    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);
    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid email or password' 
      });
    }

    // Generate JWT token
    let userId;
    if (role === 'user') userId = user.user_id;
    if (role === 'police') userId = user.officer_id;
    if (role === 'doctor') userId = user.doctor_id;
    const token = generateToken({ 
      id: userId, 
      email: user.email, 
      role,
      name: user.name 
    });

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: userId,
          name: user.name,
          email: user.email,
          role,
          verified: user.verified || true // Users are verified by default
        },
        token
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Verify token middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};

// Get user profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const { id, role } = req.user;

    let user = null;
    let tableName = '';

    switch (role) {
      case 'user':
        tableName = 'users_table';
        const { data: userData, error: userError } = await supabase
          .from('users_table')
          .select('*')
          .eq('user_id', id)
          .single();
        user = userData;
        break;

      case 'police':
        tableName = 'police_table';
        const { data: policeData, error: policeError } = await supabase
          .from('police_table')
          .select('*')
          .eq('officer_id', id)
          .single();
        user = policeData;
        break;

      case 'doctor':
        tableName = 'doctors_table';
        const { data: doctorData, error: doctorError } = await supabase
          .from('doctors_table')
          .select('*')
          .eq('doctor_id', id)
          .single();
        user = doctorData;
        break;
    }

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    // Remove sensitive data
    delete user.password_hash;

    res.status(200).json({
      success: true,
      data: {
        user: {
          ...user,
          role
        }
      }
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Update user profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const { id, role } = req.user;
    const updateData = req.body;

    // Remove sensitive fields that shouldn't be updated
    delete updateData.password_hash;
    delete updateData.email; // Email shouldn't be changed via this endpoint
    delete updateData.id;
    delete updateData.user_id;
    delete updateData.officer_id;
    delete updateData.doctor_id;

    let tableName = '';
    let idField = '';

    switch (role) {
      case 'user':
        tableName = 'users_table';
        idField = 'user_id';
        break;
      case 'police':
        tableName = 'police_table';
        idField = 'officer_id';
        break;
      case 'doctor':
        tableName = 'doctors_table';
        idField = 'doctor_id';
        break;
    }

    const { data: updatedUser, error: updateError } = await supabase
      .from(tableName)
      .update(updateData)
      .eq(idField, id)
      .select()
      .single();

    if (updateError) {
      console.error('Update error:', updateError);
      return res.status(500).json({ 
        success: false, 
        message: 'Error updating profile' 
      });
    }

    // Remove sensitive data
    delete updatedUser.password_hash;

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          ...updatedUser,
          role
        }
      }
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

module.exports = router;
