const bcrypt = require('bcryptjs');
const { pool } = require('../connection');

/**
 * Seeds initial admin users
 */
async function seedAdminUsers() {
  const client = await pool.connect();
  
  try {
    console.log('Checking for existing superadmin user...');
    
    // Check if superadmin already exists
    const checkQuery = 'SELECT * FROM users WHERE role = $1 LIMIT 1';
    const checkResult = await client.query(checkQuery, ['superadmin']);
    
    if (checkResult.rows.length > 0) {
      console.log('Superadmin user already exists. Skipping seed.');
      return;
    }
    
    console.log('Creating superadmin user...');
    
    // Hash the password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('Staycrest@2025', salt);
    
    // Create superadmin user
    const insertQuery = `
      INSERT INTO users (
        first_name, last_name, email, password, 
        role, is_verified, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id
    `;
    
    const insertValues = [
      'Super',
      'Admin',
      'superadmin@staycrest.com',
      hashedPassword,
      'superadmin',
      true
    ];
    
    const result = await client.query(insertQuery, insertValues);
    
    // Create default configuration for the superadmin
    if (result.rows.length > 0) {
      const userId = result.rows[0].id;
      await client.query(
        `INSERT INTO configurations (user_id, created_at, updated_at) VALUES ($1, NOW(), NOW())`,
        [userId]
      );
      console.log(`Superadmin user created with ID: ${userId}`);
    }
    
    console.log('Superadmin user seeded successfully.');
    
    // Create sample admin user if not exists
    const checkAdminQuery = 'SELECT * FROM users WHERE role = $1 AND email = $2 LIMIT 1';
    const checkAdminResult = await client.query(checkAdminQuery, ['admin', 'admin@staycrest.com']);
    
    if (checkAdminResult.rows.length === 0) {
      console.log('Creating sample admin user...');
      
      // Hash the password
      const adminPassword = await bcrypt.hash('Admin@2025', salt);
      
      // Create admin user
      const insertAdminQuery = `
        INSERT INTO users (
          first_name, last_name, email, password, 
          role, is_verified, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id
      `;
      
      const insertAdminValues = [
        'System',
        'Admin',
        'admin@staycrest.com',
        adminPassword,
        'admin',
        true
      ];
      
      const adminResult = await client.query(insertAdminQuery, insertAdminValues);
      
      // Create default configuration for the admin
      if (adminResult.rows.length > 0) {
        const adminId = adminResult.rows[0].id;
        await client.query(
          `INSERT INTO configurations (user_id, created_at, updated_at) VALUES ($1, NOW(), NOW())`,
          [adminId]
        );
        console.log(`Admin user created with ID: ${adminId}`);
      }
      
      console.log('Admin user seeded successfully.');
    } else {
      console.log('Admin user already exists. Skipping.');
    }
    
    // Create sample moderator user if not exists
    const checkModQuery = 'SELECT * FROM users WHERE role = $1 AND email = $2 LIMIT 1';
    const checkModResult = await client.query(checkModQuery, ['moderator', 'moderator@staycrest.com']);
    
    if (checkModResult.rows.length === 0) {
      console.log('Creating sample moderator user...');
      
      // Hash the password
      const modPassword = await bcrypt.hash('Moderator@2025', salt);
      
      // Create moderator user
      const insertModQuery = `
        INSERT INTO users (
          first_name, last_name, email, password, 
          role, is_verified, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id
      `;
      
      const insertModValues = [
        'Content',
        'Moderator',
        'moderator@staycrest.com',
        modPassword,
        'moderator',
        true
      ];
      
      const modResult = await client.query(insertModQuery, insertModValues);
      
      // Create default configuration for the moderator
      if (modResult.rows.length > 0) {
        const modId = modResult.rows[0].id;
        await client.query(
          `INSERT INTO configurations (user_id, created_at, updated_at) VALUES ($1, NOW(), NOW())`,
          [modId]
        );
        console.log(`Moderator user created with ID: ${modId}`);
      }
      
      console.log('Moderator user seeded successfully.');
    } else {
      console.log('Moderator user already exists. Skipping.');
    }
    
  } catch (error) {
    console.error('Error seeding admin users:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = seedAdminUsers; 