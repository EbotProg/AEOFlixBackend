import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config(); // Load environment variables

const connectDB = async (): Promise<void> => {
    try {
        
        await mongoose.connect(process.env.MONGO_URI as string);
        console.log("MongoDB connected successfully!");
    } catch (error) {
        console.error("Error connecting to MongoDB:", error);
        process.exit(1); // Exit the app if the connection fails
    }
};

export default connectDB;
