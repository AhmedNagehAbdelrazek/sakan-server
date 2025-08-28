
const { User, UserPreference, UserProfile } = require('../Models/index.js');
const PickExistVars = require('../utils/PickExistVars.js');
const ApiError = require('../utils/ApiError.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const generateOTP = require('../utils/GenerateOTP.js');
const sendEmail = require('../Services/Mailer.js');
const { Op } = require("sequelize");
const crypto = require("crypto");

async function signToken(userId) {
  const user = await User.findByPk(userId);

  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
  };

  return jwt.sign(payload, process.env.JWT_SECRET_KEY);
}

class AuthService {
    static async register(data) {
        const { username, password, email, role, phone } = data;
        const newUser = await User.create({
            username,
            password_hash: password,
            email,
            role,
            phone,
        });
        // create the prefrances model to the user
        await UserPreference.create({
            userId: newUser.id,
        });

        const foundData = PickExistVars(data,
            ['firstName', 'lastName', 'bio', 'university', 'gender', 'studyField', 'living_status', 'budget', 'location', 'locationCoordinates']
        );
        // create user profile model
        await UserProfile.create({
            userId: newUser.id,
            ...foundData
        });
        return newUser;
    }

    static async checkUserDoesNotExists(user) {
        const { username, email, phone } = user;
        //validate username
        const name_not_taken = await User.findOne({
            where: {
                username,
            },
        });
        //validate email
        const email_not_taken = await User.findOne({
            where: {
                email,
            },
        });
        //validate phone
        const phone_not_taken = await User.findOne({
            where: {
                phone,
            },
        });

        if (email_not_taken || name_not_taken || phone_not_taken) {
            if (
                !email_not_taken.verified &&
                new Date(email_not_taken.otp_expiry_time) > Date.now()
            ) {
                // the account is not verified yet 
                // it need to send an otp again
                await this.sendOTP(email_not_taken.id);
                return email_not_taken.id;
            }
            if (
                !email_not_taken.verified &&
                new Date(email_not_taken.otp_expiry_time) < Date.now()
            ) {
                throw new ApiError("You Need To verfiy your account", 400);
            }
            throw new ApiError("you already have an account try logging in", 400);
        }
    }

    static async login(email, password) {
        const user = await User.findOne({
            where: {
                email,
            },
        });

        if (!user) {
            throw new ApiError("User not found", 404);
        }
        const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordCorrect) {
            throw new ApiError("Password are wrong!", 404);
        }

        const token = await signToken(user.id);
        return token;
    }

    static async sendOTP(userId) {
        const user = await User.findByPk(userId);

        if (user.verified) {
            throw new ApiError("Email is already verified", 400);
        }

        // if the token date is not expired
        if (
            !user.verified &&
            user.otp &&
            new Date(user.otp_expiry_time) < Date.now()
        ) {
            throw new ApiError("You have already requested an OTP", 400);
        }

        const new_otp = generateOTP(6);
        console.log(new_otp);
        const otp_expiry_time = Date.now() + 5 * 60 * 1000; // 5 Mins after otp is sent

        const affectedCount = await User.update(
            { otp: new_otp, otp_expiry_time },
            {
                where: {
                    id: userId,
                },
                individualHooks: true,
            }
        );
        if (affectedCount[0] == 0) {
            throw new ApiError("User not found", 404);
        }
        const updatedUser = await User.findByPk(userId);
        // TODO send mail
        sendEmail(updatedUser.email, "Verification OTP", `Your OTP is ${new_otp}`);
    }

    static async verifyOTP(email, otp) {
        const user = await User.findOne({
            where: {
                email,
                otp_expiry_time: {
                    [Op.gt]: Date.now(),
                },
            },
        });

        if (!user) {
            throw new ApiError("Email is invalid or OTP is expired", 400);
        }

        if (user.verified) {
            throw new ApiError("Email is already verified", 400);
        }

        if (!user.correctOTP(otp)) {
            throw new ApiError("The OTP is incorrect", 400);
        }

        // OTP is correct
        await User.update(
            {
                verified: true,
                otp: null,
                otp_expiry_time: null,
            },
            {
                where: {
                    email,
                },
                individualHooks: true,
            }
        );
        const token = await signToken(user.id);
        return token;
    }

    static async forgotPassword(email) {
        const foundUser = await User.findOne({ where: { email } });

        if (!foundUser) {
            throw new ApiError("There is no user wth the given email address", 400)
        }
        // Generate the random reset Token

        //https:// ...?code=asa5s1d5a4
        const resetToken = foundUser.createPasswordResetToken();
        const front_reset_password_url = process.env.FRONTEND_RESET_PASSWORD_URL;
        const resetUrl = `${front_reset_password_url}/?token=${resetToken}`;
        console.log(resetToken);
        try {
            await User.update(
                {
                    passwordResetToken: foundUser.passwordResetToken,
                    passwordResetExpires: foundUser.passwordResetExpires,
                },
                {
                    where: {
                        email,
                    },
                    individualHooks: true,
                }
            );

            sendEmail(
                foundUser.email,
                "Reset Password",
                `Your Reset Password Link is ${resetUrl}`
            );

        } catch (error) {
            await User.update(
                { passwordResetToken: null, passwordResetExpires: null },
                {
                    where: {
                        email,
                    },
                    individualHooks: true,
                }
            );
            console.log(error);
            throw new ApiError("there was an error sending the email, Please try again later", 500);
        }
    }

    static async resetPassword(resetToken, password) {
        if (!resetToken) {
            throw new ApiError("There is no token attatched to the request", 404)
        }
        const hashedToken = crypto
            .createHash("sha256")
            .update(resetToken)
            .digest("hex");

        const foundUser = await User.findOne({
            where: {
                passwordResetToken: hashedToken,
                passwordResetExpires: { [Op.gt]: Date.now() },
            },
            attributes: { include: ["email", "password_hash"] },
        });

        // if token has Expired
        if (!foundUser) {
            throw new ApiError("The token Has Expired", 400);
        }
        // check if the password differs from the saved one
        const isSamePassword = await bcrypt.compare(
            password,
            foundUser.password_hash
        );

        if (isSamePassword) {
            throw new ApiError("The new password must be different from the old one", 400)
        }

        // update user password and reset token
        await User.update(
            {
                password_hash: password,
                passwordChangedAt: Date.now(),
                passwordResetToken: null,
                passwordResetExpires: null,
            },
            {
                where: {
                    email: foundUser.email,
                },
                individualHooks: true,
            }
        );

        // Login the user and send Jwt
        sendEmail(
            foundUser.email,
            "Password Changed",
            `Your password has been changed successfully`
        );

        const token = await signToken(foundUser.id);
        return token;
    }
}

module.exports = AuthService;
