const express = require('express');
const { body, validationResult } = require('express-validator');
const Exercise = require('../models/Exercise');
const Workout = require('../models/Workout');
const { authenticateToken } = require('../middleware/auth');
const moment = require('moment');

const router = express.Router();

// Apply authentication to all progress routes
router.use(authenticateToken);

// Validation middleware
const validateDate = [
  body('date')
    .isISO8601()
    .withMessage('Date must be a valid ISO 8601 date')
];

// Get daily progress for a specific date
router.get('/daily/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    // Validate date format
    if (!moment(date, 'YYYY-MM-DD', true).isValid()) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    const progress = await Exercise.getDailyProgress(req.user.id, date);
    res.json({ progress });
  } catch (error) {
    console.error('Get daily progress error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Get weekly progress for a specific week
router.get('/weekly/:startDate', async (req, res) => {
  try {
    const { startDate } = req.params;
    
    // Validate date format
    if (!moment(startDate, 'YYYY-MM-DD', true).isValid()) {
      return res.status(400).json({
        error: 'Invalid date format. Use YYYY-MM-DD'
      });
    }

    const start = moment(startDate);
    const end = moment(startDate).add(6, 'days');
    
    const weeklyProgress = [];
    
    for (let day = moment(start); day.isSameOrBefore(end); day.add(1, 'day')) {
      const dateStr = day.format('YYYY-MM-DD');
      const progress = await Exercise.getDailyProgress(req.user.id, dateStr);
      
      weeklyProgress.push({
        date: dateStr,
        day: day.format('dddd'),
        progress
      });
    }

    res.json({ weeklyProgress });
  } catch (error) {
    console.error('Get weekly progress error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Get monthly progress for a specific month
router.get('/monthly/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    
    // Validate year and month
    if (!moment(`${year}-${month}-01`, 'YYYY-MM-DD', true).isValid()) {
      return res.status(400).json({
        error: 'Invalid year or month format'
      });
    }

    const startOfMonth = moment(`${year}-${month}-01`);
    const endOfMonth = moment(startOfMonth).endOf('month');
    
    const monthlyProgress = [];
    
    for (let day = moment(startOfMonth); day.isSameOrBefore(endOfMonth); day.add(1, 'day')) {
      const dateStr = day.format('YYYY-MM-DD');
      const progress = await Exercise.getDailyProgress(req.user.id, dateStr);
      
      monthlyProgress.push({
        date: dateStr,
        day: day.format('dddd'),
        progress
      });
    }

    res.json({ monthlyProgress });
  } catch (error) {
    console.error('Get monthly progress error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Get calendar view for a specific month
router.get('/calendar/:year/:month', async (req, res) => {
  try {
    const { year, month } = req.params;
    
    // Validate year and month
    if (!moment(`${year}-${month}-01`, 'YYYY-MM-DD', true).isValid()) {
      return res.status(400).json({
        error: 'Invalid year or month format'
      });
    }

    const startOfMonth = moment(`${year}-${month}-01`);
    const endOfMonth = moment(startOfMonth).endOf('month');
    const startOfCalendar = moment(startOfMonth).startOf('week');
    const endOfCalendar = moment(endOfMonth).endOf('week');
    
    const calendar = [];
    
    for (let day = moment(startOfCalendar); day.isSameOrBefore(endOfCalendar); day.add(1, 'day')) {
      const dateStr = day.format('YYYY-MM-DD');
      const progress = await Exercise.getDailyProgress(req.user.id, dateStr);
      
      calendar.push({
        date: dateStr,
        day: day.format('dddd'),
        isCurrentMonth: day.isSame(startOfMonth, 'month'),
        isToday: day.isSame(moment(), 'day'),
        progress
      });
    }

    res.json({ calendar });
  } catch (error) {
    console.error('Get calendar error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Get streak information
router.get('/streak', async (req, res) => {
  try {
    const today = moment();
    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    
    // Check current streak (consecutive days with completed exercises)
    for (let day = moment(today); day.isSameOrAfter(moment().subtract(30, 'days')); day.subtract(1, 'day')) {
      const dateStr = day.format('YYYY-MM-DD');
      const progress = await Exercise.getDailyProgress(req.user.id, dateStr);
      
      if (progress.completed > 0) {
        currentStreak++;
        tempStreak++;
      } else {
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
        tempStreak = 0;
        break; // Stop counting current streak if we find a day with no completed exercises
      }
    }
    
    // Update longest streak if current streak is longer
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }

    res.json({
      currentStreak,
      longestStreak,
      lastWorkoutDate: currentStreak > 0 ? moment().subtract(currentStreak - 1, 'days').format('YYYY-MM-DD') : null
    });
  } catch (error) {
    console.error('Get streak error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

// Get overall statistics
router.get('/stats', async (req, res) => {
  try {
    const today = moment();
    const thirtyDaysAgo = moment().subtract(30, 'days');
    
    let totalWorkouts = 0;
    let totalExercises = 0;
    let completedExercises = 0;
    let workoutDays = 0;
    
    for (let day = moment(thirtyDaysAgo); day.isSameOrBefore(today); day.add(1, 'day')) {
      const dateStr = day.format('YYYY-MM-DD');
      const progress = await Exercise.getDailyProgress(req.user.id, dateStr);
      
      if (progress.total > 0) {
        workoutDays++;
        totalWorkouts++;
        totalExercises += progress.total;
        completedExercises += progress.completed;
      }
    }
    
    const averageCompletionRate = totalExercises > 0 ? (completedExercises / totalExercises) * 100 : 0;
    const averageWorkoutsPerWeek = workoutDays > 0 ? (workoutDays / 4.285) : 0; // 30 days / 7 days per week
    
    res.json({
      last30Days: {
        totalWorkouts,
        totalExercises,
        completedExercises,
        workoutDays,
        averageCompletionRate: Math.round(averageCompletionRate * 100) / 100,
        averageWorkoutsPerWeek: Math.round(averageWorkoutsPerWeek * 100) / 100
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
});

module.exports = router; 