const db = require('../database/database');
const User = require('./User');

class Workout {
  static async create(workoutData) {
    const { user_id, day, title, focus, completed = false, completed_at = null } = workoutData;
    
    // Verify user exists
    const user = await User.findById(user_id);
    if (!user) {
      throw new Error('User not found');
    }
    
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO workouts (user_id, day, title, focus, completed, completed_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `;
      
      db.run(query, [user_id, day, title, focus, completed, completed_at], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            reject(new Error('Workout for this day already exists for this user'));
          } else {
            reject(err);
          }
        } else {
          resolve({
            id: this.lastID,
            user_id,
            day,
            title,
            focus,
            completed,
            completed_at,
            created_at: new Date().toISOString()
          });
        }
      });
    });
  }

  static async findByUserAndDay(userId, day) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM workouts WHERE user_id = ? AND day = ?';
      
      db.get(query, [userId, day], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  static async findByUser(userId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM workouts WHERE user_id = ? ORDER BY day';
      
      db.all(query, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM workouts WHERE id = ?';
      
      db.get(query, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  static async markCompleted(id) {
    // Validate input
    if (!id || !Number.isInteger(Number(id)) || Number(id) <= 0) {
      throw new Error('Invalid workout ID provided');
    }

    return new Promise((resolve, reject) => {
      const query = `
        UPDATE workouts 
        SET completed = TRUE, completed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;
      
      db.run(query, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          if (this.changes === 0) {
            reject(new Error('Workout not found'));
          } else {
            // Return the updated workout
            Workout.findById(id).then(resolve).catch(reject);
          }
        }
      });
    });
  }

  static async markIncomplete(id) {
    // Validate input
    if (!id || !Number.isInteger(Number(id)) || Number(id) <= 0) {
      throw new Error('Invalid workout ID provided');
    }

    return new Promise((resolve, reject) => {
      const query = `
        UPDATE workouts 
        SET completed = FALSE, completed_at = NULL 
        WHERE id = ?
      `;
      
      db.run(query, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          if (this.changes === 0) {
            reject(new Error('Workout not found'));
          } else {
            // Return the updated workout
            Workout.findById(id).then(resolve).catch(reject);
          }
        }
      });
    });
  }

  static async getWeeklyProgress(userId) {
    return new Promise((resolve, reject) => {
      // Get progress based on exercises completed for all workouts in the current week
      const query = `
        SELECT 
          COUNT(e.id) as total_exercises,
          SUM(CASE WHEN e.completed = 1 THEN 1 ELSE 0 END) as completed_exercises,
          COUNT(DISTINCT w.id) as total_workouts,
          COUNT(DISTINCT CASE WHEN w.completed = 1 THEN w.id END) as completed_workouts
        FROM workouts w
        LEFT JOIN exercises e ON w.id = e.workout_id
        WHERE w.user_id = ?
      `;
      
      db.get(query, [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          const totalExercises = row.total_exercises || 0;
          const completedExercises = row.completed_exercises || 0;
          const totalWorkouts = row.total_workouts || 0;
          const completedWorkouts = row.completed_workouts || 0;
          
          // Calculate percentage based on workouts completed (for backward compatibility)
          const workoutPercentage = totalWorkouts > 0 ? Math.round((completedWorkouts / totalWorkouts) * 100) : 0;
          const exercisePercentage = totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0;
          
          resolve({
            // Backward compatibility - return workout counts as main values
            total: totalWorkouts,
            completed: completedWorkouts,
            percentage: workoutPercentage,
            // Additional exercise progress data
            totalExercises,
            completedExercises,
            exercisePercentage
          });
        }
      });
    });
  }

  static async update(id, updateData) {
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const query = `UPDATE workouts SET ${setClause} WHERE id = ?`;
    
    return new Promise((resolve, reject) => {
      db.run(query, [...values, id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  static async delete(id) {
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM workouts WHERE id = ?';
      
      db.run(query, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }
}

module.exports = Workout; 