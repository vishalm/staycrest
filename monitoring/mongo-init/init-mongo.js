// Create application database and user
db = db.getSiblingDB('staycrest');

// Create application user
db.createUser({
  user: 'staycrest_app',
  pwd: 'staycrest_app_password',
  roles: [
    { role: 'readWrite', db: 'staycrest' },
    { role: 'dbAdmin', db: 'staycrest' }
  ]
});

// Create read-only user for analytics
db.createUser({
  user: 'staycrest_readonly',
  pwd: 'staycrest_readonly_password',
  roles: [
    { role: 'read', db: 'staycrest' }
  ]
});

// Create collections with validation
db.createCollection('users', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['email', 'password', 'role', 'createdAt'],
      properties: {
        email: {
          bsonType: 'string',
          pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$'
        },
        password: { bsonType: 'string' },
        role: { enum: ['user', 'admin', 'superadmin'] },
        firstName: { bsonType: 'string' },
        lastName: { bsonType: 'string' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('hotels', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'location', 'rating', 'createdAt'],
      properties: {
        name: { bsonType: 'string' },
        description: { bsonType: 'string' },
        location: {
          bsonType: 'object',
          required: ['city', 'country'],
          properties: {
            address: { bsonType: 'string' },
            city: { bsonType: 'string' },
            state: { bsonType: 'string' },
            country: { bsonType: 'string' },
            zipCode: { bsonType: 'string' },
            coordinates: {
              bsonType: 'object',
              required: ['latitude', 'longitude'],
              properties: {
                latitude: { bsonType: 'double' },
                longitude: { bsonType: 'double' }
              }
            }
          }
        },
        rating: { bsonType: 'double' },
        amenities: { bsonType: 'array' },
        images: { bsonType: 'array' },
        priceRange: {
          bsonType: 'object',
          properties: {
            min: { bsonType: 'double' },
            max: { bsonType: 'double' },
            currency: { bsonType: 'string' }
          }
        },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('reviews', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['hotelId', 'userId', 'rating', 'text', 'createdAt'],
      properties: {
        hotelId: { bsonType: 'objectId' },
        userId: { bsonType: 'objectId' },
        rating: { bsonType: 'double' },
        text: { bsonType: 'string' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('bookings', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['hotelId', 'userId', 'checkIn', 'checkOut', 'status', 'createdAt'],
      properties: {
        hotelId: { bsonType: 'objectId' },
        userId: { bsonType: 'objectId' },
        checkIn: { bsonType: 'date' },
        checkOut: { bsonType: 'date' },
        guests: { bsonType: 'int' },
        totalPrice: { bsonType: 'double' },
        status: { enum: ['pending', 'confirmed', 'cancelled', 'completed'] },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('loyalty', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['userId', 'program', 'points', 'createdAt'],
      properties: {
        userId: { bsonType: 'objectId' },
        program: { bsonType: 'string' },
        points: { bsonType: 'double' },
        tier: { bsonType: 'string' },
        expiryDate: { bsonType: 'date' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

// Create indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });

db.hotels.createIndex({ name: 1 });
db.hotels.createIndex({ "location.city": 1 });
db.hotels.createIndex({ "location.country": 1 });
db.hotels.createIndex({ rating: 1 });
db.hotels.createIndex({ 
  "location.coordinates": "2dsphere" 
});

db.reviews.createIndex({ hotelId: 1 });
db.reviews.createIndex({ userId: 1 });
db.reviews.createIndex({ rating: 1 });

db.bookings.createIndex({ hotelId: 1 });
db.bookings.createIndex({ userId: 1 });
db.bookings.createIndex({ checkIn: 1 });
db.bookings.createIndex({ checkOut: 1 });
db.bookings.createIndex({ status: 1 });

db.loyalty.createIndex({ userId: 1 });
db.loyalty.createIndex({ program: 1 });
db.loyalty.createIndex({ points: 1 });

// Create admin user if not exists
if (db.users.countDocuments({ role: 'superadmin' }) === 0) {
  db.users.insertOne({
    email: 'admin@staycrest.com',
    password: '$2a$10$EncryptedPasswordHash',  // Replace with bcrypt hash in production
    firstName: 'Admin',
    lastName: 'User',
    role: 'superadmin',
    createdAt: new Date(),
    updatedAt: new Date()
  });
}

// Print completion message
print('MongoDB initialization completed successfully'); 