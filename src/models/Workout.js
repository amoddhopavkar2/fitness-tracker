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
      const query = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
        FROM workouts 
        WHERE user_id = ?
      `;
      
      db.get(query, [userId], (err, row) => {
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