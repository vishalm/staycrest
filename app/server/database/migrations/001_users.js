/**
 * Migration: Create users table
 */
module.exports = {
  up: async (db) => {
    await db.createCollection('users', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['email', 'role', 'isVerified', 'createdAt', 'updatedAt'],
          properties: {
            firstName: {
              bsonType: 'string',
              description: 'First name of the user'
            },
            lastName: {
              bsonType: 'string',
              description: 'Last name of the user'
            },
            email: {
              bsonType: 'string',
              description: 'Email address of the user'
            },
            password: {
              bsonType: 'string',
              description: 'Hashed password'
            },
            role: {
              enum: ['user', 'admin', 'premium'],
              description: 'User role for access control'
            },
            profilePicture: {
              bsonType: 'string',
              description: 'URL to profile picture'
            },
            googleId: {
              bsonType: 'string',
              description: 'Google OAuth ID'
            },
            facebookId: {
              bsonType: 'string',
              description: 'Facebook OAuth ID'
            },
            failedLoginAttempts: {
              bsonType: 'int',
              description: 'Number of failed login attempts'
            },
            accountLocked: {
              bsonType: 'bool',
              description: 'Whether the account is locked'
            },
            isVerified: {
              bsonType: 'bool',
              description: 'Whether the account is verified'
            },
            verificationToken: {
              bsonType: 'string',
              description: 'Token for email verification'
            },
            resetPasswordToken: {
              bsonType: 'string',
              description: 'Token for password reset'
            },
            resetPasswordExpires: {
              bsonType: 'date',
              description: 'Expiration date for password reset token'
            },
            lastLogin: {
              bsonType: 'date',
              description: 'Last login timestamp'
            },
            loyaltyAccounts: {
              bsonType: 'array',
              description: 'User\'s loyalty program accounts',
              items: {
                bsonType: 'object',
                required: ['programId', 'membershipId'],
                properties: {
                  programId: {
                    bsonType: 'string',
                    description: 'Loyalty program ID'
                  },
                  programName: {
                    bsonType: 'string',
                    description: 'Loyalty program name'
                  },
                  membershipId: {
                    bsonType: 'string',
                    description: 'Membership ID for the program'
                  },
                  tier: {
                    bsonType: 'string',
                    description: 'Membership tier'
                  },
                  points: {
                    bsonType: 'int',
                    description: 'Current points balance'
                  },
                  lastUpdated: {
                    bsonType: 'date',
                    description: 'Last update timestamp'
                  }
                }
              }
            },
            createdAt: {
              bsonType: 'date',
              description: 'Creation timestamp'
            },
            updatedAt: {
              bsonType: 'date',
              description: 'Last update timestamp'
            }
          }
        }
      }
    });

    // Create unique index for email
    await db.collection('users').createIndex({ email: 1 }, { unique: true });
    
    // Create indexes for OAuth IDs for faster lookup
    await db.collection('users').createIndex({ googleId: 1 });
    await db.collection('users').createIndex({ facebookId: 1 });
    
    // Create index for search by name
    await db.collection('users').createIndex({ firstName: 1, lastName: 1 });
  },

  down: async (db) => {
    await db.collection('users').drop();
  }
}; 