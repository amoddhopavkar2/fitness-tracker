const db = require('../database/database');
const Workout = require('./Workout');

class Exercise {
  static async create(exerciseData) {
    const { 
      workout_id, 
      name, 
      category, 
      sets = null, 
      reps = null, 
      notes = null,
      completed = false,
      completed_at = null 
    } = exerciseData;
    
    // Verify workout exists
    const workout = await Workout.findById(workout_id);
    if (!workout) {
      throw new Error('Workout not found');
    }
    
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO exercises (workout_id, name, category, sets, reps, notes, completed, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      db.run(query, [workout_id, name, category, sets, reps, notes, completed, completed_at], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            id: this.lastID,
            workout_id,
            name,
            category,
            sets,
            reps,
            notes,
            completed,
            completed_at,
            created_at: new Date().toISOString()
          });
        }
      });
    });
  }

  static async findByWorkout(workoutId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM exercises WHERE workout_id = ? ORDER BY category, id';
      
      db.all(query, [workoutId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  static async findByWorkoutAndCategory(workoutId, category) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM exercises WHERE workout_id = ? AND category = ? ORDER BY id';
      
      db.all(query, [workoutId, category], (err, rows) => {
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
      const query = 'SELECT * FROM exercises WHERE id = ?';
      
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
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE exercises 
        SET completed = TRUE, completed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;
      
      db.run(query, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          if (this.changes === 0) {
            reject(new Error('Exercise not found'));
          } else {
            // Return the updated exercise
            Exercise.findById(id).then(resolve).catch(reject);
          }
        }
      });
    });
  }

  static async markIncomplete(id) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE exercises 
        SET completed = FALSE, completed_at = NULL 
        WHERE id = ?
      `;
      
      db.run(query, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          if (this.changes === 0) {
            reject(new Error('Exercise not found'));
          } else {
            // Return the updated exercise
            Exercise.findById(id).then(resolve).catch(reject);
          }
        }
      });
    });
  }

  static async getWorkoutProgress(workoutId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
        FROM exercises 
        WHERE workout_id = ?
      `;
      
      db.get(query, [workoutId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          const total = row.total || 0;
          const completed = row.completed || 0;
          const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
          
          resolve({
            total,
            completed,
            percentage
          });
        }
      });
    });
  }

  static async update(id, updateData) {
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const query = `UPDATE exercises SET ${setClause} WHERE id = ?`;
    
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
      const query = 'DELETE FROM exercises WHERE id = ?';
      
      db.run(query, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  static async getDailyProgress(userId, date) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN e.completed = 1 THEN 1 ELSE 0 END) as completed
        FROM exercises e
        JOIN workouts w ON e.workout_id = w.id
        WHERE w.user_id = ? AND DATE(w.created_at) = ?
      `;
      
      db.get(query, [userId, date], (err, row) => {
        if (err) {
          reject(err);
        } else {
          const total = row.total || 0;
          const completed = row.completed || 0;
          const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
          
          resolve({
            total,
            completed,
            percentage
          });
        }
      });
    });
  }
}

module.exports = Exercise; 