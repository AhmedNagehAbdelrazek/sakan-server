const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const { paymentMethods, paymentStatus, currency } = require('../config/constants');

class Payment extends Model {}

Payment.init({
    id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
    },
    applicationId: {
        type: DataTypes.UUID,
        references: {
            model: 'applications',
            key: 'id',
        },
        allowNull: false,
        field: 'application_id',
    },
    studentId: {
        type: DataTypes.UUID,
        references: {
            model: 'users',
            key: 'id',
        },
        allowNull: false,
        field: 'student_id',
    },
    landlordId: {
        type: DataTypes.UUID,
        references: {
            model: 'users',
            key: 'id',
        },
        allowNull: false,
        field: 'landlord_id',
    },
    amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM(...paymentStatus),
        allowNull: false,
        defaultValue: paymentStatus[0],
    },
    method: {
        type: DataTypes.ENUM(...paymentMethods),
        allowNull: false,
        defaultValue: paymentMethods[0],
    },
    providerPaymentId: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    currency: {
        type: DataTypes.ENUM(...currency),
        allowNull: false,
    },
    releaseDate: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    
},{
    sequelize,
    modelName: 'Payment',
    tableName: 'payments',
})

module.exports = Payment;
