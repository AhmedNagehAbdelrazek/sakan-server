const { Model, DataTypes } = require('sequelize');

const sequelize = require('../config/database');

class Chat extends Model {}

Chat.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    user1_id: {
        type: DataTypes.UUID,
        references: {
            model: 'users',
            key: 'id',
        },
        allowNull: false,
        field: 'user1_id',
    },
    user2_id: {
        type: DataTypes.UUID,
        references: {
            model: 'users',
            key: 'id',
        },
        allowNull: false,
        field: 'user2_id',
    },
    last_message: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
},{
    sequelize,
    modelName: 'Chat',
    tableName: 'chats',
    timestamps: true,
})

module.exports = Chat;
