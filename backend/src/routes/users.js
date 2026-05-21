const router = require('express').Router();
const bcrypt = require('bcryptjs');
const pool = require('../db');
const { requireAdmin } = require('../middleware/auth');

// All routes require admin
router.use(requireAdmin);

// List all users
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, email, name, role, is_active, created_at FROM users ORDER BY created_at ASC'
    );
    res.json({ users: rows });
  } catch (err) {
    console.error('List users error:', err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Create new user
router.post('/', async (req, res) => {
  const { email, name, password, role } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });
  if (!['staff', 'admin', 'demo'].includes(role)) return res.status(400).json({ error: 'Role must be staff, admin, or demo' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rows } = await pool.query(
      'INSERT INTO users (email, name, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role, is_active, created_at',
      [email.toLowerCase().trim(), name?.trim() || null, hash, role]
    );
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'A user with this email already exists' });
    console.error('Create user error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Reset password
router.put('/:id/password', async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  try {
    const hash = await bcrypt.hash(password, 10);
    const { rowCount } = await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hash, req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'User not found' });
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Reset password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// Update role
router.put('/:id/role', async (req, res) => {
  const { role } = req.body;
  if (!['staff', 'admin', 'demo'].includes(role)) return res.status(400).json({ error: 'Role must be staff, admin, or demo' });

  try {
    const { rows, rowCount } = await pool.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, email, role',
      [role, req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Update role error:', err);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

// Activate / deactivate
router.put('/:id/status', async (req, res) => {
  const { is_active } = req.body;
  if (typeof is_active !== 'boolean') return res.status(400).json({ error: 'is_active must be true or false' });

  // Prevent admin from deactivating their own account
  if (req.params.id === req.user.id && !is_active) {
    return res.status(400).json({ error: 'You cannot deactivate your own account' });
  }

  try {
    const { rows, rowCount } = await pool.query(
      'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, email, is_active',
      [is_active, req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'User not found' });
    res.json({ user: rows[0] });
  } catch (err) {
    console.error('Update status error:', err);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

module.exports = router;
