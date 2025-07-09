# Authentication Backend

A comprehensive authentication backend built with Express.js and Supabase, supporting multiple user types including General Users, Police Officers, and Doctors.

## Features

### 🔐 Multi-Role Authentication
- **General Users**: Complete profile with Aadhar number, address, date of birth, and gender
- **Police Officers**: Badge number, station name, jurisdiction area, and rank
- **Doctors**: Specialization, license number, hospital name, and location

### 🔒 Security Features
- **Password Hashing**: Using bcryptjs with 12 salt rounds
- **JWT Tokens**: Secure token-based authentication
- **Input Validation**: Comprehensive validation for all fields
- **Duplicate Prevention**: Checks for existing emails and unique identifiers
- **CORS Support**: Configured for frontend integration

### 📊 Database Integration
- **Supabase Integration**: Real-time database with PostgreSQL
- **Multiple Tables**: Separate tables for different user types
- **Data Validation**: Server-side validation for all inputs
- **Error Handling**: Comprehensive error handling and logging

## Setup Instructions

### Prerequisites
- Node.js (version 14 or higher)
- npm or yarn
- Supabase account and project

### Installation

1. **Install Dependencies**
   ```bash
   cd backend
   npm install
   ```

2. **Environment Configuration**
   Create a `.env` file in the backend directory:
   ```env
   # Supabase Configuration
   SUPABASE_URL=your_supabase_project_url_here
   SUPABASE_ANON_KEY=your_supabase_anon_key_here
   
   # JWT Configuration
   JWT_SECRET=your_jwt_secret_key_here_change_in_production
   
   # Server Configuration
   PORT=5000
   NODE_ENV=development
   ```

3. **Start the Server**
   ```bash
   # Development mode with auto-reload
   npm run dev
   
   # Production mode
   npm start
   ```

## API Endpoints

### Authentication Endpoints

#### Register General User
```http
POST /api/auth/signup/user
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "securepassword123",
  "aadhar_number": "123456789012",
  "address": "123 Main Street, City, State",
  "date_of_birth": "1990-01-01",
  "gender": "male"
}
```

#### Register Police Officer
```http
POST /api/auth/signup/police
Content-Type: application/json

{
  "name": "Inspector Ravi Kumar",
  "email": "ravi.kumar@police.in",
  "phone": "8899776655",
  "password": "securepassword123",
  "badge_number": "BADGE101",
  "station_name": "Ashok Nagar PS",
  "jurisdiction_area": "Chennai Central",
  "rank": "Inspector"
}
```

#### Register Doctor
```http
POST /api/auth/signup/doctor
Content-Type: application/json

{
  "name": "Dr. Arvind Rao",
  "email": "arvind.rao@example.com",
  "phone": "9876543210",
  "password": "securepassword123",
  "specialization": "Cardiologist",
  "license_number": "LIC12345",
  "hospital_name": "Apollo Hospitals",
  "location": "Chennai"
}
```

#### Login (All User Types)
```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword123",
  "role": "user"
}
```

### Protected Endpoints

#### Get User Profile
```http
GET /api/auth/profile
Authorization: Bearer <jwt_token>
```

#### Update User Profile
```http
PUT /api/auth/profile
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "name": "Updated Name",
  "phone": "9876543210"
}
```

### Health Check
```http
GET /api/health
```

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    "user": {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com",
      "role": "user",
      "verified": true
    },
    "token": "jwt_token_here"
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error description"
}
```

## Database Schema

### Users Table
```sql
CREATE TABLE users_table (
  user_id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(15),
  password_hash TEXT NOT NULL,
  aadhar_number VARCHAR(20) UNIQUE,
  address TEXT,
  date_of_birth DATE,
  gender VARCHAR(10),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Police Table
```sql
CREATE TABLE police_table (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(15),
  password_hash TEXT NOT NULL,
  badge_number VARCHAR(50) UNIQUE,
  station_name VARCHAR(100),
  jurisdiction_area VARCHAR(100),
  rank VARCHAR(50),
  verified BOOLEAN DEFAULT FALSE
);
```

### Doctors Table
```sql
CREATE TABLE doctors_table (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) UNIQUE NOT NULL,
  phone VARCHAR(15),
  password_hash TEXT NOT NULL,
  specialization VARCHAR(100),
  license_number VARCHAR(50) UNIQUE,
  hospital_name VARCHAR(100),
  location VARCHAR(100),
  verified BOOLEAN DEFAULT FALSE
);
```

## Security Features

### Password Security
- **Hashing**: Passwords are hashed using bcryptjs with 12 salt rounds
- **Validation**: Minimum 6 characters required
- **Comparison**: Secure password comparison using bcrypt

### JWT Security
- **Token Expiration**: 24-hour token expiration
- **Secret Key**: Configurable JWT secret
- **Payload**: Includes user ID, email, role, and name

### Input Validation
- **Email Format**: Validates email format using regex
- **Phone Numbers**: Validates 10-digit phone numbers
- **Aadhar Numbers**: Validates 12-digit Aadhar numbers
- **Required Fields**: Validates all required fields are present

### Database Security
- **Duplicate Prevention**: Checks for existing emails and unique identifiers
- **Error Handling**: Comprehensive error handling for database operations
- **Data Sanitization**: Removes sensitive data from responses

## Error Handling

### Common Error Codes
- **400**: Bad Request (validation errors)
- **401**: Unauthorized (invalid credentials or missing token)
- **404**: Not Found (user not found)
- **500**: Internal Server Error

### Error Messages
- Clear, descriptive error messages
- No sensitive information in error responses
- Consistent error format across all endpoints

## Development

### Running in Development
```bash
npm run dev
```

### Environment Variables
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Your Supabase anonymous key
- `JWT_SECRET`: Secret key for JWT token generation
- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment (development/production)

### Logging
- Console logging for development
- Error logging for debugging
- Request/response logging

## Production Considerations

### Security
- Change JWT secret in production
- Use environment variables for all secrets
- Enable HTTPS in production
- Implement rate limiting
- Add request validation middleware

### Performance
- Implement caching for frequently accessed data
- Add database connection pooling
- Optimize database queries
- Add compression middleware

### Monitoring
- Add health check endpoints
- Implement logging service
- Add error tracking
- Monitor API performance

## Testing

### Manual Testing
Use tools like Postman or curl to test endpoints:

```bash
# Test health endpoint
curl http://localhost:5000/api/health

# Test user registration
curl -X POST http://localhost:5000/api/auth/signup/user \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","phone":"9876543210","password":"password123","aadhar_number":"123456789012","address":"Test Address","date_of_birth":"1990-01-01","gender":"male"}'
```

## Support

For issues and questions:
1. Check the error logs in the console
2. Verify environment variables are set correctly
3. Ensure Supabase tables are created with correct schema
4. Check network connectivity to Supabase

## License

MIT License - see LICENSE file for details. 