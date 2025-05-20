import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User } from "@shared/schema";

declare global {
  namespace Express {
    interface User {
      user_id: string;
      email: string;
      password: string;
      user_type: string;
      user_points: number;
      user_level: number;
      is_active: boolean;
      created_at: string;
      profile?: {
        profile_id: string;
        user_id: string;
        display_name?: string;
        bio?: string;
        avatar_url?: string;
        timezone?: string;
        last_seen_at?: string;
      };
    }
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || 'shadow-me-secret-key',
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 * 7, // 1 week
      secure: false, // Setting to false for local development
      sameSite: "lax",
      httpOnly: true
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      {
        usernameField: 'email',
        passwordField: 'password'
      },
      async (email, password, done) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user || !(await comparePasswords(password, user.password))) {
            return done(null, false, { message: "Invalid email or password" });
          } else {
            return done(null, user);
          }
        } catch (err) {
          return done(err);
        }
      }
    )
  );

  passport.serializeUser((user, done) => done(null, user.user_id));
  passport.deserializeUser(async (id: string, done) => {
    try {
      const user = await storage.getUser(id);
      done(null, user);
    } catch (err) {
      done(err);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      // Check if user exists
      const existingUser = await storage.getUserByEmail(req.body.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already in use" });
      }

      // Create user with hashed password
      const hashedPassword = await hashPassword(req.body.password);
      
      const user = await storage.createUser({
        email: req.body.email,
        password: hashedPassword,
        display_name: req.body.display_name,
      });

      // Log the user in
      req.login(user, (err) => {
        if (err) return next(err);
        
        // Don't send the password back to the client
        const { password, ...userWithoutPassword } = user;
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log('POST /api/login - Attempt login with email:', req.body.email);
    
    passport.authenticate("local", (err: any, user: Express.User | false, info: { message: string } | undefined) => {
      if (err) {
        console.log('Login authentication error:', err);
        return next(err);
      }
      
      if (!user) {
        console.log('Login failed - Invalid credentials');
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      
      console.log('User authenticated successfully, calling req.login');
      
      req.login(user, (err) => {
        if (err) {
          console.log('Error during req.login:', err);
          return next(err);
        }
        
        console.log('Login successful, session established with ID:', req.sessionID);
        console.log('Session:', req.session);
        
        // Don't send the password back to the client
        const { password, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    console.log('POST /api/logout - Session ID:', req.sessionID);
    
    if (!req.isAuthenticated()) {
      console.log('Logout called but user was not authenticated');
      return res.status(200).json({ message: "Already logged out" });
    }
    
    const userId = req.user?.user_id;
    console.log(`Logging out user ${userId}`);
    
    req.logout((err) => {
      if (err) {
        console.log('Error during logout:', err);
        return next(err);
      }
      
      req.session.destroy((err) => {
        if (err) {
          console.log('Error destroying session:', err);
          return next(err);
        }
        
        console.log(`User ${userId} logged out successfully`);
        res.clearCookie('connect.sid');
        res.status(200).json({ message: "Logged out successfully" });
      });
    });
  });

  app.get("/api/user", (req, res) => {
    console.log('GET /api/user - isAuthenticated:', req.isAuthenticated(), 'Session ID:', req.sessionID);
    console.log('Session:', req.session);
    
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const { password, ...userWithoutPassword } = req.user;
    console.log('Authenticated user:', userWithoutPassword);
    res.status(200).json(userWithoutPassword);
  });
}

// Middleware to check if user is authenticated
export function isAuthenticated(req: Request, res: Response, next: NextFunction) {
  if (req.isAuthenticated()) {
    return next();
  }
  res.status(401).json({ message: "Authentication required" });
}

// Middleware to check if user has a specific role
export function isRole(role: string | string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    const userRoles = Array.isArray(role) ? role : [role];
    if (req.user && req.user.user_type && userRoles.includes(req.user.user_type)) {
      return next();
    }
    res.status(403).json({ message: "Forbidden: Insufficient permissions" });
  };
}
