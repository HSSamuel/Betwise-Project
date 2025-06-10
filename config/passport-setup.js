// In: config/passport-setup.js

const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const FacebookStrategy = require("passport-facebook").Strategy;
const User = require("../models/User"); // Adjust path as needed

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: `${process.env.API_CALLBACK_URL}/api/v1/auth/google/callback`,
    },
    async (accessToken, refreshToken, profile, done) => {
      // This is the "verify" callback function that runs after Google authenticates the user
      try {
        // Check if user already exists in our DB with this Google ID
        let user = await User.findOne({ googleId: profile.id });

        if (user) {
          // User exists, log them in
          return done(null, user);
        } else {
          // User doesn't exist, check if we can create one with their Google email
          user = await User.findOne({ email: profile.emails[0].value });
          if (user) {
            // User with this email exists (maybe registered with password before), link the Google account
            user.googleId = profile.id;
            await user.save();
            return done(null, user);
          } else {
            // No user found, create a new user in our DB
            const newUser = await new User({
              googleId: profile.id,
              username:
                profile.displayName.replace(/\s/g, "") +
                Math.floor(Math.random() * 1000), // Create a unique username
              email: profile.emails[0].value,
              firstName: profile.name.givenName,
              lastName: profile.name.familyName,
              // Password is not set for Google users
            }).save();
            return done(null, newUser);
          }
        }
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

passport.use(
  new FacebookStrategy(
    {
      clientID: process.env.FACEBOOK_APP_ID,
      clientSecret: process.env.FACEBOOK_APP_SECRET,
      callbackURL: `${process.env.API_CALLBACK_URL}/api/v1/auth/facebook/callback`,
      profileFields: ["id", "displayName", "emails", "name"],
    },
    async (accessToken, refreshToken, profile, done) => {
      // This logic is very similar to the Google strategy
      try {
        let user = await User.findOne({ facebookId: profile.id });
        if (user) return done(null, user);

        user = await User.findOne({ email: profile.emails[0].value });
        if (user) {
          user.facebookId = profile.id;
          await user.save();
          return done(null, user);
        }

        const newUser = await new User({
          facebookId: profile.id,
          username:
            profile.displayName.replace(/\s/g, "") +
            Math.floor(Math.random() * 1000),
          email: profile.emails[0].value,
          firstName: profile.name.givenName,
          lastName: profile.name.familyName,
        }).save();
        return done(null, newUser);
      } catch (error) {
        return done(error, false);
      }
    }
  )
);

// Note: We are using JWTs, so we don't need to serialize/deserialize the user into a session cookie.
// passport.serializeUser((user, done) => done(null, user.id));
// passport.deserializeUser((id, done) => User.findById(id, (err, user) => done(err, user)));
