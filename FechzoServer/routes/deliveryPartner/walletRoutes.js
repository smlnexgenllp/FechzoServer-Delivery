const express=require("express");

const router=express.Router();

const wallet=require("../../controllers/deliverypartner/walletController");

const verifyPartner=require("../../middleware/auth/verifyPartner");

router.get(
"/wallet",
verifyPartner,
wallet.getWallet
);

router.get(
"/wallet-summary",
verifyPartner,
wallet.getWalletSummary
);

router.get(
"/transactions",
verifyPartner,
wallet.getTransactions
);

router.post(
"/credit",
verifyPartner,
wallet.creditWallet
);

router.post(
"/withdraw",
verifyPartner,
wallet.withdrawWallet
);

router.post(
"/fuel",
verifyPartner,
wallet.addFuelEntry
);

router.get(
"/fuel-history",
verifyPartner,
wallet.getFuelHistory
);
router.get(
  "/fuel/today",
  verifyPartner,
  wallet.getTodayFuel
);
module.exports=router;