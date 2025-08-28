module.exports = {
    roles: ["student", "landlord", "admin", "super_admin", "manager"],
    signin_roles: ["student", "landlord"],
    activitiesTypes: [
        "login",
        "logout",
    ],
    living_status: ["alone", "with_family"],
    gender: ["male", "female"],
    propertyTypes: ["flat", "room"],
    applicationStatus: ['pending', 'approved', 'paid','checked-in', 'rejected'],
    paymentStatus: ['pending', 'received', 'released', 'refunded'],
    paymentMethods: ['card', 'wallet', 'cash', 'transfer'],
};