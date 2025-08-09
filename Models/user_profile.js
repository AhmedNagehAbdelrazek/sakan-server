const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { living_status, gender } = require('../config/constants');

class UserProfile extends Model {}

UserProfile.init({
  userId: {
    type: DataTypes.UUID,
    primaryKey: true,
    references: {
      model: 'users',
      key: 'id',
    },
    onDelete: 'CASCADE',
    field: 'userid',
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'first_name',
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'last_name',
  },
  bio: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  profilePicture: {
    type: DataTypes.BLOB,
    field: 'profile_picture',
  },
  university: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'university',
  },
  gender: {
    type: DataTypes.ENUM(...gender),
    defaultValue: gender[0],
    field: 'gender',
  },
  studyField: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'study_field',
  },
  living_status: {
    type: DataTypes.ENUM(...living_status),
    defaultValue: living_status[0],
    field: 'living_status',
  },
  budget: {
    type: DataTypes.INTEGER,
    defaultValue:0,
    field: 'budget',
  },
  location: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'location',
  },
  locationCoordinates: {
    type: DataTypes.JSON,
    allowNull: true,
    defaultValue: {
      lat: null,
      lng: null,
    },
    field: 'location_coordinates',
  },
}, {
  sequelize,
  modelName: 'UserProfile',
  tableName: 'user_profiles',
});

module.exports = UserProfile;
