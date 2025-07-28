# Fitness Tracker - Full-Stack Application

A comprehensive fitness tracking application built with Node.js, Express, SQLite, and modern frontend technologies. This application follows Test-Driven Development (TDD) principles and includes authentication, database integration, and calendar functionality.

## 🚀 Features

### Core Features
- **User Authentication**: Secure registration and login with JWT tokens
- **Workout Management**: Complete workout plans with exercises, sets, and reps
- **Progress Tracking**: Real-time progress tracking with visual indicators
- **Calendar Integration**: Monthly calendar view with workout completion status
- **Streak Tracking**: Track consecutive workout days and longest streaks
- **Responsive Design**: Modern, mobile-friendly UI built with Tailwind CSS

### Technical Features
- **TDD Implementation**: Comprehensive test suite with Jest
- **Database Integration**: SQLite database with proper relationships
- **API-First Design**: RESTful API with proper error handling
- **Security**: Password hashing, JWT authentication, rate limiting
- **Real-time Updates**: Dynamic progress bars and status indicators

## 🛠️ Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **SQLite** - Database
- **JWT** - Authentication
- **bcryptjs** - Password hashing
- **Jest** - Testing framework
- **Supertest** - API testing

### Frontend
- **HTML5** - Structure
- **CSS3** - Styling (Tailwind CSS)
- **JavaScript (ES6+)** - Interactivity
- **Chart.js** - Data visualization
- **Responsive Design** - Mobile-first approach

## 📋 Prerequisites

- Node.js (v14 or higher)
- npm or yarn package manager

## 🚀 Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd fitness-tracker
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Set Up Environment Variables
Create a `.env` file in the root directory:
```env
NODE_ENV=development
PORT=3001
JWT_SECRET=your-secret-key-change-in-production
```

### 4. Initialize Database
```bash
# Run database migration
npm run db:migrate

# Seed the database with initial data
npm run db:seed
```

### 5. Start the Application
```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The application will be available at `http://localhost:3001`

---

## ⚡️ Frontend & Static Files
- All static files (HTML, JS, CSS) are served from the `/public` directory.
- **TailwindCSS** and **Chart.js** are loaded locally from `/public/js/` (not from a CDN) to avoid CSP issues.
- If you add new frontend libraries, place them in `/public/js/` and reference them with a relative path in your HTML.

---

## 🛡️ Content Security Policy (CSP) & Local JS
If you see browser errors about CSP or MIME type for JS libraries:
- Make sure the JS files exist in `/public/js/`.
- Reference them as `<script src="js/filename.js"></script>` in your HTML.
- Do **not** use CDN links for JS libraries unless you update your CSP accordingly.

---

## 📦 .gitignore
A `.gitignore` file is included and covers:
- `node_modules/`
- SQLite databases (e.g. `fitness_tracker.db`)
- log files
- environment files (`.env`)
- coverage reports
- OS-generated files (e.g. `.DS_Store`)

---

## 🧪 Testing

### Run All Tests
```bash
npm test
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Tests in CI Mode
```bash
npm run test:ci
```

## 📊 API Documentation

### Authentication Endpoints

#### POST `/api/auth/register`
Register a new user
```json
{
  "username": "testuser",
  "email": "test@example.com",
  "password": "password123"
}
```

#### POST `/api/auth/login`
Login user
```json
{
  "username": "testuser",
  "password": "password123"
}
```

#### GET `/api/auth/me`
Get current user profile (requires authentication)

### Workout Endpoints

#### GET `/api/workouts`
Get all workouts for current user

#### GET `/api/workouts/:day`
Get workout for specific day

#### POST `/api/workouts`
Create new workout
```json
{
  "day": "day1",
  "title": "Full Body Strength A",
  "focus": "Strength Training"
}
```

#### PATCH `/api/workouts/:id/complete`
Mark workout as completed

#### PATCH `/api/workouts/:id/incomplete`
Mark workout as incomplete

### Exercise Endpoints

#### GET `/api/exercises/workout/:workoutId`
Get all exercises for a workout

#### POST `/api/exercises`
Create new exercise
```json
{
  "workout_id": 1,
  "name": "Goblet Squats",
  "category": "workout",
  "sets": 3,
  "reps": "8-12"
}
```

#### PATCH `/api/exercises/:id/complete`
Mark exercise as completed

#### PATCH `/api/exercises/:id/incomplete`
Mark exercise as incomplete

### Progress Endpoints

#### GET `/api/progress/calendar/:year/:month`
Get calendar data for specific month

#### GET `/api/progress/streak`
Get streak information

#### GET `/api/progress/stats`
Get monthly statistics

## 🗄️ Database Schema

### Users Table
```sql
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### Workouts Table
```sql
CREATE TABLE workouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  day TEXT NOT NULL,
  title TEXT NOT NULL,
  focus TEXT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE(user_id, day)
);
```

### Exercises Table
```sql
CREATE TABLE exercises (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  workout_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  sets INTEGER,
  reps TEXT,
  notes TEXT,
  completed BOOLEAN DEFAULT FALSE,
  completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workout_id) REFERENCES workouts (id) ON DELETE CASCADE
);
```

### Progress Table
```sql
CREATE TABLE progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  date DATE NOT NULL,
  total_exercises INTEGER DEFAULT 0,
  completed_exercises INTEGER DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE(user_id, date)
);
```

## 🎯 TDD Implementation

The application follows Test-Driven Development principles:

### Test Structure
- **Unit Tests**: Individual model and function tests
- **Integration Tests**: API endpoint tests
- **Database Tests**: Data persistence and retrieval tests

### Test Coverage
- User authentication and management
- Workout creation and management
- Exercise tracking and completion
- Progress calculation and statistics
- Calendar functionality

### Running Tests
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test

# Generate coverage report
npm run test:coverage
```

## 🔧 Development

### Project Structure
```
fitness-tracker/
├── src/
│   ├── models/          # Database models
│   ├── routes/          # API routes
│   ├── middleware/      # Custom middleware
│   ├── database/        # Database configuration
│   └── controllers/     # Test files
├── public/              # Static files
│   ├── index.html       # Main HTML file
│   └── js/             # Frontend JavaScript
├── scripts/             # Database scripts
├── tests/               # Test files
└── coverage/            # Test coverage reports
```

### Adding New Features
1. Write tests first (TDD approach)
2. Implement the feature
3. Ensure all tests pass
4. Update documentation

## 🚀 Deployment

### Production Setup
1. Set environment variables for production
2. Use a production database (PostgreSQL recommended)
3. Set up proper logging and monitoring
4. Configure HTTPS and security headers

### Docker Deployment
```dockerfile
FROM node:16-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

## 📝 Default Test Account

After running the seed script, you can use these credentials:
- **Username**: testuser
- **Password**: password123
- **Email**: test@example.com

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for new features
4. Implement the feature
5. Ensure all tests pass
6. Submit a pull request

## 📄 License

This project is licensed under the MIT License.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the test files for examples

---

**Built with ❤️ following TDD principles** 