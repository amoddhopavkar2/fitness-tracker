const express = require('express');
const Exercise = require('../models/Exercise');
const Workout = require('../models/Workout');
const { authenticateToken } = require('../middleware/auth');
const { 
    asyncHandler, 
    NotFoundError,
    AuthorizationError 
} = require('../middleware/errorHandler');
const { validate, exerciseSchemas, paramSchemas } = require('../middleware/validation');

const router = express.Router();

// Apply authentication to all exercise routes
router.use(authenticateToken);

// Helper function to verify exercise ownership
const verifyExerciseOwnership = async (exerciseId, userId) => {
    const exercise = await Exercise.findById(exerciseId);
    if (!exercise) {
        throw new NotFoundError('Exercise not found');
    }

    const workout = await Workout.findById(exercise.workout_id);
    if (!workout || workout.user_id !== userId) {
        throw new AuthorizationError('Access denied to this exercise');
    }

    return { exercise, workout };
};

// Helper function to verify workout ownership
const verifyWorkoutOwnership = async (workoutId, userId) => {
    const workout = await Workout.findById(workoutId);
    if (!workout || workout.user_id !== userId) {
        throw new NotFoundError('Workout not found');
    }
    return workout;
};

// Get all exercises for a workout
router.get('/workout/:workoutId', async (req, res) => {
  try {
    const { workoutId } = req.params;

    // Verify workout belongs to user
    const workout = await Workout.findById(workoutId);
    if (!workout || workout.user_id !== req.user.id) {
      return res.status(404).json({
        error: 'Workout not found'
      });
    }

    const exercises = await Exercise.findByWorkout(workoutId);
    res.json({ exercises });
  } catch (error) {
    console.error('Get exercises error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Get exercises by category for a workout
router.get('/workout/:workoutId/:category', async (req, res) => {
  try {
    const { workoutId, category } = req.params;

    // Verify workout belongs to user
    const workout = await Workout.findById(workoutId);
    if (!workout || workout.user_id !== req.user.id) {
      return res.status(404).json({
        error: 'Workout not found'
      });
    }

    const exercises = await Exercise.findByWorkoutAndCategory(workoutId, category);
    res.json({ exercises });
  } catch (error) {
    console.error('Get exercises by category error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Create new exercise
router.post('/', validateExercise, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { workout_id, name, category, sets, reps, notes } = req.body;

    // Verify workout belongs to user
    const workout = await Workout.findById(workout_id);
    if (!workout || workout.user_id !== req.user.id) {
      return res.status(404).json({
        error: 'Workout not found'
      });
    }

    const exercise = await Exercise.create({
      workout_id,
      name,
      category,
      sets,
      reps,
      notes
    });

    res.status(201).json({
      message: 'Exercise created successfully',
      exercise
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: error.message
      });
    }
    
    console.error('Create exercise error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Update exercise
router.put('/:id', validateExercise, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { id } = req.params;
    const { name, category, sets, reps, notes } = req.body;

    // Verify exercise belongs to user's workout
    const exercise = await Exercise.findById(id);
    if (!exercise) {
      return res.status(404).json({
        error: 'Exercise not found'
      });
    }

    const workout = await Workout.findById(exercise.workout_id);
    if (!workout || workout.user_id !== req.user.id) {
      return res.status(404).json({
        error: 'Exercise not found'
      });
    }

    const result = await Exercise.update(id, { name, category, sets, reps, notes });
    
    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Exercise not found'
      });
    }

    res.json({
      message: 'Exercise updated successfully'
    });
  } catch (error) {
    console.error('Update exercise error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Mark exercise as completed
router.patch('/:id/complete', 
    validate(paramSchemas.id, 'params'),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        // Verify exercise belongs to user's workout
        await verifyExerciseOwnership(id, req.user.id);

        const updatedExercise = await Exercise.markCompleted(id);
        
        res.json({
            message: 'Exercise marked as completed',
            exercise: updatedExercise
        });
    })
);

// Mark exercise as incomplete
router.patch('/:id/incomplete', 
    validate(paramSchemas.id, 'params'),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        // Verify exercise belongs to user's workout
        await verifyExerciseOwnership(id, req.user.id);

        const updatedExercise = await Exercise.markIncomplete(id);
        
        res.json({
            message: 'Exercise marked as incomplete',
            exercise: updatedExercise
        });
    })
);

// Get workout progress
router.get('/workout/:workoutId/progress', async (req, res) => {
  try {
    const { workoutId } = req.params;

    // Verify workout belongs to user
    const workout = await Workout.findById(workoutId);
    if (!workout || workout.user_id !== req.user.id) {
      return res.status(404).json({
        error: 'Workout not found'
      });
    }

    const progress = await Exercise.getWorkoutProgress(workoutId);
    res.json({ progress });
  } catch (error) {
    console.error('Get workout progress error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Get progress by day
router.get('/progress/day/:day', async (req, res) => {
  try {
    const { day } = req.params;

    // Validate day format
    if (!['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'].includes(day)) {
      return res.status(400).json({
        error: 'Invalid day format. Use day1-day7'
      });
    }

    const progress = await Exercise.getProgressByDay(req.user.id, day);
    res.json({ progress });
  } catch (error) {
    console.error('Get day progress error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Delete exercise
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify exercise belongs to user's workout
    const exercise = await Exercise.findById(id);
    if (!exercise) {
      return res.status(404).json({
        error: 'Exercise not found'
      });
    }

    const workout = await Workout.findById(exercise.workout_id);
    if (!workout || workout.user_id !== req.user.id) {
      return res.status(404).json({
        error: 'Exercise not found'
      });
    }

    const result = await Exercise.delete(id);
    
    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Exercise not found'
      });
    }

    res.json({
      message: 'Exercise deleted successfully'
    });
  } catch (error) {
    console.error('Delete exercise error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

module.exports = router; 