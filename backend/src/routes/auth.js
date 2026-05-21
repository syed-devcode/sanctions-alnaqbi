const router = require('express').Router();
const jwt = require('jsonwebtoken');
const pool = require('../db');

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password required' });
  }

  try {
    console.log('Login attempt:', email);

    const { rows } = await pool.query(
      `SELECT id, email, name, role, is_active
       FROM users
       WHERE email = $1
         AND password_hash = crypt($2, password_hash)
         AND is_active = true`,
      [email.toLowerCase().trim(), password]
    );

    const user = rows[0];
    console.log('User found:', user ? { id: user.id, email: user.email, role: user.role } : null);

    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
