const bcrypt = require('bcryptjs');

/**
 * Initial seed data for the application
 */
module.exports = {
  /**
   * Seed admin user
   */
  async seedAdmin(db) {
    const adminExists = await db.collection('users').findOne({ email: 'admin@staycrest.com' });
    
    if (!adminExists) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('Admin@123', salt);
      
      await db.collection('users').insertOne({
        firstName: 'Admin',
        lastName: 'User',
        email: 'admin@staycrest.com',
        password: hashedPassword,
        role: 'admin',
        isVerified: true,
        failedLoginAttempts: 0,
        accountLocked: false,
        profilePicture: '/assets/images/default-avatar.png',
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      console.log('Admin user seeded successfully');
    } else {
      console.log('Admin user already exists, skipping seed');
    }
  },
  
  /**
   * Seed demo user
   */
  async seedDemoUser(db) {
    const demoExists = await db.collection('users').findOne({ email: 'demo@staycrest.com' });
    
    if (!demoExists) {
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash('Demo@123', salt);
      
      const demoUser = {
        firstName: 'Demo',
        lastName: 'User',
        email: 'demo@staycrest.com',
        password: hashedPassword,
        role: 'user',
        isVerified: true,
        failedLoginAttempts: 0,
        accountLocked: false,
        profilePicture: '/assets/images/demo-avatar.png',
        loyaltyAccounts: [
          {
            programId: 'marriott-bonvoy',
            programName: 'Marriott Bonvoy',
            membershipId: 'DEMO123456',
            tier: 'Gold',
            points: 45000,
            lastUpdated: new Date()
          },
          {
            programId: 'hilton-honors',
            programName: 'Hilton Honors',
            membershipId: 'DH789012',
            tier: 'Silver',
            points: 35000,
            lastUpdated: new Date()
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.collection('users').insertOne(demoUser);
      
      // Create configuration for demo user
      await db.collection('configurations').insertOne({
        userId: result.insertedId.toString(),
        preferredLoyaltyPrograms: ['marriott-bonvoy', 'hilton-honors'],
        defaultSearchParameters: {
          adults: 2,
          children: 0,
          rooms: 1
        },
        uiPreferences: {
          theme: 'system',
          fontSize: 'medium',
          language: 'en',
          showHelpTips: true,
          voiceEnabled: true
        },
        sortingPreferences: {
          sortBy: 'loyaltyValue',
          sortOrder: 'desc'
        },
        notificationSettings: {
          email: true,
          push: true,
          dealAlerts: true
        },
        createdAt: new Date(),
        updatedAt: new Date()
      });
      
      // Create sample searches for demo user
      await db.collection('search_history').insertMany([
        {
          userId: result.insertedId.toString(),
          query: 'Hotels in New York',
          parameters: {
            location: 'New York',
            checkIn: '2023-12-10',
            checkOut: '2023-12-15',
            guests: 2,
            rooms: 1
          },
          loyaltyPrograms: ['marriott-bonvoy', 'hilton-honors'],
          isSaved: true,
          savedName: 'December NYC Trip',
          createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
        },
        {
          userId: result.insertedId.toString(),
          query: 'Luxury hotels in Miami',
          parameters: {
            location: 'Miami',
            checkIn: '2024-01-15',
            checkOut: '2024-01-20',
            guests: 2,
            rooms: 1,
            stars: 5
          },
          loyaltyPrograms: ['marriott-bonvoy'],
          isSaved: false,
          createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) // 3 days ago
        }
      ]);
      
      console.log('Demo user seeded successfully');
    } else {
      console.log('Demo user already exists, skipping seed');
    }
  },
  
  /**
   * Run all seed functions
   */
  async runAll(db) {
    await this.seedAdmin(db);
    await this.seedDemoUser(db);
    console.log('All seed data created successfully');
  }
}; 