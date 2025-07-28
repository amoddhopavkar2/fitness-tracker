const db = require('../src/database/database');
const bcrypt = require('bcryptjs');

async function seed() {
    console.log('🌱 Starting database seeding...');
    
    try {
        // Create a test user
        const hashedPassword = await bcrypt.hash('password123', 10);
        const userResult = await db.runAsync(`
            INSERT INTO users (username, email, password)
            VALUES (?, ?, ?)
        `, ['testuser', 'test@example.com', hashedPassword]);
        
        const userId = userResult.lastID;
        console.log('✅ Test user created');

        // Create workouts for the week
        const workouts = [
            {
                day: 'day1',
                title: 'Full Body Strength A',
                focus: 'Strength Training',
                exercises: [
                    // Warm-up
                    { name: '5 minutes of light cardio (jogging, cycling)', category: 'warmup', sets: 1, reps: '5 minutes' },
                    { name: 'Arm circles (10 forward, 10 backward)', category: 'warmup', sets: 1, reps: '10 each direction' },
                    { name: 'Leg swings (10 per leg, each direction)', category: 'warmup', sets: 1, reps: '10 each' },
                    { name: 'Torso twists (10 per side)', category: 'warmup', sets: 1, reps: '10 each side' },
                    { name: 'Bodyweight squats (15 reps)', category: 'warmup', sets: 1, reps: '15 reps' },
                    // Workout
                    { name: 'Goblet Squats', category: 'workout', sets: 3, reps: '8-12 reps' },
                    { name: 'Dumbbell Bench Press', category: 'workout', sets: 3, reps: '8-12 reps' },
                    { name: 'Dumbbell Rows', category: 'workout', sets: 3, reps: '8-12 reps per arm' },
                    { name: 'Overhead Press (Dumbbell)', category: 'workout', sets: 3, reps: '8-12 reps' },
                    { name: 'Lunges', category: 'workout', sets: 3, reps: '10-12 reps per leg' },
                    { name: 'Plank', category: 'workout', sets: 3, reps: '30-60 seconds' },
                    // Cool-down
                    { name: 'Quad stretch (30s per leg)', category: 'cooldown', sets: 1, reps: '30s each' },
                    { name: 'Hamstring stretch (30s per leg)', category: 'cooldown', sets: 1, reps: '30s each' },
                    { name: 'Chest stretch (30s)', category: 'cooldown', sets: 1, reps: '30s' },
                    { name: 'Back stretch (Cat-Cow) (30s)', category: 'cooldown', sets: 1, reps: '30s' },
                    { name: 'Triceps stretch (30s per arm)', category: 'cooldown', sets: 1, reps: '30s each' }
                ]
            },
            {
                day: 'day2',
                title: 'Cardio & Core',
                focus: 'Cardiovascular Health & Core Strength',
                exercises: [
                    // Warm-up
                    { name: '5 minutes of brisk walking or light jogging', category: 'warmup', sets: 1, reps: '5 minutes' },
                    // Workout
                    { name: 'Steady-State Cardio (20-30 mins on treadmill, bike, or elliptical)', category: 'workout', sets: 1, reps: '20-30 minutes' },
                    { name: 'Crunches', category: 'workout', sets: 3, reps: '15-20 reps' },
                    { name: 'Bird-Dog', category: 'workout', sets: 3, reps: '10 reps per side' },
                    { name: 'Glute Bridges', category: 'workout', sets: 3, reps: '15-20 reps' },
                    // Cool-down
                    { name: 'Slow walking (3 mins)', category: 'cooldown', sets: 1, reps: '3 minutes' },
                    { name: 'Cobra stretch (30s)', category: 'cooldown', sets: 1, reps: '30s' },
                    { name: 'Child\'s pose (60s)', category: 'cooldown', sets: 1, reps: '60s' }
                ]
            },
            {
                day: 'day3',
                title: 'Full Body Strength B',
                focus: 'Strength Training',
                exercises: [
                    // Warm-up
                    { name: '5 minutes of light cardio (jogging, cycling)', category: 'warmup', sets: 1, reps: '5 minutes' },
                    { name: 'Arm circles (10 forward, 10 backward)', category: 'warmup', sets: 1, reps: '10 each direction' },
                    { name: 'Leg swings (10 per leg, each direction)', category: 'warmup', sets: 1, reps: '10 each' },
                    { name: 'Torso twists (10 per side)', category: 'warmup', sets: 1, reps: '10 each side' },
                    { name: 'Bodyweight squats (15 reps)', category: 'warmup', sets: 1, reps: '15 reps' },
                    // Workout
                    { name: 'Romanian Deadlifts (Dumbbell)', category: 'workout', sets: 3, reps: '10-15 reps' },
                    { name: 'Push-Ups (on knees if needed)', category: 'workout', sets: 3, reps: 'to failure' },
                    { name: 'Lat Pulldowns or Dumbbell Pullovers', category: 'workout', sets: 3, reps: '8-12 reps' },
                    { name: 'Dumbbell Bicep Curls', category: 'workout', sets: 3, reps: '10-15 reps per arm' },
                    { name: 'Tricep Dips (using a bench)', category: 'workout', sets: 3, reps: 'to failure' },
                    { name: 'Leg Raises', category: 'workout', sets: 3, reps: '15-20 reps' },
                    // Cool-down
                    { name: 'Quad stretch (30s per leg)', category: 'cooldown', sets: 1, reps: '30s each' },
                    { name: 'Hamstring stretch (30s per leg)', category: 'cooldown', sets: 1, reps: '30s each' },
                    { name: 'Chest stretch (30s)', category: 'cooldown', sets: 1, reps: '30s' },
                    { name: 'Back stretch (Cat-Cow) (30s)', category: 'cooldown', sets: 1, reps: '30s' },
                    { name: 'Triceps stretch (30s per arm)', category: 'cooldown', sets: 1, reps: '30s each' }
                ]
            },
            {
                day: 'day4',
                title: 'Active Recovery',
                focus: 'Rest & Mobility',
                exercises: [
                    { name: 'Go for a 20-30 minute walk', category: 'workout', sets: 1, reps: '20-30 minutes' },
                    { name: 'Do some light stretching or foam rolling', category: 'workout', sets: 1, reps: '10-15 minutes' },
                    { name: 'Consider gentle yoga or mobility work', category: 'workout', sets: 1, reps: '15-20 minutes' }
                ]
            },
            {
                day: 'day5',
                title: 'Full Body Strength A',
                focus: 'Strength Training',
                exercises: [
                    // Warm-up
                    { name: '5 minutes of light cardio (jogging, cycling)', category: 'warmup', sets: 1, reps: '5 minutes' },
                    { name: 'Arm circles (10 forward, 10 backward)', category: 'warmup', sets: 1, reps: '10 each direction' },
                    { name: 'Leg swings (10 per leg, each direction)', category: 'warmup', sets: 1, reps: '10 each' },
                    { name: 'Torso twists (10 per side)', category: 'warmup', sets: 1, reps: '10 each side' },
                    { name: 'Bodyweight squats (15 reps)', category: 'warmup', sets: 1, reps: '15 reps' },
                    // Workout
                    { name: 'Goblet Squats', category: 'workout', sets: 3, reps: '8-12 reps' },
                    { name: 'Dumbbell Bench Press', category: 'workout', sets: 3, reps: '8-12 reps' },
                    { name: 'Dumbbell Rows', category: 'workout', sets: 3, reps: '8-12 reps per arm' },
                    { name: 'Overhead Press (Dumbbell)', category: 'workout', sets: 3, reps: '8-12 reps' },
                    { name: 'Lunges', category: 'workout', sets: 3, reps: '10-12 reps per leg' },
                    { name: 'Plank', category: 'workout', sets: 3, reps: '30-60 seconds' },
                    // Cool-down
                    { name: 'Quad stretch (30s per leg)', category: 'cooldown', sets: 1, reps: '30s each' },
                    { name: 'Hamstring stretch (30s per leg)', category: 'cooldown', sets: 1, reps: '30s each' },
                    { name: 'Chest stretch (30s)', category: 'cooldown', sets: 1, reps: '30s' },
                    { name: 'Back stretch (Cat-Cow) (30s)', category: 'cooldown', sets: 1, reps: '30s' },
                    { name: 'Triceps stretch (30s per arm)', category: 'cooldown', sets: 1, reps: '30s each' }
                ]
            },
            {
                day: 'day6',
                title: 'Cardio & Core',
                focus: 'Cardiovascular Health & Core Strength',
                exercises: [
                    // Warm-up
                    { name: '5 minutes of brisk walking or light jogging', category: 'warmup', sets: 1, reps: '5 minutes' },
                    // Workout
                    { name: 'Steady-State Cardio (20-30 mins on treadmill, bike, or elliptical)', category: 'workout', sets: 1, reps: '20-30 minutes' },
                    { name: 'Crunches', category: 'workout', sets: 3, reps: '15-20 reps' },
                    { name: 'Bird-Dog', category: 'workout', sets: 3, reps: '10 reps per side' },
                    { name: 'Glute Bridges', category: 'workout', sets: 3, reps: '15-20 reps' },
                    // Cool-down
                    { name: 'Slow walking (3 mins)', category: 'cooldown', sets: 1, reps: '3 minutes' },
                    { name: 'Cobra stretch (30s)', category: 'cooldown', sets: 1, reps: '30s' },
                    { name: 'Child\'s pose (60s)', category: 'cooldown', sets: 1, reps: '60s' }
                ]
            },
            {
                day: 'day7',
                title: 'Rest Day',
                focus: 'Full Recovery',
                exercises: [
                    { name: 'Complete rest is essential for muscle repair and growth', category: 'workout', sets: 1, reps: 'Rest day' },
                    { name: 'Ensure you get quality sleep', category: 'workout', sets: 1, reps: '7-9 hours' },
                    { name: 'Focus on good nutrition and hydration', category: 'workout', sets: 1, reps: 'Throughout the day' }
                ]
            }
        ];

        // Insert workouts and exercises
        for (const workout of workouts) {
            const workoutResult = await db.runAsync(`
                INSERT INTO workouts (user_id, day, title, focus)
                VALUES (?, ?, ?, ?)
            `, [userId, workout.day, workout.title, workout.focus]);
            
            const workoutId = workoutResult.lastID;
            
            // Insert exercises for this workout
            for (const exercise of workout.exercises) {
                await db.runAsync(`
                    INSERT INTO exercises (workout_id, name, category, sets, reps)
                    VALUES (?, ?, ?, ?, ?)
                `, [workoutId, exercise.name, exercise.category, exercise.sets, exercise.reps]);
            }
        }
        
        console.log('✅ Workouts and exercises seeded');
        console.log('🎉 Database seeding completed successfully!');
        console.log('\n📝 Test Account:');
        console.log('Username: testuser');
        console.log('Password: password123');
        console.log('Email: test@example.com');
        
    } catch (error) {
        console.error('❌ Seeding failed:', error);
        process.exit(1);
    } finally {
        await db.close();
    }
}

seed(); 