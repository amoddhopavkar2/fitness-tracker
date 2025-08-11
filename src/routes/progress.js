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
    let lastWorkoutDate = null;
    
    // Get all workout completion data for the last 90 days to calculate accurate streaks
    const startDate = moment().subtract(90, 'days');
    const workoutData = [];
    
    // Collect all daily progress data
    for (let day = moment(startDate); day.isSameOrBefore(today); day.add(1, 'day')) {
      const dateStr = day.format('YYYY-MM-DD');
      const progress = await Exercise.getDailyProgress(req.user.id, dateStr);
      
      workoutData.push({
        date: dateStr,
        hasWorkout: progress.completed > 0,
        completionRate: progress.percentage
      });
    }
    
    // Calculate current streak (working backwards from today)
    let streakBroken = false;
    for (let i = workoutData.length - 1; i >= 0; i--) {
      const dayData = workoutData[i];
      
      if (dayData.hasWorkout) {
        if (!streakBroken) {
          currentStreak++;
          if (!lastWorkoutDate) {
            lastWorkoutDate = dayData.date;
          }
        }
        tempStreak++;
      } else {
        // If this is today or yesterday and we haven't found any workouts yet, 
        // we might still be in a streak (grace period for today)
        const dayMoment = moment(dayData.date);
        const isToday = dayMoment.isSame(today, 'day');
        const isYesterday = dayMoment.isSame(moment().subtract(1, 'day'), 'day');
        
        if (currentStreak === 0 && (isToday || (isYesterday && !streakBroken))) {
          // Continue looking for streak, but mark that we've seen a gap
          if (isYesterday) streakBroken = true;
          continue;
        }
        
        // Update longest streak if current temp streak is longer
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
        
        // Reset temp streak and break current streak calculation
        tempStreak = 0;
        if (currentStreak > 0) {
          break; // We've found the end of the current streak
        }
      }
    }
    
    // Final check: update longest streak if current streak is the longest
    if (currentStreak > longestStreak) {
      longestStreak = currentStreak;
    }
    
    // If we have a temp streak that's longer than longest, update it
    if (tempStreak > longestStreak) {
      longestStreak = tempStreak;
    }

    res.json({
      currentStreak,
      longestStreak,
      lastWorkoutDate,
      streakStartDate: currentStreak > 0 ? moment(lastWorkoutDate).subtract(currentStreak - 1, 'days').format('YYYY-MM-DD') : null
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
    
    // Calculate current month statistics
    const startOfMonth = moment().startOf('month');
    const endOfMonth = moment().endOf('month');
    
    let monthlyTotalWorkouts = 0;
    let monthlyTotalExercises = 0;
    let monthlyCompletedExercises = 0;
    let monthlyWorkoutDays = 0;
    
    // Calculate last 30 days statistics for comparison
    const thirtyDaysAgo = moment().subtract(30, 'days');
    let last30TotalWorkouts = 0;
    let last30TotalExercises = 0;
    let last30CompletedExercises = 0;
    let last30WorkoutDays = 0;
    
    // Get current month data
    for (let day = moment(startOfMonth); day.isSameOrBefore(endOfMonth) && day.isSameOrBefore(today); day.add(1, 'day')) {
      const dateStr = day.format('YYYY-MM-DD');
      const progress = await Exercise.getDailyProgress(req.user.id, dateStr);
      
      if (progress.completed > 0) {
        monthlyWorkoutDays++;
        monthlyTotalWorkouts++;
        monthlyTotalExercises += progress.total;
        monthlyCompletedExercises += progress.completed;
      }
    }
    
    // Get last 30 days data
    for (let day = moment(thirtyDaysAgo); day.isSameOrBefore(today); day.add(1, 'day')) {
      const dateStr = day.format('YYYY-MM-DD');
      const progress = await Exercise.getDailyProgress(req.user.id, dateStr);
      
      if (progress.completed > 0) {
        last30WorkoutDays++;
        last30TotalWorkouts++;
        last30TotalExercises += progress.total;
        last30CompletedExercises += progress.completed;
      }
    }
    
    // Calculate rates and averages
    const monthlyCompletionRate = monthlyTotalExercises > 0 ? (monthlyCompletedExercises / monthlyTotalExercises) * 100 : 0;
    const last30CompletionRate = last30TotalExercises > 0 ? (last30CompletedExercises / last30TotalExercises) * 100 : 0;
    
    const daysInMonth = endOfMonth.date();
    const daysSoFarInMonth = today.date();
    const monthlyWorkoutsPerWeek = monthlyWorkoutDays > 0 ? (monthlyWorkoutDays / (daysSoFarInMonth / 7)) : 0;
    const last30WorkoutsPerWeek = last30WorkoutDays > 0 ? (last30WorkoutDays / 4.285) : 0; // 30 days / 7 days per week
    
    res.json({
      currentMonth: {
        totalWorkouts: monthlyTotalWorkouts,
        totalExercises: monthlyTotalExercises,
        completedExercises: monthlyCompletedExercises,
        workoutDays: monthlyWorkoutDays,
        averageCompletionRate: Math.round(monthlyCompletionRate * 100) / 100,
        averageWorkoutsPerWeek: Math.round(monthlyWorkoutsPerWeek * 100) / 100,
        daysInMonth,
        daysSoFar: daysSoFarInMonth,
        monthName: today.format('MMMM YYYY')
      },
      last30Days: {
        totalWorkouts: last30TotalWorkouts,
        totalExercises: last30TotalExercises,
        completedExercises: last30CompletedExercises,
        workoutDays: last30WorkoutDays,
        averageCompletionRate: Math.round(last30CompletionRate * 100) / 100,
        averageWorkoutsPerWeek: Math.round(last30WorkoutsPerWeek * 100) / 100
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