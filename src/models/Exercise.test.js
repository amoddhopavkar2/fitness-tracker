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
  });
}); 