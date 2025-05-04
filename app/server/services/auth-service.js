const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const JwtStrategy = require('passport-jwt').Strategy;
const { ExtractJwt } = require('passport-jwt');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/user');
const winston = require('winston');

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/auth.log' })
  ],
});

// Serialize user to session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});

// Local Strategy for username/password login
passport.use(
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    async (email, password, done) => {
      try {
        // Find user by email
        const user = await User.findOne({ email }).select('+password');
        
        // No user found with that email
        if (!user) {
          return done(null, false, { message: 'Invalid email or password' });
        }
        
        // Check if account is locked
        if (user.accountLocked) {
          return done(null, false, { message: 'Account locked. Please reset your password.' });
        }
        
        // Check if password matches
        const isMatch = await user.matchPassword(password);
        
        if (!isMatch) {
          // Increment failed login attempts
          user.failedLoginAttempts += 1;
          
          // Lock account after 5 failed attempts
          if (user.failedLoginAttempts >= 5) {
            user.accountLocked = true;
            logger.warn(`Account locked for user: ${user.email} after 5 failed login attempts`);
          }
          
          await user.save();
          return done(null, false, { message: 'Invalid email or password' });
        }
        
        // Update last login time and reset failed attempts
        await user.updateLastLogin();
        
        return done(null, user);
      } catch (err) {
        logger.error(`Login error: ${err.message}`);
        return done(err);
      }
    }
  )
);

// JWT Strategy for API authentication
passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_SECRET || 'your_jwt_secret_key_here',
    },
    async (jwtPayload, done) => {
      try {
        const user = await User.findById(jwtPayload.id);
        
        if (!user) {
          return done(null, false);
        }
        
        return done(null, user);
      } catch (err) {
        logger.error(`JWT verification error: ${err.message}`);
        return done(err, false);
      }
    }
  )
);

// Configure Google OAuth Strategy if enabled
if (process.env.ENABLE_SOCIAL_LOGIN === 'true' && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: '/api/auth/google/callback',
        proxy: true,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists
          let user = await User.findOne({ googleId: profile.id });
          
          if (!user) {
            // Check if user with same email exists
            const existingUser = await User.findOne({ email: profile.emails[0].value });
            
            if (existingUser) {
              // Link Google account to existing user
              existingUser.googleId = profile.id;
              if (!existingUser.profilePicture && profile.photos && profile.photos.length > 0) {
                existingUser.profilePicture = profile.photos[0].value;
              }
              await existingUser.save();
              return done(null, existingUser);
            }
            
            // Create new user
            user = await User.create({
              googleId: profile.id,
              email: profile.emails[0].value,
              firstName: profile.name.givenName,
              lastName: profile.name.familyName,
              profilePicture: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : undefined,
              isVerified: true, // Email is verified through Google
            });
            
            logger.info(`New user created via Google: ${user.email}`);
          }
          
          // Update last login time
          await user.updateLastLogin();
          
          return done(null, user);
        } catch (err) {
          logger.error(`Google OAuth error: ${err.message}`);
          return done(err, false);
        }
      }
    )
  );
}

// Configure Facebook OAuth Strategy if enabled
if (process.env.ENABLE_SOCIAL_LOGIN === 'true' && process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
  passport.use(
    new FacebookStrategy(
      {
        clientID: process.env.FACEBOOK_APP_ID,
        clientSecret: process.env.FACEBOOK_APP_SECRET,
        callbackURL: '/api/auth/facebook/callback',
        profileFields: ['id', 'email', 'name', 'picture.type(large)'],
        proxy: true,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          // Check if user already exists
          let user = await User.findOne({ facebookId: profile.id });
          
          if (!user) {
            // Facebook doesn't always return email, so we need to handle that case
            if (!profile.emails || profile.emails.length === 0) {
              return done(null, false, { message: 'Email is required. Please check your Facebook privacy settings.' });
            }
            
            // Check if user with same email exists
            const existingUser = await User.findOne({ email: profile.emails[0].value });
            
            if (existingUser) {
              // Link Facebook account to existing user
              existingUser.facebookId = profile.id;
              if (!existingUser.profilePicture && profile.photos && profile.photos.length > 0) {
                existingUser.profilePicture = profile.photos[0].value;
              }
              await existingUser.save();
              return done(null, existingUser);
            }
            
            // Create new user
            user = await User.create({
              facebookId: profile.id,
              email: profile.emails[0].value,
              firstName: profile.name.givenName,
              lastName: profile.name.familyName,
              profilePicture: profile.photos && profile.photos.length > 0 ? profile.photos[0].value : undefined,
              isVerified: true, // Email is verified through Facebook
            });
            
            logger.info(`New user created via Facebook: ${user.email}`);
          }
          
          // Update last login time
          await user.updateLastLogin();
          
          return done(null, user);
        } catch (err) {
          logger.error(`Facebook OAuth error: ${err.message}`);
          return done(err, false);
        }
      }
    )
  );
}

// Authentication middleware for protected routes
const protect = passport.authenticate('jwt', { session: false });

// Role-based authorization middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: 'Not authorized to access this resource',
      });
    }

    next();
  };
};

module.exports = { passport, protect, authorize }; 