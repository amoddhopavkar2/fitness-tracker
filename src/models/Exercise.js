const db = require('../database/database');
const Workout = require('./Workout');
const { DatabaseError, NotFoundError, ValidationError } = require('../middleware/errorHandler');

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
    
    try {
      // Verify workout exists
      const workout = await Workout.findById(workout_id);
      if (!workout) {
        throw new NotFoundError('Workout not found');
      }
      
      return new Promise((resolve, reject) => {
        const query = `
          INSERT INTO exercises (workout_id, name, category, sets, reps, notes, completed, completed_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.run(query, [workout_id, name, category, sets, reps, notes, completed, completed_at], function(err) {
          if (err) {
            reject(new DatabaseError('Failed to create exercise', err));
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
    } catch (error) {
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new DatabaseError('Failed to create exercise', error);
    }
  }

  static async findByWorkout(workoutId) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM exercises WHERE workout_id = ? ORDER BY category, id';
      
      db.all(query, [workoutId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          // Convert completed field to proper boolean
          const exercises = (rows || []).map(exercise => ({
            ...exercise,
            completed: Boolean(exercise.completed)
          }));
          resolve(exercises);
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
    // Validate input
    if (!id || !Number.isInteger(Number(id)) || Number(id) <= 0) {
      throw new ValidationError('Invalid exercise ID provided');
    }

    return new Promise((resolve, reject) => {
      const query = `
        UPDATE exercises 
        SET completed = TRUE, completed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `;
      
      db.run(query, [id], async function(err) {
        if (err) {
          reject(new DatabaseError('Failed to mark exercise as completed', err));
        } else {
          if (this.changes === 0) {
            reject(new NotFoundError('Exercise not found'));
          } else {
            try {
              // Return the updated exercise with proper boolean conversion
              const exercise = await Exercise.findById(id);
              if (!exercise) {
                reject(new NotFoundError('Exercise not found after update'));
                return;
              }
              
              exercise.completed = Boolean(exercise.completed);
              
              // Update daily progress tracking
              await Exercise.updateDailyProgress(exercise.workout_id);
              
              // Check if all exercises in the workout are now completed
              await Exercise.checkAndUpdateWorkoutCompletion(exercise.workout_id);
              
              resolve(exercise);
            } catch (error) {
              reject(new DatabaseError('Failed to update related data', error));
            }
          }
        }
      });
    });
  }

  static async markIncomplete(id) {
    // Validate input
    if (!id || !Number.isInteger(Number(id)) || Number(id) <= 0) {
      throw new ValidationError('Invalid exercise ID provided');
    }

    return new Promise((resolve, reject) => {
      const query = `
        UPDATE exercises 
        SET completed = FALSE, completed_at = NULL 
        WHERE id = ?
      `;
      
      db.run(query, [id], async function(err) {
        if (err) {
          reject(new DatabaseError('Failed to mark exercise as incomplete', err));
        } else {
          if (this.changes === 0) {
            reject(new NotFoundError('Exercise not found'));
          } else {
            try {
              // Return the updated exercise with proper boolean conversion
              const exercise = await Exercise.findById(id);
              if (!exercise) {
                reject(new NotFoundError('Exercise not found after update'));
                return;
              }
              
              exercise.completed = Boolean(exercise.completed);
              
              // Update daily progress tracking
              await Exercise.updateDailyProgress(exercise.workout_id);
              
              // Check if workout should be marked as incomplete
              await Exercise.checkAndUpdateWorkoutCompletion(exercise.workout_id);
              
              resolve(exercise);
            } catch (error) {
              reject(new DatabaseError('Failed to update related data', error));
            }
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
      // First check if we have progress data for this specific date
      const progressQuery = `
        SELECT total_exercises, completed_exercises
        FROM progress 
        WHERE user_id = ? AND date = ?
      `;
      
      db.get(progressQuery, [userId, date], (err, progressRow) => {
        if (err) {
          reject(err);
          return;
        }
        
        if (progressRow) {
          // We have specific progress data for this date
          const total = progressRow.total_exercises || 0;
          const completed = progressRow.completed_exercises || 0;
          const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
          
          resolve({
            total,
            completed,
            percentage
          });
        } else {
          // No specific progress data, check if any exercises were completed on this date
          const exerciseQuery = `
            SELECT 
              COUNT(e.id) as total,
              SUM(CASE WHEN e.completed = 1 AND DATE(e.completed_at) = ? THEN 1 ELSE 0 END) as completed
            FROM exercises e
            JOIN workouts w ON e.workout_id = w.id
            WHERE w.user_id = ?
          `;
          
          db.get(exerciseQuery, [date, userId], (err, row) => {
            if (err) {
              reject(err);
            } else {
              // For backward compatibility, if no exercises were completed on this specific date,
              // check if this date corresponds to a workout day that has any completed exercises
              const dateObj = new Date(date);
              const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
              const dayKey = dayOfWeek === 0 ? 'day7' : `day${dayOfWeek}`;
              
              const workoutQuery = `
                SELECT 
                  COUNT(e.id) as total,
                  SUM(CASE WHEN e.completed = 1 THEN 1 ELSE 0 END) as completed
                FROM exercises e
                JOIN workouts w ON e.workout_id = w.id
                WHERE w.user_id = ? AND w.day = ?
              `;
              
              db.get(workoutQuery, [userId, dayKey], (err, workoutRow) => {
                if (err) {
                  reject(err);
                } else {
                  // Use the date-specific completed count if available, otherwise use workout day data
                  const total = workoutRow.total || 0;
                  const completed = row.completed > 0 ? row.completed : 0;
                  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
                  
                  resolve({
                    total,
                    completed,
                    percentage
                  });
                }
              });
            }
          });
        }
      });
    });
  }

  static async getProgressByDay(userId, day) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(e.id) as total,
          SUM(CASE WHEN e.completed = 1 THEN 1 ELSE 0 END) as completed,
          w.completed as workout_completed
        FROM exercises e
        JOIN workouts w ON e.workout_id = w.id
        WHERE w.user_id = ? AND w.day = ?
        GROUP BY w.id
      `;
      
      db.get(query, [userId, day], (err, row) => {
        if (err) {
          reject(err);
        } else {
          const total = row ? row.total : 0;
          const completed = row ? row.completed : 0;
          const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
          const workoutCompleted = row ? Boolean(row.workout_completed) : false;
          
          resolve({
            total,
            completed,
            percentage,
            workoutCompleted
          });
        }
      });
    });
  }

  static async updateDailyProgress(workoutId) {
    // Validate input
    if (!workoutId || !Number.isInteger(Number(workoutId)) || Number(workoutId) <= 0) {
      throw new Error('Invalid workout ID provided for progress update');
    }

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        // Get workout info to find user
        const workoutQuery = 'SELECT user_id FROM workouts WHERE id = ?';
        
        db.get(workoutQuery, [workoutId], (err, workout) => {
          if (err) {
            reject(new DatabaseError('Failed to fetch workout for progress update', err));
            return;
          }
          
          if (!workout) {
            reject(new NotFoundError('Workout not found for progress update'));
            return;
          }
          
          const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
          
          // Get total exercises and completed exercises for today for this user
          const progressQuery = `
            SELECT 
              COUNT(e.id) as total,
              SUM(CASE WHEN e.completed = 1 AND DATE(e.completed_at) = ? THEN 1 ELSE 0 END) as completed
            FROM exercises e
            JOIN workouts w ON e.workout_id = w.id
            WHERE w.user_id = ?
          `;
          
          db.get(progressQuery, [today, workout.user_id], (err, row) => {
            if (err) {
              reject(new DatabaseError('Failed to calculate daily progress', err));
              return;
            }
            
            const total = row.total || 0;
            const completed = row.completed || 0;
            
            // Validate calculated values
            if (completed > total) {
              reject(new Error('Data integrity error: completed exercises exceed total'));
              return;
            }
            
            // Insert or update progress record for today
            const upsertQuery = `
              INSERT INTO progress (user_id, date, total_exercises, completed_exercises)
              VALUES (?, ?, ?, ?)
              ON CONFLICT(user_id, date) DO UPDATE SET
                total_exercises = excluded.total_exercises,
                completed_exercises = excluded.completed_exercises
            `;
            
            db.run(upsertQuery, [workout.user_id, today, total, completed], function(err) {
              if (err) {
                reject(new DatabaseError('Failed to update daily progress record', err));
              } else {
                resolve({ total, completed, date: today, userId: workout.user_id });
              }
            });
          });
        });
      });
    });
  }

  static async checkAndUpdateWorkoutCompletion(workoutId) {
    const Workout = require('./Workout');
    
    // Validate input
    if (!workoutId || !Number.isInteger(Number(workoutId)) || Number(workoutId) <= 0) {
      throw new Error('Invalid workout ID provided for completion check');
    }
    
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        const query = `
          SELECT 
            COUNT(*) as total,
            SUM(CASE WHEN completed = 1 THEN 1 ELSE 0 END) as completed
          FROM exercises 
          WHERE workout_id = ?
        `;
        
        db.get(query, [workoutId], async (err, row) => {
          if (err) {
            reject(new DatabaseError('Failed to check workout completion status', err));
          } else {
            const total = row.total || 0;
            const completed = row.completed || 0;
            
            // Validate data integrity
            if (completed > total) {
              reject(new Error('Data integrity error: completed exercises exceed total in workout'));
              return;
            }
            
            try {
              // Verify workout exists before updating
              const workout = await Workout.findById(workoutId);
              if (!workout) {
                reject(new NotFoundError('Workout not found for completion update'));
                return;
              }
              
              if (total > 0 && completed === total) {
                // All exercises completed, mark workout as completed
                await Workout.markCompleted(workoutId);
              } else {
                // Not all exercises completed, mark workout as incomplete
                await Workout.markIncomplete(workoutId);
              }
              resolve({ 
                total, 
                completed, 
                workoutId, 
                isComplete: total > 0 && completed === total 
              });
            } catch (error) {
              reject(new DatabaseError('Failed to update workout completion status', error));
            }
          }
        });
      });
    });
  }

  // Add data integrity verification method
  static async verifyDataIntegrity(workoutId) {
    if (!workoutId || !Number.isInteger(Number(workoutId)) || Number(workoutId) <= 0) {
      throw new Error('Invalid workout ID provided for integrity check');
    }

    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          e.id,
          e.completed,
          e.completed_at,
          e.workout_id,
          w.user_id,
          w.completed as workout_completed
        FROM exercises e
        JOIN workouts w ON e.workout_id = w.id
        WHERE e.workout_id = ?
      `;
      
      db.all(query, [workoutId], (err, rows) => {
        if (err) {
          reject(new DatabaseError('Failed to verify data integrity', err));
          return;
        }
        
        const issues = [];
        
        rows.forEach(row => {
          // Check for inconsistent completion data
          if (row.completed && !row.completed_at) {
            issues.push(`Exercise ${row.id}: marked completed but no completion timestamp`);
          }
          
          if (!row.completed && row.completed_at) {
            issues.push(`Exercise ${row.id}: has completion timestamp but not marked completed`);
          }
        });
        
        // Check workout completion consistency
        const totalExercises = rows.length;
        const completedExercises = rows.filter(row => row.completed).length;
        const workoutCompleted = rows.length > 0 ? rows[0].workout_completed : false;
        
        if (totalExercises > 0) {
          const shouldBeComplete = completedExercises === totalExercises;
          if (shouldBeComplete !== Boolean(workoutCompleted)) {
            issues.push(`Workout completion status inconsistent: ${completedExercises}/${totalExercises} exercises completed but workout marked as ${workoutCompleted ? 'complete' : 'incomplete'}`);
          }
        }
        
        resolve({
          workoutId,
          totalExercises,
          completedExercises,
          workoutCompleted: Boolean(workoutCompleted),
          issues,
          isValid: issues.length === 0
        });
      });
    });
  }
}

module.exports = Exercise; 