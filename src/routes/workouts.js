const express = require('express');
const { body, validationResult } = require('express-validator');
const Workout = require('../models/Workout');
const Exercise = require('../models/Exercise');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// Apply authentication to all workout routes
router.use(authenticateToken);

// Validation middleware
const validateWorkout = [
  body('day')
    .isIn(['day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'])
    .withMessage('Day must be one of: day1, day2, day3, day4, day5, day6, day7'),
  body('title')
    .isLength({ min: 1, max: 100 })
    .withMessage('Title must be between 1 and 100 characters'),
  body('focus')
    .isLength({ min: 1, max: 100 })
    .withMessage('Focus must be between 1 and 100 characters')
];

// Get all workouts for current user
router.get('/', async (req, res) => {
  try {
    const workouts = await Workout.findByUser(req.user.id);
    res.json({ workouts });
  } catch (error) {
    console.error('Get workouts error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Get specific workout by day
router.get('/:day', async (req, res) => {
  try {
    const { day } = req.params;
    const workout = await Workout.findByUserAndDay(req.user.id, day);
    
    if (!workout) {
      return res.status(404).json({
        error: 'Workout not found'
      });
    }

    // Get exercises for this workout
    const exercises = await Exercise.findByWorkout(workout.id);
    
    res.json({
      workout: {
        ...workout,
        exercises
      }
    });
  } catch (error) {
    console.error('Get workout error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Create new workout
router.post('/', validateWorkout, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: 'Validation Error',
        details: errors.array()
      });
    }

    const { day, title, focus } = req.body;

    // Check if workout already exists for this day
    const existingWorkout = await Workout.findByUserAndDay(req.user.id, day);
    if (existingWorkout) {
      return res.status(409).json({
        error: 'Workout already exists for this day'
      });
    }

    const workout = await Workout.create({
      user_id: req.user.id,
      day,
      title,
      focus
    });

    res.status(201).json({
      message: 'Workout created successfully',
      workout
    });
  } catch (error) {
    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: error.message
      });
    }
    
    console.error('Create workout error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Update workout
router.put('/:id', validateWorkout, async (req, res) => {
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
    const { title, focus } = req.body;

    // Verify workout belongs to user
    const workout = await Workout.findById(id);
    if (!workout || workout.user_id !== req.user.id) {
      return res.status(404).json({
        error: 'Workout not found'
      });
    }

    const result = await Workout.update(id, { title, focus });
    
    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Workout not found'
      });
    }

    res.json({
      message: 'Workout updated successfully'
    });
  } catch (error) {
    console.error('Update workout error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Mark workout as completed
router.patch('/:id/complete', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify workout belongs to user
    const workout = await Workout.findById(id);
    if (!workout || workout.user_id !== req.user.id) {
      return res.status(404).json({
        error: 'Workout not found'
      });
    }

    const updatedWorkout = await Workout.markCompleted(id);
    
    res.json({
      message: 'Workout marked as completed',
      workout: updatedWorkout
    });
  } catch (error) {
    console.error('Complete workout error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Mark workout as incomplete
router.patch('/:id/incomplete', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify workout belongs to user
    const workout = await Workout.findById(id);
    if (!workout || workout.user_id !== req.user.id) {
      return res.status(404).json({
        error: 'Workout not found'
      });
    }

    const updatedWorkout = await Workout.markIncomplete(id);
    
    res.json({
      message: 'Workout marked as incomplete',
      workout: updatedWorkout
    });
  } catch (error) {
    console.error('Incomplete workout error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Get weekly progress
router.get('/progress/weekly', async (req, res) => {
  try {
    const progress = await Workout.getWeeklyProgress(req.user.id);
    res.json({ progress });
  } catch (error) {
    console.error('Get weekly progress error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Delete workout
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify workout belongs to user
    const workout = await Workout.findById(id);
    if (!workout || workout.user_id !== req.user.id) {
      return res.status(404).json({
        error: 'Workout not found'
      });
    }

    const result = await Workout.delete(id);
    
    if (result.changes === 0) {
      return res.status(404).json({
        error: 'Workout not found'
      });
    }

    res.json({
      message: 'Workout deleted successfully'
    });
  } catch (error) {
    console.error('Delete workout error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

module.exports = router; 