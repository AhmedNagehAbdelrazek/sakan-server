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
const Application = require("./application");


User.hasOne(UserProfile, { foreignKey: "userId" });
UserProfile.belongsTo(User, { foreignKey: "userId" });

User.hasMany(UserActivity, { foreignKey: "userId" });
UserActivity.belongsTo(User, { foreignKey: "userId" });

User.hasMany(UserPreference, { foreignKey: "userId" });
UserPreference.belongsTo(User, { foreignKey: "userId" });

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
FlatmateRequest.belongsTo(User, { foreignKey: "userId" });

User.hasMany(JoinInterest, { foreignKey: "userId" });
JoinInterest.belongsTo(User, { foreignKey: "userId" });

User.hasMany(Property, { foreignKey: "userId" });
Property.belongsTo(User, { foreignKey: "userId" });

User.hasMany(Application, { foreignKey: "userId" });
Application.belongsTo(User, { foreignKey: "userId" });

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
  Application,
};

