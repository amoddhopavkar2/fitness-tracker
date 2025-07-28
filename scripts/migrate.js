const db = require('../src/database/database');

async function migrate() {
    console.log('🔄 Starting database migration...');
    
    try {
        // Create tables
        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ Users table created');

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS workouts (
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
            )
        `);
        console.log('✅ Workouts table created');

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS exercises (
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
            )
        `);
        console.log('✅ Exercises table created');

        await db.runAsync(`
            CREATE TABLE IF NOT EXISTS progress (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                date DATE NOT NULL,
                total_exercises INTEGER DEFAULT 0,
                completed_exercises INTEGER DEFAULT 0,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
                UNIQUE(user_id, date)
            )
        `);
        console.log('✅ Progress table created');

        // Create indexes for better performance
        await db.runAsync('CREATE INDEX IF NOT EXISTS idx_workouts_user_id ON workouts(user_id)');
        await db.runAsync('CREATE INDEX IF NOT EXISTS idx_workouts_day ON workouts(day)');
        await db.runAsync('CREATE INDEX IF NOT EXISTS idx_exercises_workout_id ON exercises(workout_id)');
        await db.runAsync('CREATE INDEX IF NOT EXISTS idx_exercises_category ON exercises(category)');
        await db.runAsync('CREATE INDEX IF NOT EXISTS idx_progress_user_date ON progress(user_id, date)');
        
        console.log('✅ Database indexes created');
        console.log('🎉 Database migration completed successfully!');
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    } finally {
        await db.close();
    }
}

migrate(); 