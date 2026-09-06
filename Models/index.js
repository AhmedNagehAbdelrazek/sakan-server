const Sequelize = require("sequelize");
const sequelize = require("../config/database");

const User = require("./user");
const UserProfile = require("./user_profile");
const UserActivity = require("./user_activity");
const UserPreference = require("./user_preference");
const Notification = require("./notification");
const Chat = require("./chat");
const Message = require("./message");

const FlatDemand = require("./flatDemand");
const FlatmateRequest = require("./flatmateRequest");
const JoinInterest = require("./joinInterest");
const Property = require("./property");
const PropertyRequest = require("./propertyRequest");
const Application = require("./application");
const Payment = require("./payment");


User.hasOne(UserProfile, { as: 'profile', foreignKey: "userId" });
UserProfile.belongsTo(User, { as: 'profile', foreignKey: "userId" });

User.hasMany(UserActivity, { foreignKey: "userId" });
UserActivity.belongsTo(User, { as: 'user', foreignKey: "userId" });

User.hasOne(UserPreference, { as: 'preferences', foreignKey: "userId" });
UserPreference.belongsTo(User, { as: 'preferences', foreignKey: "userId" });

User.hasMany(Notification, { foreignKey: "userId" });
Notification.belongsTo(User, { foreignKey: "userId" });


User.hasMany(Chat, { foreignKey: "user1_id" });
Chat.belongsTo(User, { foreignKey: "user1_id" });

User.hasMany(Chat, { foreignKey: "user2_id" });
Chat.belongsTo(User, { foreignKey: "user2_id" });

User.hasMany(Message, { foreignKey: "sender_id" });
Message.belongsTo(User, { foreignKey: "sender_id" });

User.hasMany(Message, { foreignKey: "receiver_id" });
Message.belongsTo(User, { foreignKey: "receiver_id" });

User.hasMany(FlatDemand, { foreignKey: "userId" });
FlatDemand.belongsTo(User, { foreignKey: "userId" });

User.hasMany(FlatmateRequest, { foreignKey: "userId" });
FlatmateRequest.belongsTo(User, { as: 'user', foreignKey: "userId" });

User.hasMany(JoinInterest, { foreignKey: "requesterId" });
JoinInterest.belongsTo(User, { as: 'requester', foreignKey: "requesterId" });

FlatmateRequest.hasMany(JoinInterest, { as: 'joinInterests', foreignKey: "flatmateRequestId" });
JoinInterest.belongsTo(FlatmateRequest, { foreignKey: "flatmateRequestId" });

User.hasMany(Property, { foreignKey: "userId" });
Property.belongsTo(User, { as: 'owner', foreignKey: "userId" });

User.hasMany(PropertyRequest, { foreignKey: "userId" });
PropertyRequest.belongsTo(User, { as: 'user', foreignKey: "userId" });

User.hasMany(Application, { foreignKey: "userId" });
Application.belongsTo(User, { as: 'user', foreignKey: "userId" });

Property.hasMany(Application, { foreignKey: 'propertyId' });
Application.belongsTo(Property, { foreignKey: 'propertyId' });

Application.hasMany(Payment, { foreignKey: 'applicationId' });
Payment.belongsTo(Application, { as: 'application', foreignKey: 'applicationId' });

User.hasMany(Payment, { foreignKey: "studentId" });
Payment.belongsTo(User, { as: 'student', foreignKey: "studentId" });

User.hasMany(Payment, { foreignKey: "landlordId" });
Payment.belongsTo(User, { as: 'landlord', foreignKey: "landlordId" });

module.exports = {
  sequelize,
  Sequelize,
  User,
  UserProfile,
  UserActivity,
  UserPreference,
  Notification,
  Chat,
  Message,
  FlatDemand,
  FlatmateRequest,
  JoinInterest,
  Property,
  PropertyRequest,
  Application,
  Payment,
};

