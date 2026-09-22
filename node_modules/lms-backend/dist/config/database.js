"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const connectDB = async () => {
    const mongoURI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lms_db';
    try {
        const conn = await mongoose_1.default.connect(mongoURI);
        console.log(`[MongoDB] Connected successfully: ${conn.connection.host}`);
    }
    catch (error) {
        console.error('[MongoDB] Connection failure:', error);
        process.exit(1);
    }
};
exports.connectDB = connectDB;
