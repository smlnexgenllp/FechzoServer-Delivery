const mongoose=require("mongoose");

const fuelSchema=new mongoose.Schema({

    partnerId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"DeliveryPartner",
        required:true
    },

    litres:{
        type:Number,
        required:true
    },

    pricePerLitre:{
        type:Number,
        required:true
    },

    amount:{
        type:Number,
        required:true
    },

    odometer:{
        type:Number
    },

    notes:{
        type:String
    }

},{
    timestamps:true
});

module.exports=mongoose.model("FuelEntry",fuelSchema);