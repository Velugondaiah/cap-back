# Backend Setup Guide

## Environment Variables

Create a `.env` file in the backend directory with the following variables:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key_here

# JWT Configuration
JWT_SECRET=your-super-secure-jwt-secret-key-change-this-in-production

# Server Configuration
PORT=5000
NODE_ENV=development
```

## Getting Supabase Credentials

1. **Create a Supabase Project:**
   - Go to [supabase.com](https://supabase.com)
   - Sign up or log in
   - Create a new project

2. **Get Your Project URL:**
   - In your Supabase dashboard, go to Settings → API
   - Copy the "Project URL" (starts with `https://`)

3. **Get Your Anon Key:**
   - In the same API settings page
   - Copy the "anon public" key (starts with `eyJ`)

4. **Update your .env file:**
   ```env
   SUPABASE_URL=https://your-actual-project-id.supabase.co
   SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

## Database Tables

Make sure you have the following tables in your Supabase database:

### users_table
```sql
CREATE TABLE users_table (
  user_id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(15) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  aadhar_number VARCHAR(12) UNIQUE NOT NULL,
  address TEXT NOT NULL,
  date_of_birth DATE NOT NULL,
  gender VARCHAR(10) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### police_table
```sql
CREATE TABLE police_table (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(15) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  badge_number VARCHAR(50) UNIQUE NOT NULL,
  station_name VARCHAR(255) NOT NULL,
  jurisdiction_area VARCHAR(255) NOT NULL,
  rank VARCHAR(50) NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### doctors_table
```sql
CREATE TABLE doctors_table (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  phone VARCHAR(15) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  specialization VARCHAR(255) NOT NULL,
  license_number VARCHAR(100) UNIQUE NOT NULL,
  hospital_name VARCHAR(255) NOT NULL,
  location VARCHAR(255) NOT NULL,
  verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);
```

## Installation & Running

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Create .env file** with your credentials

3. **Start the server:**
   ```bash
   npm start
   ```

The server will run on `http://localhost:5000`

## API Endpoints

- `POST /api/auth/signup/user` - Register general user
- `POST /api/auth/signup/police` - Register police officer  
- `POST /api/auth/signup/doctor` - Register doctor
- `POST /api/auth/login` - Login for all user types
- `GET /api/auth/profile` - Get user profile (requires token)
- `PUT /api/auth/profile` - Update user profile (requires token)

## Security Notes

- Never commit your `.env` file to version control
- Use a strong, random JWT secret in production
- Consider using environment-specific Supabase projects
- Implement rate limiting for production use 