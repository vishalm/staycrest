const bcrypt = require('bcryptjs');
const { pool } = require('../database/connection');

class User {
  /**
   * Find a user by their ID
   * @param {string} id - User UUID
   * @returns {Promise<Object|null>} User object or null if not found
   */
  static async findById(id) {
    try {
      const query = `
        SELECT u.*, 
               json_agg(
                 json_build_object(
                   'id', la.id,
                   'programId', la.program_id,
                   'programName', la.program_name,
                   'membershipId', la.membership_id,
                   'tier', la.tier,
                   'points', la.points,
                   'lastUpdated', la.last_updated
                 )
               ) FILTER (WHERE la.id IS NOT NULL) AS loyalty_accounts
        FROM users u
        LEFT JOIN loyalty_accounts la ON u.id = la.user_id
        WHERE u.id = $1
        GROUP BY u.id
      `;
      
      const { rows } = await pool.query(query, [id]);
      
      if (rows.length === 0) {
        return null;
      }
      
      // Transform the result to camelCase
      return this.mapRowToUserObject(rows[0]);
    } catch (error) {
      console.error('Error finding user by ID:', error);
      throw error;
    }
  }

  /**
   * Find a user by their email
   * @param {string} email - User email
   * @returns {Promise<Object|null>} User object or null if not found
   */
  static async findByEmail(email) {
    try {
      const query = `
        SELECT u.*, 
               json_agg(
                 json_build_object(
                   'id', la.id,
                   'programId', la.program_id,
                   'programName', la.program_name,
                   'membershipId', la.membership_id,
                   'tier', la.tier,
                   'points', la.points,
                   'lastUpdated', la.last_updated
                 )
               ) FILTER (WHERE la.id IS NOT NULL) AS loyalty_accounts
        FROM users u
        LEFT JOIN loyalty_accounts la ON u.id = la.user_id
        WHERE u.email = $1
        GROUP BY u.id
      `;
      
      const { rows } = await pool.query(query, [email]);
      
      if (rows.length === 0) {
        return null;
      }
      
      // Transform the result to camelCase
      return this.mapRowToUserObject(rows[0]);
    } catch (error) {
      console.error('Error finding user by email:', error);
      throw error;
    }
  }

  /**
   * Find a user by social ID (Google, Facebook, Apple)
   * @param {string} provider - Provider name ('google', 'facebook', 'apple')
   * @param {string} id - Provider-specific ID
   * @returns {Promise<Object|null>} User object or null if not found
   */
  static async findBySocialId(provider, id) {
    try {
      const column = `${provider}_id`;
      
      const query = `
        SELECT u.*, 
               json_agg(
                 json_build_object(
                   'id', la.id,
                   'programId', la.program_id,
                   'programName', la.program_name,
                   'membershipId', la.membership_id,
                   'tier', la.tier,
                   'points', la.points,
                   'lastUpdated', la.last_updated
                 )
               ) FILTER (WHERE la.id IS NOT NULL) AS loyalty_accounts
        FROM users u
        LEFT JOIN loyalty_accounts la ON u.id = la.user_id
        WHERE u.${column} = $1
        GROUP BY u.id
      `;
      
      const { rows } = await pool.query(query, [id]);
      
      if (rows.length === 0) {
        return null;
      }
      
      // Transform the result to camelCase
      return this.mapRowToUserObject(rows[0]);
    } catch (error) {
      console.error(`Error finding user by ${provider} ID:`, error);
      throw error;
    }
  }

  /**
   * Create a new user
   * @param {Object} userData - User data
   * @returns {Promise<Object>} Created user object
   */
  static async create(userData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      const { 
        firstName, lastName, email, password, 
        role = 'user', isVerified = false,
        googleId = null, facebookId = null, appleId = null 
      } = userData;
      
      // Hash password if provided
      let hashedPassword = password;
      if (password && !password.startsWith('$2')) {
        const salt = await bcrypt.genSalt(10);
        hashedPassword = await bcrypt.hash(password, salt);
      }
      
      const query = `
        INSERT INTO users (
          first_name, last_name, email, password, 
          role, is_verified, google_id, facebook_id, apple_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      
      const values = [
        firstName, lastName, email, hashedPassword,
        role, isVerified, googleId, facebookId, appleId
      ];
      
      const { rows } = await client.query(query, values);
      const user = rows[0];
      
      // Also create default configuration for the user
      await client.query(
        `INSERT INTO configurations (user_id) VALUES ($1)`,
        [user.id]
      );
      
      await client.query('COMMIT');
      
      // Return user without loyalty accounts (newly created users don't have any)
      return this.mapRowToUserObject({
        ...user,
        loyalty_accounts: null
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update a user
   * @param {string} id - User UUID
   * @param {Object} updateData - Data to update
   * @returns {Promise<Object|null>} Updated user object or null if not found
   */
  static async update(id, updateData) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Check if user exists
      const existingUser = await this.findById(id);
      if (!existingUser) {
        return null;
      }
      
      // Prepare update fields and values
      const fields = [];
      const values = [];
      let paramIndex = 1;
      
      // Map camelCase to snake_case for database
      const fieldMap = {
        firstName: 'first_name',
        lastName: 'last_name',
        email: 'email',
        password: 'password',
        role: 'role',
        isVerified: 'is_verified',
        googleId: 'google_id',
        facebookId: 'facebook_id',
        appleId: 'apple_id'
      };
      
      // Hash password if it's being updated
      if (updateData.password && !updateData.password.startsWith('$2')) {
        const salt = await bcrypt.genSalt(10);
        updateData.password = await bcrypt.hash(updateData.password, salt);
      }
      
      // Build the update SET clause
      for (const [key, value] of Object.entries(updateData)) {
        if (fieldMap[key]) {
          fields.push(`${fieldMap[key]} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }
      
      // Add updated_at timestamp
      fields.push(`updated_at = NOW()`);
      
      // If there are no fields to update, return the existing user
      if (fields.length === 0) {
        return existingUser;
      }
      
      // Build and execute the query
      const query = `
        UPDATE users 
        SET ${fields.join(', ')} 
        WHERE id = $${paramIndex}
        RETURNING *
      `;
      
      values.push(id);
      
      const { rows } = await client.query(query, values);
      
      await client.query('COMMIT');
      
      // Get the updated user with loyalty accounts
      return await this.findById(id);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating user:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a user
   * @param {string} id - User UUID
   * @returns {Promise<boolean>} True if deleted, false if not found
   */
  static async delete(id) {
    try {
      const query = 'DELETE FROM users WHERE id = $1 RETURNING id';
      const { rows } = await pool.query(query, [id]);
      
      return rows.length > 0;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Add a loyalty account to a user
   * @param {string} userId - User UUID
   * @param {Object} accountData - Loyalty account data
   * @returns {Promise<Object>} Created loyalty account
   */
  static async addLoyaltyAccount(userId, accountData) {
    try {
      const { 
        programId, programName, membershipId, 
        tier = 'basic', points = 0 
      } = accountData;
      
      const query = `
        INSERT INTO loyalty_accounts (
          user_id, program_id, program_name, membership_id, tier, points
        ) VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      
      const values = [
        userId, programId, programName, membershipId, tier, points
      ];
      
      const { rows } = await pool.query(query, values);
      
      // Map the row to a camelCase object
      return {
        id: rows[0].id,
        userId: rows[0].user_id,
        programId: rows[0].program_id,
        programName: rows[0].program_name,
        membershipId: rows[0].membership_id,
        tier: rows[0].tier,
        points: rows[0].points,
        lastUpdated: rows[0].last_updated,
        createdAt: rows[0].created_at,
        updatedAt: rows[0].updated_at
      };
    } catch (error) {
      console.error('Error adding loyalty account:', error);
      throw error;
    }
  }

  /**
   * Check if the provided password matches the user's password
   * @param {string} providedPassword - Password to check
   * @param {string} hashedPassword - Stored hashed password
   * @returns {Promise<boolean>} True if passwords match
   */
  static async comparePassword(providedPassword, hashedPassword) {
    return await bcrypt.compare(providedPassword, hashedPassword);
  }

  /**
   * Map a database row to a user object with camelCase properties
   * @param {Object} row - Database row
   * @returns {Object} User object with camelCase properties
   */
  static mapRowToUserObject(row) {
    const user = {
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      role: row.role,
      isVerified: row.is_verified,
      googleId: row.google_id,
      facebookId: row.facebook_id,
      appleId: row.apple_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
    
    // Add loyalty accounts if available
    if (row.loyalty_accounts && row.loyalty_accounts !== null) {
      user.loyaltyAccounts = row.loyalty_accounts;
    } else {
      user.loyaltyAccounts = [];
    }
    
    return user;
  }
}

module.exports = User; 