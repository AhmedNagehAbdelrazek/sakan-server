const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class JoinInterest extends Model {}

JoinInterest.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  requesterId: {
    type: DataTypes.UUID,
    references: {
      model: 'users',
      key: 'id',
    },
    allowNull: false,
    field: 'requester_id',
  },
  flatmateRequestId: {
    type: DataTypes.UUID,
    references: {
      model: 'flatmate_requests',
      key: 'id',
    },
    allowNull: false,
    field: 'flatmate_request_id',
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
    allowNull: false,
    defaultValue: 'pending',
  },
}, {
  sequelize,
  modelName: 'JoinInterest',
  tableName: 'join_interests',
});

module.exports = JoinInterest;
