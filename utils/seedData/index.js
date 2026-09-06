const {
  User,
  UserProfile,
  UserPreference,
  Property,
  Application,
  Payment,
  FlatmateRequest,
  JoinInterest,
  PropertyRequest,
  Chat,
  Message,
  Notification,
  UserActivity,
} = require('../../Models');

const { upsertByKey, findOrCreate, SEED_PASSWORD } = require('./helpers');
const data = require('./data');

async function seedUsers() {
  for (const user of data.users) {
    await upsertByKey(
      User,
      'email',
      user.email,
      {
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        countryCode: user.countryCode,
        password_hash: SEED_PASSWORD,
        role: user.role,
        verified: true,
      },
      { excludeOnUpdate: ['password_hash'] }
    );
  }
}

async function seedProfiles() {
  for (const profile of data.profiles) {
    await upsertByKey(UserProfile, 'id', profile.id, profile);
  }
}

async function seedPreferences() {
  for (const preference of data.preferences) {
    await upsertByKey(UserPreference, 'id', preference.id, preference);
  }
}

async function seedProperties() {
  for (const property of data.properties) {
    await upsertByKey(Property, 'id', property.id, property);
  }
}

async function seedApplications() {
  for (const application of data.applications) {
    await upsertByKey(Application, 'id', application.id, application);
  }
}

async function seedPayments() {
  for (const payment of data.payments) {
    await upsertByKey(Payment, 'id', payment.id, payment);
  }
}

async function seedFlatmateRequests() {
  for (const request of data.flatmateRequests) {
    await upsertByKey(FlatmateRequest, 'id', request.id, request);
  }
}

async function seedJoinInterests() {
  for (const interest of data.joinInterests) {
    await upsertByKey(JoinInterest, 'id', interest.id, interest);
  }
}

async function seedPropertyRequests() {
  for (const request of data.propertyRequests) {
    await upsertByKey(PropertyRequest, 'id', request.id, request);
  }
}

async function seedChats() {
  for (const chat of data.chats) {
    await upsertByKey(Chat, 'id', chat.id, chat);
  }
}

async function seedMessages() {
  for (const message of data.messages) {
    await upsertByKey(Message, 'id', message.id, message);
  }
}

async function seedNotifications() {
  for (const notification of data.notifications) {
    await findOrCreate(
      Notification,
      {
        userId: notification.userId,
        notificationType: notification.notificationType,
      },
      notification
    );
  }
}

async function seedActivities() {
  for (const activity of data.activities) {
    await findOrCreate(
      UserActivity,
      {
        userId: activity.userId,
        activityType: activity.activityType,
      },
      activity
    );
  }
}

async function seedDemoData() {
  if (process.env.SEED_DEMO_DATA === 'false') {
    return;
  }

  console.log('Seeding demo data...');

  await seedUsers();
  await seedProfiles();
  await seedPreferences();
  await seedProperties();
  await seedApplications();
  await seedPayments();
  await seedFlatmateRequests();
  await seedJoinInterests();
  await seedPropertyRequests();
  await seedChats();
  await seedMessages();
  await seedNotifications();
  await seedActivities();

  console.log('Demo data seeded.');
}

module.exports = seedDemoData;
