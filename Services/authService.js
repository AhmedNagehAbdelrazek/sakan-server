
const { User, UserPreference, UserProfile, sequelize } = require('../Models/index.js');
const PickExistVars = require('../utils/PickExistVars.js');
const ApiError = require('../utils/ApiError.js');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const generateOTP = require('../utils/GenerateOTP.js');
const sendEmail = require('./EmailServices/Resend/SendEmail.js');
const sendSMS = require('./EmailServices/Brevo/SendSMS.js');


const SAFE_USER_FIELDS = [
    "id",
    "username",
    "email",
    "phone",
    "countryCode",
    "role",
    "verified",
];

function toSafeUser(user) {
    if (!user) return null;
    const plain = typeof user.get === "function" ? user.get({ plain: true }) : user;
    const safe = {};
    for (const key of SAFE_USER_FIELDS) {
        if (plain[key] !== undefined) safe[key] = plain[key];
    }
    return safe;
}

class AuthService {
    static async signToken(userId) {
        const user = await User.findByPk(userId);

        const payload = {
            id: user.id,
            username: user.username,
            role: user.role,
        };

        return jwt.sign(payload, process.env.JWT_SECRET_KEY);
    }

    static async register(data) {
        const { username, password, email, role, phone , countryCode} = data;
        const t = await sequelize.transaction();
        const newUser = await User.create({
            username,
            password_hash: password,
            email,
            phone,
            countryCode,
            role,
            verified: true,
        }, { transaction: t });
        // create the prefrances model to the user
        await UserPreference.create({
            userId: newUser.id,
        }, { transaction: t });

        const foundData = PickExistVars(data,
            ['firstName', 'lastName', 'bio', 'university', 'gender', 'studyField', 'living_status', 'budget', 'location', 'locationCoordinates']
        );
        // create user profile model
        await UserProfile.create({
            userId: newUser.id,
            ...foundData
        }, { transaction: t });

        await t.commit();
        return toSafeUser(newUser);
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

        if (email_not_taken) {
            if (!email_not_taken.verified) {
                throw new ApiError("You Need To verfiy your account", 400);
            }
            throw new ApiError("your email is already taken", 400);
        }
        if (name_not_taken) {
            throw new ApiError("your username is already taken", 400);
        }
        if (phone_not_taken) {
            throw new ApiError("your phone number is already taken", 400);
        }
    }

    static async login(email, password) {
        const user = await User.findOne({
            where: {
                email,
            },
            attributes: { include: ["id","email", "verified", "otp", "otp_expiry_time","role","active"] },
        });
        if (!user) {
            throw new ApiError("User not found", 404);
        }
        if (!user.verified) {
            if (user.otp && new Date(user.otp_expiry_time) > Date.now()) {
                throw new ApiError("You have already requested an OTP, verify your account", 400);
            } else {
                await this.sendOTP(user.id);
                throw new ApiError("your old token is expired, a new one has been sent to your email, check your email", 400);
            }
        }

        if (!user.active) {
            throw new ApiError("Account is deactivated", 401);
        }

        const isPasswordCorrect = await bcrypt.compare(password, user.password_hash);
        if (!isPasswordCorrect) {
            throw new ApiError("Password are wrong!", 404);
        }

        const token = await this.signToken(user.id);
        return {
            user: toSafeUser(user),
            role: user.role,
            token
        };
    }

    static async sendOTP(userId) {
        const user = await User.findByPk(userId,{
            attributes: { include: ["id","email", "verified", "otp", "otp_expiry_time","role","countryCode","phone"] },
        });

        if (!user) {
            throw new ApiError("User not found", 404);
        }

        if (user.verified) {
            throw new ApiError("Email is already verified", 400);
        }
        
        // if the token date is not expired
        if (!user.verified && user.otp && new Date(user.otp_expiry_time).getTime() > Date.now()) {
            throw new ApiError("You have already requested an OTP", 400);
        }

        const new_otp = generateOTP(6);
        console.log(new_otp);
        const otp_expiry_time = Date.now() + 5 * 60 * 1000; // 5 Mins after otp is sent
        // const otp_expiry_time = Date.now(); // 5 Mins after otp is sent

        // TODO send mail
        // await sendEmail(user.email, "Verification OTP", `Your OTP is ${new_otp}`);
        await Promise.all([
            // sendSMS(user.countryCode,user.phone, `Your OTP is ${new_otp}`),
            sendEmail(user.email, "Verification OTP", `Your OTP is ${new_otp}`)
        ]);
        
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
        await User.findByPk(userId,{
            attributes: { include: ["id","email"] },
        });
        
    }

    static async verifyOTP(email, otp) {
        const user = await User.findOne({
            where: {
                email,
                
            },
        });

        if (!user) {
            throw new ApiError("Email is invalid or OTP is expired", 400);
        }

        if (!user.otp_expiry_time || user.otp_expiry_time.getTime() < Date.now()) {
            throw new ApiError("OTP is expired, Please request a new one", 400);
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

        const verifiedUser = await User.findByPk(user.id);
        const token = await this.signToken(user.id);
        return {
            user: toSafeUser(verifiedUser || user),
            role: (verifiedUser || user).role,
            token
        };
    }

    static async forgotPassword(email) {
        const foundUser = await User.findOne({
            where: { email },
            attributes: { include: ["id", "email", "phone", "countryCode", "otp", "otp_expiry_time"] }
        });

        if (!foundUser) {
            throw new ApiError("There is no user with the given email address", 400);
        }

        if (foundUser.otp && foundUser.otp_expiry_time && new Date(foundUser.otp_expiry_time).getTime() > Date.now()) {
            throw new ApiError("OTP already sent. Please check your email or try again later", 400);
        }

        const otp = generateOTP(6);
        const otp_expiry_time = Date.now() + 5 * 60 * 1000; // 5 minutes
        console.log(`Password reset OTP for ${email}: ${otp}`);

        try {
            await Promise.all([
                // sendSMS(foundUser.countryCode, foundUser.phone, `Your password reset OTP is ${otp}`),
                sendEmail(foundUser.email, "Password Reset OTP", `Your password reset OTP is ${otp}. It expires in 5 minutes.`)
            ]);
        } catch (error) {
            console.log(error);
            throw new ApiError("There was an error sending the OTP. Please try again later", 500);
        }

        await User.update(
            { otp, otp_expiry_time },
            {
                where: { email },
                individualHooks: true,
            }
        );
    }

    static async verifyPasswordResetOtp(email, otp) {
        const user = await User.findOne({
            where: { email },
            attributes: { include: ["id", "email", "verified", "otp", "otp_expiry_time", "role"] }
        });

        if (!user) {
            throw new ApiError("Email is invalid", 400);
        }

        if (!user.otp_expiry_time || new Date(user.otp_expiry_time).getTime() < Date.now()) {
            throw new ApiError("OTP is expired. Please request a new one", 400);
        }

        if (!user.correctOTP(otp)) {
            throw new ApiError("The OTP is incorrect", 400);
        }

        // OTP verified - issue a short-lived JWT as the reset token
        const resetToken = jwt.sign(
            { id: user.id, purpose: "passwordReset" },
            process.env.JWT_SECRET_KEY,
            { expiresIn: "5m" }
        );

        await User.update(
            { otp: null, otp_expiry_time: null },
            {
                where: { email },
                individualHooks: true,
            }
        );

        return { resetToken };
    }

    static async resetPassword(resetToken, password) {
        if (!resetToken) {
            throw new ApiError("No reset token provided", 400);
        }

        let decoded;
        try {
            decoded = jwt.verify(resetToken, process.env.JWT_SECRET_KEY);
        } catch (error) {
            throw new ApiError("The reset token is invalid or has expired", 400);
        }

        if (decoded.purpose !== "passwordReset") {
            throw new ApiError("Invalid reset token", 400);
        }

        const foundUser = await User.findByPk(decoded.id, {
            attributes: { include: ["email", "password_hash"] },
        });

        if (!foundUser) {
            throw new ApiError("User not found", 404);
        }

        const isSamePassword = await bcrypt.compare(password, foundUser.password_hash);
        if (isSamePassword) {
            throw new ApiError("The new password must be different from the old one", 400);
        }

        await User.update(
            {
                password_hash: password,
                passwordChangedAt: Date.now(),
                passwordResetToken: null,
                passwordResetExpires: null,
            },
            {
                where: { email: foundUser.email },
                individualHooks: true,
            }
        );

        await sendEmail(
            foundUser.email,
            "Password Changed",
            "Your password has been changed successfully"
        );

        const updatedUser = await User.findByPk(foundUser.id);
        const token = await this.signToken(foundUser.id);
        return {
            user: toSafeUser(updatedUser || foundUser),
            role: (updatedUser || foundUser).role,
            token
        };
    }
}

module.exports = AuthService;
