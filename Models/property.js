const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { propertyTypes } = require('../config/constants');

class Property extends Model {}

Property.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  pricePerMonth: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false,
    field: 'price_per_month',
  },
  totalRooms: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'total_rooms',
  },
  availableRooms: {
    type: DataTypes.INTEGER,
    allowNull: false,
    field: 'available_rooms',
  },
  type: {
    type: DataTypes.ENUM(...propertyTypes),
    allowNull: false,
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
  address: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  amenities: {
    type: DataTypes.JSONB,
    allowNull: false,
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
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
  },
}, {
  sequelize,
  modelName: 'Property',
  tableName: 'properties',
});

module.exports = Property;
