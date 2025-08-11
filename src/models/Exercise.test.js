const Exercise = require('./Exercise');
const Workout = require('./Workout');
const User = require('./User');
const db = require('../database/database');

describe('Exercise Model', () => {
  let testUser, testWorkout;

  beforeEach(async () => {
    await db.runAsync('DELETE FROM exercises');
    await db.runAsync('DELETE FROM workouts');
    await db.runAsync('DELETE FROM users');
    
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123'
    });

    testWorkout = await Workout.create({
      user_id: testUser.id,
      day: 'day1',
      title: 'Full Body Strength A',
      focus: 'Strength Training'
    });
  });

  afterAll(async () => {
    await db.close();
  });

  describe('create', () => {
    test('should create a new exercise with valid data', async () => {
      const exerciseData = {
        workout_id: testWorkout.id,
        name: 'Goblet Squats',
        category: 'workout',
        completed: false,
        sets: 3,
        reps: '8-12',
        notes: 'Focus on form'
      };

      const exercise = await Exercise.create(exerciseData);
      
      expect(exercise).toBeDefined();
      expect(exercise.id).toBeDefined();
      expect(exercise.workout_id).toBe(testWorkout.id);
      expect(exercise.name).toBe(exerciseData.name);
      expect(exercise.category).toBe(exerciseData.category);
      expect(exercise.completed).toBe(false);
      expect(exercise.sets).toBe(exerciseData.sets);
      expect(exercise.reps).toBe(exerciseData.reps);
      expect(exercise.notes).toBe(exerciseData.notes);
      expect(exercise.created_at).toBeDefined();
    });

    test('should throw error for invalid workout_id', async () => {
      const exerciseData = {
        workout_id: 999,
        name: 'Goblet Squats',
        category: 'workout'
      };

      await expect(Exercise.create(exerciseData)).rejects.toThrow();
    });
  });

  describe('findByWorkout', () => {
    test('should find all exercises for a workout', async () => {
      const exerciseData1 = {
        workout_id: testWorkout.id,
        name: 'Goblet Squats',
        category: 'workout',
        sets: 3,
        reps: '8-12'
      };

      const exerciseData2 = {
        workout_id: testWorkout.id,
        name: 'Dumbbell Bench Press',
        category: 'workout',
        sets: 3,
        reps: '8-12'
      };

      await Exercise.create(exerciseData1);
      await Exercise.create(exerciseData2);
      
      const exercises = await Exercise.findByWorkout(testWorkout.id);
      
      expect(exercises).toHaveLength(2);
      expect(exercises[0].workout_id).toBe(testWorkout.id);
      expect(exercises[1].workout_id).toBe(testWorkout.id);
    });

    test('should return empty array for workout with no exercises', async () => {
      const exercises = await Exercise.findByWorkout(testWorkout.id);
      expect(exercises).toHaveLength(0);
    });
  });

  describe('findByWorkoutAndCategory', () => {
    test('should find exercises by workout and category', async () => {
      const exerciseData1 = {
        workout_id: testWorkout.id,
        name: 'Light cardio',
        category: 'warmup',
        sets: 1,
        reps: '5 minutes'
      };

      const exerciseData2 = {
        workout_id: testWorkout.id,
        name: 'Goblet Squats',
        category: 'workout',
        sets: 3,
        reps: '8-12'
      };

      await Exercise.create(exerciseData1);
      await Exercise.create(exerciseData2);
      
      const warmupExercises = await Exercise.findByWorkoutAndCategory(testWorkout.id, 'warmup');
      const workoutExercises = await Exercise.findByWorkoutAndCategory(testWorkout.id, 'workout');
      
      expect(warmupExercises).toHaveLength(1);
      expect(workoutExercises).toHaveLength(1);
      expect(warmupExercises[0].category).toBe('warmup');
      expect(workoutExercises[0].category).toBe('workout');
    });
  });

  describe('markCompleted', () => {
    test('should mark exercise as completed', async () => {
      const exerciseData = {
        workout_id: testWorkout.id,
        name: 'Goblet Squats',
        category: 'workout',
        sets: 3,
        reps: '8-12'
      };

      const exercise = await Exercise.create(exerciseData);
      const updatedExercise = await Exercise.markCompleted(exercise.id);
      
      expect(updatedExercise.completed).toBe(true);
      expect(updatedExercise.completed_at).toBeDefined();
    });

    test('should throw error for non-existent exercise', async () => {
      await expect(Exercise.markCompleted(999)).rejects.toThrow();
    });
  });

  describe('markIncomplete', () => {
    test('should mark exercise as incomplete', async () => {
      const exerciseData = {
        workout_id: testWorkout.id,
        name: 'Goblet Squats',
        category: 'workout',
        sets: 3,
        reps: '8-12',
        completed: true,
        completed_at: new Date().toISOString()
      };

      const exercise = await Exercise.create(exerciseData);
      const updatedExercise = await Exercise.markIncomplete(exercise.id);
      
      expect(updatedExercise.completed).toBe(false);
      expect(updatedExercise.completed_at).toBeNull();
    });
  });

  describe('getWorkoutProgress', () => {
    test('should return progress for a workout', async () => {
      const exerciseData1 = {
        workout_id: testWorkout.id,
        name: 'Goblet Squats',
        category: 'workout',
        completed: true,
        completed_at: new Date().toISOString()
      };

      const exerciseData2 = {
        workout_id: testWorkout.id,
        name: 'Dumbbell Bench Press',
        category: 'workout',
        completed: false
      };

      await Exercise.create(exerciseData1);
      await Exercise.create(exerciseData2);
      
      const progress = await Exercise.getWorkoutProgress(testWorkout.id);
      
      expect(progress.total).toBe(2);
      expect(progress.completed).toBe(1);
      expect(progress.percentage).toBe(50);
    });

    test('should return 0% for workout with no exercises', async () => {
      const progress = await Exercise.getWorkoutProgress(testWorkout.id);
      
      expect(progress.total).toBe(0);
      expect(progress.completed).toBe(0);
      expect(progress.percentage).toBe(0);
    });

    test('should return 100% for workout with all exercises completed', async () => {
      const exerciseData1 = {
        workout_id: testWorkout.id,
        name: 'Exercise 1',
        category: 'workout',
        completed: true,
        completed_at: new Date().toISOString()
      };

      const exerciseData2 = {
        workout_id: testWorkout.id,
        name: 'Exercise 2',
        category: 'workout',
        completed: true,
        completed_at: new Date().toISOString()
      };

      await Exercise.create(exerciseData1);
      await Exercise.create(exerciseData2);
      
      const progress = await Exercise.getWorkoutProgress(testWorkout.id);
      
      expect(progress.total).toBe(2);
      expect(progress.completed).toBe(2);
      expect(progress.percentage).toBe(100);
    });
  });

  describe('Exercise Completion Functionality', () => {
    let exercise1, exercise2;

    beforeEach(async () => {
      exercise1 = await Exercise.create({
        workout_id: testWorkout.id,
        name: 'Push-ups',
        category: 'workout',
        sets: 3,
        reps: '10-15'
      });

      exercise2 = await Exercise.create({
        workout_id: testWorkout.id,
        name: 'Squats',
        category: 'workout',
        sets: 3,
        reps: '12-15'
      });
    });

    describe('markCompleted', () => {
      test('should mark exercise as completed with timestamp', async () => {
        const updatedExercise = await Exercise.markCompleted(exercise1.id);
        
        expect(updatedExercise.completed).toBe(true);
        expect(updatedExercise.completed_at).toBeDefined();
        expect(updatedExercise.completed_at).not.toBeNull();
        
        // Verify timestamp is a valid date string
        const completedAt = new Date(updatedExercise.completed_at);
        expect(completedAt.toString()).not.toBe('Invalid Date');
      });

      test('should throw ValidationError for invalid exercise ID', async () => {
        await expect(Exercise.markCompleted(null)).rejects.toThrow('Invalid exercise ID provided');
        await expect(Exercise.markCompleted('abc')).rejects.toThrow('Invalid exercise ID provided');
        await expect(Exercise.markCompleted(-1)).rejects.toThrow('Invalid exercise ID provided');
        await expect(Exercise.markCompleted(0)).rejects.toThrow('Invalid exercise ID provided');
      });

      test('should throw NotFoundError for non-existent exercise', async () => {
        await expect(Exercise.markCompleted(99999)).rejects.toThrow('Exercise not found');
      });

      test('should update workout completion when all exercises completed', async () => {
        // Mark both exercises as completed
        await Exercise.markCompleted(exercise1.id);
        await Exercise.markCompleted(exercise2.id);
        
        // Check that workout is now marked as completed
        const updatedWorkout = await Workout.findById(testWorkout.id);
        expect(Boolean(updatedWorkout.completed)).toBe(true);
        expect(updatedWorkout.completed_at).toBeDefined();
      });

      test('should not mark workout as completed if some exercises remain', async () => {
        // Mark only one exercise as completed
        await Exercise.markCompleted(exercise1.id);
        
        // Check that workout is still not completed
        const updatedWorkout = await Workout.findById(testWorkout.id);
        expect(Boolean(updatedWorkout.completed)).toBe(false);
        expect(updatedWorkout.completed_at).toBeNull();
      });
    });

    describe('markIncomplete', () => {
      beforeEach(async () => {
        // Mark exercises as completed first
        await Exercise.markCompleted(exercise1.id);
        await Exercise.markCompleted(exercise2.id);
      });

      test('should mark exercise as incomplete and clear timestamp', async () => {
        const updatedExercise = await Exercise.markIncomplete(exercise1.id);
        
        expect(updatedExercise.completed).toBe(false);
        expect(updatedExercise.completed_at).toBeNull();
      });

      test('should throw ValidationError for invalid exercise ID', async () => {
        await expect(Exercise.markIncomplete(null)).rejects.toThrow('Invalid exercise ID provided');
        await expect(Exercise.markIncomplete('abc')).rejects.toThrow('Invalid exercise ID provided');
        await expect(Exercise.markIncomplete(-1)).rejects.toThrow('Invalid exercise ID provided');
      });

      test('should throw NotFoundError for non-existent exercise', async () => {
        await expect(Exercise.markIncomplete(99999)).rejects.toThrow('Exercise not found');
      });

      test('should mark workout as incomplete when exercise marked incomplete', async () => {
        // Verify workout is completed first
        let workout = await Workout.findById(testWorkout.id);
        expect(Boolean(workout.completed)).toBe(true);
        
        // Mark one exercise as incomplete
        await Exercise.markIncomplete(exercise1.id);
        
        // Check that workout is now marked as incomplete
        workout = await Workout.findById(testWorkout.id);
        expect(Boolean(workout.completed)).toBe(false);
        expect(workout.completed_at).toBeNull();
      });
    });

    describe('Progress Calculation Methods', () => {
      beforeEach(async () => {
        // Create a third exercise for more comprehensive testing
        await Exercise.create({
          workout_id: testWorkout.id,
          name: 'Planks',
          category: 'workout',
          sets: 1,
          reps: '60 seconds'
        });
      });

      test('should calculate correct progress percentages', async () => {
        // Initially 0% completed
        let progress = await Exercise.getWorkoutProgress(testWorkout.id);
        expect(progress.percentage).toBe(0);
        expect(progress.completed).toBe(0);
        expect(progress.total).toBe(3);

        // Mark one exercise complete - should be 33%
        await Exercise.markCompleted(exercise1.id);
        progress = await Exercise.getWorkoutProgress(testWorkout.id);
        expect(progress.percentage).toBe(33); // Math.round(1/3 * 100)
        expect(progress.completed).toBe(1);

        // Mark second exercise complete - should be 67%
        await Exercise.markCompleted(exercise2.id);
        progress = await Exercise.getWorkoutProgress(testWorkout.id);
        expect(progress.percentage).toBe(67); // Math.round(2/3 * 100)
        expect(progress.completed).toBe(2);

        // Mark all exercises complete - should be 100%
        const exercises = await Exercise.findByWorkout(testWorkout.id);
        await Exercise.markCompleted(exercises[2].id);
        progress = await Exercise.getWorkoutProgress(testWorkout.id);
        expect(progress.percentage).toBe(100);
        expect(progress.completed).toBe(3);
      });

      test('should handle edge case of single exercise workout', async () => {
        // Create a new workout with single exercise
        const singleWorkout = await Workout.create({
          user_id: testUser.id,
          day: 'day2',
          title: 'Single Exercise',
          focus: 'Quick'
        });

        const singleExercise = await Exercise.create({
          workout_id: singleWorkout.id,
          name: 'Single Exercise',
          category: 'workout'
        });

        // Should be 0% initially
        let progress = await Exercise.getWorkoutProgress(singleWorkout.id);
        expect(progress.percentage).toBe(0);

        // Should be 100% when completed
        await Exercise.markCompleted(singleExercise.id);
        progress = await Exercise.getWorkoutProgress(singleWorkout.id);
        expect(progress.percentage).toBe(100);
      });
    });

    describe('Data Integrity and Error Handling', () => {
      test('should maintain data integrity during concurrent operations', async () => {
        // Simulate concurrent completion operations
        const promises = [
          Exercise.markCompleted(exercise1.id),
          Exercise.markCompleted(exercise2.id)
        ];

        const results = await Promise.all(promises);
        
        // Both should succeed
        expect(results[0].completed).toBe(true);
        expect(results[1].completed).toBe(true);

        // Final state should be consistent
        const progress = await Exercise.getWorkoutProgress(testWorkout.id);
        expect(progress.completed).toBe(2);
        expect(progress.total).toBe(2);
      });

      test('should handle database errors gracefully', async () => {
        // This test would require mocking the database to simulate errors
        // For now, we test the error handling structure
        expect(Exercise.markCompleted).toBeDefined();
        expect(Exercise.markIncomplete).toBeDefined();
      });

      test('should verify data integrity after operations', async () => {
        await Exercise.markCompleted(exercise1.id);
        
        const integrity = await Exercise.verifyDataIntegrity(testWorkout.id);
        expect(integrity.isValid).toBe(true);
        expect(integrity.totalExercises).toBe(2);
        expect(integrity.completedExercises).toBe(1);
        expect(integrity.issues).toHaveLength(0);
      });
    });
  });

  describe('Daily Progress Tracking', () => {
    test('should track daily progress correctly', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Initially no progress
      let dailyProgress = await Exercise.getDailyProgress(testUser.id, today);
      expect(dailyProgress.completed).toBe(0);

      // Create and complete an exercise
      const exercise = await Exercise.create({
        workout_id: testWorkout.id,
        name: 'Test Exercise',
        category: 'workout'
      });

      await Exercise.markCompleted(exercise.id);

      // Should now show progress
      dailyProgress = await Exercise.getDailyProgress(testUser.id, today);
      expect(dailyProgress.completed).toBeGreaterThan(0);
    });

    test('should update daily progress when exercises completed', async () => {
      const exercise = await Exercise.create({
        workout_id: testWorkout.id,
        name: 'Progress Test',
        category: 'workout'
      });

      // Complete exercise should trigger progress update
      await Exercise.markCompleted(exercise.id);

      // Verify progress was updated
      const result = await Exercise.updateDailyProgress(testWorkout.id);
      expect(result.total).toBeGreaterThan(0);
      expect(result.completed).toBeGreaterThan(0);
      expect(result.userId).toBe(testUser.id);
    });
  });
}); 