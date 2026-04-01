const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const {
  housingNeedRequestStatus,
  housingNeedRequestTypes,
} = require('../config/constants');

class HousingNeedRequest extends Model {}

HousingNeedRequest.init(
  {
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
    area: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    areaNormalized: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'area_normalized',
    },
    housingType: {
      type: DataTypes.ENUM(...housingNeedRequestTypes),
      allowNull: false,
      field: 'housing_type',
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(...housingNeedRequestStatus),
      allowNull: false,
      defaultValue: housingNeedRequestStatus[0],
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'reviewed_at',
    },
    reviewedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'reviewed_by',
    },
    closedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'closed_at',
    },
    closedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'closed_by',
    },
  },
  {
    sequelize,
    modelName: 'HousingNeedRequest',
    tableName: 'housing_need_requests',
    indexes: [
      {
        fields: ['user_id', 'area_normalized', 'housing_type', 'createdat'],
      },
      {
        fields: ['status', 'createdat'],
      },
    ],
  }
);

module.exports = HousingNeedRequest;
