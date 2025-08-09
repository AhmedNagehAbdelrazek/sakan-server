const { Model, DataTypes } = require('sequelize');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const sequelize = require('../config/database');
const { roles } = require('../config/constants');

class User extends Model {
  correctOTP(otp){
    // retrun the comparison of the two string otps
    return otp === this.otp;
  }
  createPasswordResetToken(){
    const resetToken = crypto.randomBytes(32).toString('hex');
    this.passwordResetToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    this.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes from now
    return resetToken;
  }
  changedPasswordAfterTokenChanged(JWTTimeStamp) {
    if (this.passwordChangedAt) {
      const changedTimeStamp = parseInt(
        this.passwordChangedAt.getTime() / 1000,
        10
      );
      return JWTTimeStamp < changedTimeStamp;
    }
  
    // FALSE MEANS NOT CHANGED
    return false;
  };
  async comparePassword(password){
    return await bcrypt.compare(password, this.password_hash);
  }
}

User.init({
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  username: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING,
    unique: true,
    allowNull: false,
    validate:{
      validatePhoneNumber(value){
        if(!value.startsWith("01")){
          throw new Error("phone number has to start with 01");
        }
        if(value.length != 11){
          throw new Error("phone number has to be 11 number");
        }
      },
    }
  },
  password_hash: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  passwordChangedAt:{
    type: DataTypes.DATE,
    defaultValue: Date.now(),
    field: 'password_changed_at'
  },
  role: {
    type: DataTypes.ENUM(...roles),
    allowNull: false,
  },
  verified:{
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  otp_expiry_time: {
    type: DataTypes.DATE,
  },
  otp: {
    type: DataTypes.STRING,
  },
  passwordResetToken: {
    type: DataTypes.STRING,
    field: 'password_reset_token'
  },
  passwordResetExpires:{
    type: DataTypes.DATE,
    field: 'password_reset_expires'
  },
  online: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  socketId: {
    type: DataTypes.TEXT,
  },
}, {
  hooks:{
    beforeSave: async (user) => {
      if (user.changed('password_hash')) {
        user.password_hash = await bcrypt.hash(user.password_hash,4);
      }
    }
  },
  sequelize,
  modelName: 'User',
  tableName: 'users'
});


module.exports = User;
