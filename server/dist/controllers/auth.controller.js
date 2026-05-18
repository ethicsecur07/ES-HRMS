"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateMe = exports.getMe = exports.logout = exports.login = void 0;
const User_js_1 = require("../models/User.js");
const Employee_js_1 = require("../models/Employee.js");
const jwt_js_1 = require("../utils/jwt.js");
const auditLog_service_js_1 = require("../services/auditLog.service.js");
const login = async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) {
        res.status(400).json({ message: 'Email and password are required' });
        return;
    }
    const normalizedEmail = email.toLowerCase().trim();
    try {
        // 1. Permanent Admin Hardcoded Check
        if (normalizedEmail === 'official@ethicsecur.co.in') {
            if (password !== 'Ethicsecur@2024') {
                res.status(401).json({ message: 'Invalid Admin email or password' });
                return;
            }
            let adminUser = await User_js_1.User.findOne({ email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') } });
            if (!adminUser) {
                adminUser = await User_js_1.User.create({
                    name: 'Abishek',
                    email: 'Official@ethicsecur.co.in',
                    password: 'Ethicsecur@2024',
                    role: 'ADMIN',
                    isActive: true,
                });
            }
            adminUser.lastLogin = new Date();
            await adminUser.save();
            const token = (0, jwt_js_1.generateToken)({ id: adminUser.id, role: adminUser.role, email: adminUser.email });
            await (0, auditLog_service_js_1.createAuditLog)('USER_LOGIN', `${adminUser.name} (ADMIN)`, 'AUTH', 'User Session', `Logged in from IP ${req.ip}`);
            res.status(200).json({ user: adminUser, token });
            return;
        }
        // 2. Permanent HR Hardcoded Check
        if (normalizedEmail === 'oviya@ethicsecur.com') {
            if (password !== 'Ovi@2003') {
                res.status(401).json({ message: 'Invalid HR email or password' });
                return;
            }
            let hrUser = await User_js_1.User.findOne({ email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') } });
            if (!hrUser) {
                hrUser = await User_js_1.User.create({
                    name: 'Oviya',
                    email: 'oviya@ethicsecur.com',
                    password: 'Ovi@2003',
                    role: 'HR',
                    isActive: true,
                });
            }
            hrUser.lastLogin = new Date();
            await hrUser.save();
            const token = (0, jwt_js_1.generateToken)({ id: hrUser.id, role: hrUser.role, email: hrUser.email });
            await (0, auditLog_service_js_1.createAuditLog)('USER_LOGIN', `${hrUser.name} (HR)`, 'AUTH', 'User Session', `Logged in from IP ${req.ip}`);
            res.status(200).json({ user: hrUser, token });
            return;
        }
        // 3. Employee Login Check (must already exist in DB, created by HR/Admin)
        const user = await User_js_1.User.findOne({ email: { $regex: new RegExp(`^${normalizedEmail}$`, 'i') } }).select('+password');
        if (!user) {
            res.status(401).json({ message: 'Account does not exist. Employee accounts are created only by HR and Admin.' });
            return;
        }
        // Security check: Ensure this user is not trying to be ADMIN or HR
        if (user.role === 'ADMIN' || user.role === 'HR') {
            res.status(403).json({ message: 'Unauthorized role access for this email.' });
            return;
        }
        if (user.password !== password) {
            res.status(401).json({ message: 'Invalid email or password' });
            return;
        }
        if (!user.isActive) {
            res.status(403).json({ message: 'Account is deactivated. Please contact HR.' });
            return;
        }
        user.lastLogin = new Date();
        await user.save();
        const token = (0, jwt_js_1.generateToken)({ id: user.id, role: user.role, email: user.email });
        await (0, auditLog_service_js_1.createAuditLog)('USER_LOGIN', `${user.name} (${user.role})`, 'AUTH', 'User Session', `Logged in from IP ${req.ip}`);
        res.status(200).json({ user, token });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.login = login;
const logout = async (req, res) => {
    if (req.user) {
        await (0, auditLog_service_js_1.createAuditLog)('USER_LOGOUT', req.user.email, 'AUTH', 'User Session', 'Logged out');
    }
    res.status(200).json({ message: 'Logged out successfully' });
};
exports.logout = logout;
const getMe = async (req, res) => {
    try {
        const user = await User_js_1.User.findById(req.user?.id);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        res.status(200).json({ user });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.getMe = getMe;
const updateMe = async (req, res) => {
    try {
        const { profileImage, name, phone, address, emergencyContact } = req.body;
        const user = await User_js_1.User.findById(req.user?.id);
        if (!user) {
            res.status(404).json({ message: 'User not found' });
            return;
        }
        if (profileImage)
            user.profileImage = profileImage;
        if (name)
            user.name = name;
        await user.save();
        if (user.employeeId) {
            const updateData = { profileImage, fullName: name };
            if (phone)
                updateData.phone = phone;
            if (address)
                updateData.address = address;
            if (emergencyContact)
                updateData.emergencyContact = emergencyContact;
            await Employee_js_1.Employee.findByIdAndUpdate(user.employeeId, updateData);
        }
        res.status(200).json({ user });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
};
exports.updateMe = updateMe;
