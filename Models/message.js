const { Model, DataTypes } = require('sequelize');

const sequelize = require('../config/database');

class Message extends Model {}

Message.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    sender_id: {
        type: DataTypes.UUID,
        references: {
            model: 'users',
            key: 'id',
        },
        allowNull: false,
        field: 'sender_id',
    },
    chat_id: {
        type: DataTypes.UUID,
        references: {
            model: 'chats',
            key: 'id',
        },
        allowNull: false,
        field: 'chat_id',
    },
    message: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
},{
    sequelize,
    modelName: 'Message',
    tableName: 'messages',
    timestamps: true,
})

module.exports = Message;
