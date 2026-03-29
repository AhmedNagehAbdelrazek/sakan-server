const jwt = require('jsonwebtoken');

function signTestToken({ id }) {
  return jwt.sign({ id }, process.env.JWT_SECRET_KEY);
}

function authHeaderForUser(user) {
  const token = signTestToken({ id: user.id });
  return { Authorization: `Bearer ${token}` };
}

module.exports = {
  signTestToken,
  authHeaderForUser,
};
