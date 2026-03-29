const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { applicationStatus } = require('../config/constants');

class Application extends Model { }

Application.init({
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
    propertyId: {
        type: DataTypes.UUID,
        references: {
            model: 'properties',
            key: 'id',
        },
        allowNull: false,
        field: 'property_id',
    },
    isForSharing: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
        field: 'is_for_sharing',
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    totalAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0,
    },
    status: {
        type: DataTypes.ENUM(...applicationStatus),
        allowNull: false,
        defaultValue: 'pending',
    },
    approvedBy: {
        type: DataTypes.UUID,
        allowNull: true,
        field: 'approved_by',
    },
    approvedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'approved_at',
    },
    approvalExpiresAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'approval_expires_at',
    },
    paidAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'paid_at',
    },
    checkedInAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'checked_in_at',
    },
    completedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'completed_at',
    },
}, {
    sequelize,
    modelName: 'Application',
    tableName: 'applications',
})

module.exports = Application;
