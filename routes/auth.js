const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { queries } = require('../database');
const { authenticate, requireAdmin, generateToken } = require('../middleware/auth');

// Register - first user becomes admin, rest are viewers
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email and password are required' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check if user already exists
    const existingEmail = queries.getUserByEmail(email);
    if (existingEmail) {
      return res.status(409).json({ error: 'Email already registered' });
    }
    const existingUsername = queries.getUserByUsername(username);
    if (existingUsername) {
      return res.status(409).json({ error: 'Username already taken' });
    }

    // First user is admin, rest are viewers
    const userCount = queries.getUserCount();
    const role = userCount.count === 0 ? 'admin' : 'viewer';

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = queries.insertUser({
      username: username.trim(),
      email: email.trim().toLowerCase(),
      password: hashedPassword,
      role
    });

    const user = queries.getUserById(result.lastId);
    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = queries.getUserByEmail(email.trim().toLowerCase());
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = generateToken(user);

    res.json({
      success: true,
      token,
      user: { id: user.id, username: user.username, email: user.email, role: user.role }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get current user info
router.get('/me', authenticate, (req, res) => {
  const user = queries.getUserById(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json(user);
});

// Check if any users exist (for showing register vs login)
router.get('/status', (req, res) => {
  const count = queries.getUserCount();
  res.json({ hasUsers: count.count > 0 });
});

// Admin: list all users
router.get('/users', authenticate, requireAdmin, (req, res) => {
  const users = queries.listUsers();
  res.json(users);
});

// Admin: update user role
router.put('/users/:id/role', authenticate, requireAdmin, (req, res) => {
  const { role } = req.body;
  if (!['admin', 'viewer'].includes(role)) {
    return res.status(400).json({ error: 'Role must be admin or viewer' });
  }
  // Don't let admin demote themselves
  if (parseInt(req.params.id) === req.user.id && role !== 'admin') {
    return res.status(400).json({ error: 'Cannot change your own role' });
  }
  queries.updateUserRole({ id: parseInt(req.params.id), role });
  const user = queries.getUserById(parseInt(req.params.id));
  res.json(user);
});

// Admin: delete user
router.delete('/users/:id', authenticate, requireAdmin, (req, res) => {
  if (parseInt(req.params.id) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }
  queries.deleteUser(parseInt(req.params.id));
  res.json({ success: true });
});

module.exports = router;
