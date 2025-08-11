const express = require('express');
const Exercise = require('../models/Exercise');
const Workout = require('../models/Workout');
const { authenticateToken } = require('../middleware/auth');
const { 
    asyncHandler, 
    NotFoundError,
    AuthorizationError,
    ValidationError 
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
router.get('/workout/:workoutId', 
    validate(paramSchemas.id, 'params'),
    asyncHandler(async (req, res) => {
        const { workoutId } = req.params;

        // Verify workout belongs to user
        await verifyWorkoutOwnership(workoutId, req.user.id);

        const exercises = await Exercise.findByWorkout(workoutId);
        res.json({ exercises });
    })
);

// Get exercises by category for a workout
router.get('/workout/:workoutId/:category', 
    asyncHandler(async (req, res) => {
        const { workoutId, category } = req.params;

        // Validate category
        const validCategories = ['strength', 'cardio', 'flexibility', 'balance', 'sports'];
        if (!validCategories.includes(category)) {
            throw new ValidationError(`Category must be one of: ${validCategories.join(', ')}`);
        }

        // Verify workout belongs to user
        await verifyWorkoutOwnership(workoutId, req.user.id);

        const exercises = await Exercise.findByWorkoutAndCategory(workoutId, category);
        res.json({ exercises });
    })
);

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
router.get('/workout/:workoutId/progress', 
    validate(paramSchemas.id, 'params'),
    asyncHandler(async (req, res) => {
        const { workoutId } = req.params;

        // Verify workout belongs to user
        await verifyWorkoutOwnership(workoutId, req.user.id);

        const progress = await Exercise.getWorkoutProgress(workoutId);
        res.json({ progress });
    })
);

// Delete exercise
router.delete('/:id', 
    validate(paramSchemas.id, 'params'),
    asyncHandler(async (req, res) => {
        const { id } = req.params;

        // Verify exercise belongs to user's workout
        await verifyExerciseOwnership(id, req.user.id);

        const result = await Exercise.delete(id);
        
        if (result.changes === 0) {
            throw new NotFoundError('Exercise not found');
        }

        res.json({
            message: 'Exercise deleted successfully'
        });
    })
);

module.exports = router;