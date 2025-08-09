const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

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
    status: {
        type: DataTypes.ENUM('pending', 'approved', 'rejected'),
        allowNull: false,
        defaultValue: 'pending',
    },},{
    sequelize,
    modelName: 'Application',
    tableName: 'applications',
})

module.exports = Application;
