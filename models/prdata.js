const mongoose = require("mongoose");

const prSchema = new mongoose.Schema(
    {
        prid: String,
        merged: Boolean,
    },
    { collection: "prdata" },
);

module.exports = mongoose.model("prdata", prSchema);
