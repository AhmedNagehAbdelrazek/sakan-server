const { User } = require('../Models');

async function seedAdmin() {
  if (process.env.ADMIN_AUTO_SEED !== 'true') {
    return;
  }

  const email = process.env.ADMIN_EMAIL || 'admin@admin.com';
  const password = process.env.ADMIN_PASSWORD;

  if (!password) {
    console.warn(
      'ADMIN_AUTO_SEED is enabled but ADMIN_PASSWORD is not set. ' +
        'Skipping admin seed.'
    );
    return;
  }

  const existingAdmin = await User.findOne({
    where: { role: 'super_admin' },
  });

  if (existingAdmin) {
    if (process.env.ADMIN_SEED_RESET_PASSWORD === 'true') {
      existingAdmin.password_hash = password;
      await existingAdmin.save();
      console.log('Super admin password has been reset.');
    }
    return;
  }

  const username = process.env.ADMIN_USERNAME || email.split('@')[0];
  const phone = process.env.ADMIN_PHONE || '0000000000';
  const countryCode = process.env.ADMIN_COUNTRY_CODE || '+20';

  await User.create({
    username,
    email,
    phone,
    countryCode,
    password_hash: password,
    role: 'super_admin',
    verified: true,
  });

  console.log('Super admin seeded successfully.');
}

module.exports = seedAdmin;
