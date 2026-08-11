const Wallet=require("../../models/deliverypartner/Wallet");
const FuelEntry=require("../../models/deliverypartner/FuelEntry");



// Get Wallet
exports.getWallet=async(req,res)=>{

try{

const partnerId=req.partner._id;

let wallet=await Wallet.findOne({partnerId});

if(!wallet){

wallet=await Wallet.create({
partnerId
});

}

res.json({
success:true,
wallet
});

}catch(err){

res.status(500).json({
success:false,
message:err.message
});

}

};




// Credit Wallet

exports.creditWallet=async(req,res)=>{

try{

const {amount,description}=req.body;

const partnerId=req.partner._id;

let wallet=await Wallet.findOne({partnerId});

if(!wallet){

wallet=await Wallet.create({partnerId});

}

wallet.balance+=Number(amount);

wallet.totalEarned+=Number(amount);

wallet.transactions.push({

type:"credit",
amount,
description

});

await wallet.save();

res.json({

success:true,
wallet

});

}catch(err){

res.status(500).json({

success:false,
message:err.message

});

}

};




// Withdraw

exports.withdrawWallet=async(req,res)=>{

try{

const {amount}=req.body;

const partnerId=req.partner._id;

const wallet=await Wallet.findOne({partnerId});

if(!wallet){

return res.status(404).json({

success:false,
message:"Wallet not found"

});

}

if(wallet.balance<amount){

return res.status(400).json({

success:false,
message:"Insufficient Balance"

});

}

wallet.balance-=amount;

wallet.totalWithdrawn+=amount;

wallet.transactions.push({

type:"withdraw",
amount,
description:"Wallet Withdraw"

});

await wallet.save();

res.json({

success:true,
wallet

});

}catch(err){

res.status(500).json({

success:false,
message:err.message

});

}

};




// Fuel Entry

exports.addFuelEntry=async(req,res)=>{

try{

const {

litres,
pricePerLitre,
odometer,
notes

}=req.body;

const partnerId=req.partner._id;

const amount=litres*pricePerLitre;

const fuel=await FuelEntry.create({

partnerId,
litres,
pricePerLitre,
amount,
odometer,
notes

});

let wallet=await Wallet.findOne({partnerId});

if(!wallet){

wallet=await Wallet.create({
partnerId
});

}

wallet.balance-=amount;

wallet.transactions.push({

type:"fuel",
amount,
description:"Fuel Expense"

});

await wallet.save();

res.json({

success:true,
fuel,
wallet

});

}catch(err){

res.status(500).json({

success:false,
message:err.message

});

}

};




// Fuel History

exports.getFuelHistory=async(req,res)=>{

try{

const partnerId=req.partner._id;

const history=await FuelEntry.find({

partnerId

}).sort({

createdAt:-1

});

res.json({

success:true,
history

});

}catch(err){

res.status(500).json({

success:false,
message:err.message

});

}

};




// Wallet Transactions

exports.getTransactions=async(req,res)=>{

try{

const partnerId=req.partner._id;

const wallet=await Wallet.findOne({

partnerId

});

if(!wallet){

return res.json({

success:true,
transactions:[]

});

}

res.json({

success:true,
transactions:wallet.transactions

});

}catch(err){

res.status(500).json({

success:false,
message:err.message

});

}

};

// Get Wallet Summary (correct balance calculation)
exports.getWalletSummary = async (req, res) => {
  try {
    const partnerId = req.partner._id;

    let wallet = await Wallet.findOne({ partnerId });

    if (!wallet) {
      wallet = await Wallet.create({ partnerId });
    }

    // Today's fuel (optional - already have separate API)
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const todayFuel = await FuelEntry.aggregate([
      {
        $match: {
          partnerId,
          createdAt: { $gte: start, $lte: end },
        },
      },
      {
        $group: {
          _id: null,
          totalFuel: { $sum: "$amount" },
        },
      },
    ]);

    // ✅ Correct Balance Formula
    // balance = totalEarned - totalWithdrawn - totalFuelExpenses
    // (Assuming you already update totalEarned on order delivery
    //  and totalWithdrawn only when admin APPROVES withdrawal)

    const balance =
      (wallet.totalEarned || 0) -
      (wallet.totalWithdrawn || 0) -
      (wallet.totalFuelExpense || 0);

    // Keep wallet.balance in sync
    if (wallet.balance !== balance) {
      wallet.balance = balance;
      await wallet.save();
    }

    res.json({
      success: true,
      balance: wallet.balance,
      totalEarned: wallet.totalEarned || 0,
      totalWithdrawn: wallet.totalWithdrawn || 0,
      totalFuel: todayFuel[0]?.totalFuel || 0,
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};
exports.getTodayFuel = async (req, res) => {
  try {
    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const end = new Date();
    end.setHours(23, 59, 59, 999);

    const entries = await FuelEntry.find({
      partnerId: req.partner._id,
      createdAt: {
        $gte: start,
        $lte: end,
      },
    });

    const totalFuel = entries.reduce(
      (sum, item) => sum + item.amount,
      0
    );

    res.json({
      success: true,
      totalFuel,
    });
  } catch (err) {
    console.error(err);

    res.status(500).json({
      success: false,
      message: err.message,
    });
  }
};