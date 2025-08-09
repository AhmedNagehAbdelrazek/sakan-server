const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class FlatmateRequest extends Model {}

FlatmateRequest.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    references: {
      model: 'users',
      key: 'id',
    },
    allowNull: false,
    field: 'user_id',
  },
  preferredBudget: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'preferred_budget',
  },
  preferredType: {
    type: DataTypes.ENUM(...require('../config/constants').propertyTypes),
    allowNull: false,
    field: 'preferred_type',
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  peopleWanted: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'people_wanted',
  },
  radiusKm: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'radius_km',
  },
  locationLat: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false,
    field: 'location_lat',
  },
  locationLong: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: false,
    field: 'location_long',
  },
  isMatched: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_matched',
  },
}, {
  sequelize,
  modelName: 'FlatmateRequest',
  tableName: 'flatmate_requests',
});

module.exports = FlatmateRequest;
