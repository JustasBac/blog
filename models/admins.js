//mongoose
const mongoose = require('mongoose');

const Schema = mongoose.Schema;
const passportLocalMongoose = require('passport-local-mongoose');

// return this.url.replace('/upload', '/upload/ar_1:1,bo_0px_solid_rgb:ffffff,c_fill,g_auto,o_100,r_max,w_234');

const adminSchema = new Schema({
    email: {
        type: String,
        required: true,
        unique: true
    },
    aboutMe: String,
    tester: Boolean,
    avatarImage: {
        url: String,
        filename: String
    }
});



adminSchema.plugin(passportLocalMongoose); // sita eilute prideda username ir password field!

module.exports = mongoose.model('Admin', adminSchema)