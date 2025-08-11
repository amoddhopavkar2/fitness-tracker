const bcrypt = require('bcryptjs');
const db = require('../database/database');
const { config } = require('../config/env');

class User {
  static async create(userData) {
    const { username, email, password } = userData;
    
    // Hash the password
    const saltRounds = config.bcryptRounds;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO users (username, email, password)
        VALUES (?, ?, ?)
      `;
      
      db.run(query, [username, email, hashedPassword], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) {
            reject(new Error('Username or email already exists'));
          } else {
            reject(err);
          }
        } else {
          resolve({
            id: this.lastID,
            username,
            email,
            password: hashedPassword,
            created_at: new Date().toISOString()
          });
        }
      });
    });
  }

  static async findByUsername(username) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM users WHERE username = ?';
      
      db.get(query, [username], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  static async findById(id) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM users WHERE id = ?';
      
      db.get(query, [id], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  static async validatePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }

  static async update(id, updateData) {
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    
    if (updateData.password) {
      const saltRounds = config.bcryptRounds;
      const hashedPassword = await bcrypt.hash(updateData.password, saltRounds);
      const passwordIndex = fields.indexOf('password');
      values[passwordIndex] = hashedPassword;
    }
    
    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const query = `UPDATE users SET ${setClause} WHERE id = ?`;
    
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
      const query = 'DELETE FROM users WHERE id = ?';
      
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

module.exports = User; 