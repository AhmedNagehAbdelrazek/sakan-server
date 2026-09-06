const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { propertyTypes, requestTypes, requestStatus } = require('../config/constants');

class PropertyRequest extends Model {}

PropertyRequest.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  userId: {
    type: DataTypes.UUID,
    references: { model: 'users', key: 'id' },
    allowNull: false,
    field: 'user_id',
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  propertyType: {
    type: DataTypes.ENUM(...propertyTypes),
    allowNull: false,
    field: 'property_type',
  },
  phone:{
    type: DataTypes.STRING,
    allowNull: true,
  },
  requestType: {
    type: DataTypes.ENUM(...requestTypes),
    allowNull: false,
    field: 'request_type',
  },
  locationLat: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
    field: 'location_lat',
  },
  locationLong: {
    type: DataTypes.DECIMAL(10, 7),
    allowNull: true,
    field: 'location_long',
  },
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  major: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM(...requestStatus),
    allowNull: false,
    defaultValue: 'pending',
  },
}, {
  sequelize,
  modelName: 'PropertyRequest',
  tableName: 'property_requests',
});

module.exports = PropertyRequest;
