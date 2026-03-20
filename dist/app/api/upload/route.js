"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const cloudinary_1 = require("cloudinary");
// Configure Cloudinary with error handling
if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('Missing Cloudinary environment variables');
    throw new Error('Cloudinary configuration is missing');
}
cloudinary_1.v2.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});
async function POST(request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');
        if (!file) {
            console.error('No file provided');
            return server_1.NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }
        // Convert file to buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        // Upload to Cloudinary with error handling
        const result = await new Promise((resolve, reject) => {
            const uploadStream = cloudinary_1.v2.uploader.upload_stream({
                resource_type: 'image',
                folder: 'portfolio',
                format: 'webp',
            }, (error, result) => {
                if (error) {
                    console.error('Cloudinary upload error:', error);
                    reject(error);
                }
                else {
                    resolve(result);
                }
            });
            uploadStream.end(buffer);
        });
        return server_1.NextResponse.json({
            success: true,
            url: result.secure_url
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        return server_1.NextResponse.json({ error: 'Failed to upload image: ' + error.message }, { status: 500 });
    }
}
async function DELETE(request) {
    try {
        const { publicId } = await request.json();
        if (!publicId) {
            return server_1.NextResponse.json({ error: 'No public ID provided' }, { status: 400 });
        }
        // Delete from Cloudinary
        await cloudinary_1.v2.uploader.destroy(publicId);
        return server_1.NextResponse.json({ success: true });
    }
    catch (error) {
        console.error('Delete error:', error);
        return server_1.NextResponse.json({ error: 'Failed to delete image' }, { status: 500 });
    }
}
