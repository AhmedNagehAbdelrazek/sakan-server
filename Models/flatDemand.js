const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class FlatDemand extends Model { }

FlatDemand.init({
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
    message: {
        type: DataTypes.TEXT,
        allowNull: true,
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
    radiusKm: {
        type: DataTypes.INTEGER,
        allowNull: false,
        field: 'radius_km',
    },
    status: {
        type: DataTypes.ENUM('open', 'fulfilled', 'closed'),
        allowNull: false,
        defaultValue: 'open',
    }
}, {
    sequelize,
    modelName: 'FlatDemand',
    tableName: 'flat_demands',
});

module.exports = FlatDemand;