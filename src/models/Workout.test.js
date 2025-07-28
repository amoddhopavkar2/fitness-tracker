const Workout = require('./Workout');
const User = require('./User');
const db = require('../database/database');

describe('Workout Model', () => {
  let testUser;

  beforeEach(async () => {
    await db.runAsync('DELETE FROM exercises');
    await db.runAsync('DELETE FROM workouts');
    await db.runAsync('DELETE FROM users');
    
    testUser = await User.create({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123'
    });
  });

  afterAll(async () => {
    await db.close();
  });

  describe('create', () => {
    test('should create a new workout with valid data', async () => {
      const workoutData = {
        user_id: testUser.id,
        day: 'day1',
        title: 'Full Body Strength A',
        focus: 'Strength Training',
        completed: false,
        completed_at: null
      };

      const workout = await Workout.create(workoutData);
      
      expect(workout).toBeDefined();
      expect(workout.id).toBeDefined();
      expect(workout.user_id).toBe(testUser.id);
      expect(workout.day).toBe(workoutData.day);
      expect(workout.title).toBe(workoutData.title);
      expect(workout.focus).toBe(workoutData.focus);
      expect(workout.completed).toBe(false);
      expect(workout.created_at).toBeDefined();
    });

    test('should throw error for invalid user_id', async () => {
      const workoutData = {
        user_id: 999,
        day: 'day1',
        title: 'Full Body Strength A',
        focus: 'Strength Training'
      };

      await expect(Workout.create(workoutData)).rejects.toThrow();
    });
  });

  describe('findByUserAndDay', () => {
    test('should find workout by user and day', async () => {
      const workoutData = {
        user_id: testUser.id,
        day: 'day1',
        title: 'Full Body Strength A',
        focus: 'Strength Training'
      };

      await Workout.create(workoutData);
      const workout = await Workout.findByUserAndDay(testUser.id, 'day1');
      
      expect(workout).toBeDefined();
      expect(workout.user_id).toBe(testUser.id);
      expect(workout.day).toBe('day1');
    });

    test('should return null for non-existent workout', async () => {
      const workout = await Workout.findByUserAndDay(testUser.id, 'day2');
      expect(workout).toBeNull();
    });
  });

  describe('findByUser', () => {
    test('should find all workouts for a user', async () => {
      const workoutData1 = {
        user_id: testUser.id,
        day: 'day1',
        title: 'Full Body Strength A',
        focus: 'Strength Training'
      };

      const workoutData2 = {
        user_id: testUser.id,
        day: 'day2',
        title: 'Cardio & Core',
        focus: 'Cardiovascular Health'
      };

      await Workout.create(workoutData1);
      await Workout.create(workoutData2);
      
      const workouts = await Workout.findByUser(testUser.id);
      
      expect(workouts).toHaveLength(2);
      expect(workouts[0].user_id).toBe(testUser.id);
      expect(workouts[1].user_id).toBe(testUser.id);
    });

    test('should return empty array for user with no workouts', async () => {
      const workouts = await Workout.findByUser(testUser.id);
      expect(workouts).toHaveLength(0);
    });
  });

  describe('markCompleted', () => {
    test('should mark workout as completed', async () => {
      const workoutData = {
        user_id: testUser.id,
        day: 'day1',
        title: 'Full Body Strength A',
        focus: 'Strength Training'
      };

      const workout = await Workout.create(workoutData);
      const updatedWorkout = await Workout.markCompleted(workout.id);
      
      expect(updatedWorkout.completed).toBe(true);
      expect(updatedWorkout.completed_at).toBeDefined();
    });

    test('should throw error for non-existent workout', async () => {
      await expect(Workout.markCompleted(999)).rejects.toThrow();
    });
  });

  describe('markIncomplete', () => {
    test('should mark workout as incomplete', async () => {
      const workoutData = {
        user_id: testUser.id,
        day: 'day1',
        title: 'Full Body Strength A',
        focus: 'Strength Training',
        completed: true,
        completed_at: new Date().toISOString()
      };

      const workout = await Workout.create(workoutData);
      const updatedWorkout = await Workout.markIncomplete(workout.id);
      
      expect(updatedWorkout.completed).toBe(false);
      expect(updatedWorkout.completed_at).toBeNull();
    });
  });

  describe('getWeeklyProgress', () => {
    test('should return weekly progress for user', async () => {
      const workoutData1 = {
        user_id: testUser.id,
        day: 'day1',
        title: 'Full Body Strength A',
        focus: 'Strength Training',
        completed: true,
        completed_at: new Date().toISOString()
      };

      const workoutData2 = {
        user_id: testUser.id,
        day: 'day2',
        title: 'Cardio & Core',
        focus: 'Cardiovascular Health',
        completed: false
      };

      await Workout.create(workoutData1);
      await Workout.create(workoutData2);
      
      const progress = await Workout.getWeeklyProgress(testUser.id);
      
      expect(progress.total).toBe(2);
      expect(progress.completed).toBe(1);
      expect(progress.percentage).toBe(50);
    });
  });
}); 