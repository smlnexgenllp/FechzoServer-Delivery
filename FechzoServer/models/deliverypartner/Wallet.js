const mongoose = require("mongoose");

const walletSchema = new mongoose.Schema(
{
    partnerId:{
        type:mongoose.Schema.Types.ObjectId,
        ref:"DeliveryPartner",
        required:true,
        unique:true
    },

    balance:{
        type:Number,
        default:0
    },

    totalEarned:{
        type:Number,
        default:0
    },

    totalWithdrawn:{
        type:Number,
        default:0
    },

    transactions:[
        {
            type:{
                type:String,
                enum:[
                    "credit",
                    "debit",
                    "fuel",
                    "withdraw"
                ]
            },

            amount:Number,

            description:String,

            createdAt:{
                type:Date,
                default:Date.now
            }
        }
    ]
},
{
    timestamps:true
}
);

module.exports=mongoose.model("Wallet",walletSchema);