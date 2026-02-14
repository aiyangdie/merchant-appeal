import express from 'express';
import sessionController from '../controllers/sessionController.js';
import { requireUser, optionalUser } from '../middleware/auth.js'; // We need to create 'optionalUser' in auth.js

const router = express.Router();

// Get info for a specific session (User optional but checked if present)
router.get('/:id/info', optionalUser, sessionController.getSessionInfo);

// Update a field in a session
router.put('/:id/field', optionalUser, sessionController.updateField);

// Get all sessions for a logged-in user (Moved from user routes if appropriate, or kept here)
// Original API: /api/user/:id/sessions -> This might belong in userRoutes or here.
// Let's put it here as /api/sessions/my-sessions or similar, or keep user-centric resource in userRoutes.
// However, the original structure was /api/user/:id/sessions. 
// If we want RESTful /api/sessions, we can filter by query string or use /my-history
// For now, let's just expose the controller method to be used by the main app router.

export default router;
