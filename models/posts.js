//mongoose
const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const BlogPosts = new Schema({
    author: String,
    title: String,
    subheading: String,
    body: String,
    date: String
});

module.exports = mongoose.model('Blog', BlogPosts)