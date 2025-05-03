const { pool } = require('./connection');
const { runMigrations } = require('./migrate');
const { seedHotelData } = require('./seeds/hotel_data_seed');
const winston = require('winston');

// Configure logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/db_init.log' })
  ],
});

/**
 * Initialize the database
 */
async function initDatabase() {
  try {
    // Check database connection
    await pool.connect();
    logger.info('Database connection successful');
    
    // Run migrations
    logger.info('Running database migrations...');
    await runMigrations();
    
    // Seed the database
    logger.info('Seeding database with initial data...');
    await seedHotelData();
    
    logger.info('Database initialization completed successfully');
    return true;
  } catch (error) {
    logger.error(`Database initialization failed: ${error.message}`);
    return false;
  }
}

// Run if executed directly
if (require.main === module) {
  initDatabase()
    .then(success => {
      if (success) {
        console.log('Database initialization completed successfully');
      } else {
        console.error('Database initialization failed');
        process.exit(1);
      }
      process.exit(0);
    })
    .catch(error => {
      console.error('Unexpected error during database initialization:', error);
      process.exit(1);
    });
}

module.exports = initDatabase; 