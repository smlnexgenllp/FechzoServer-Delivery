const mongoose = require("mongoose");

const storeSchema = new mongoose.Schema(
  {
    storeId: {
      type: String,
      required: true,
      unique: true
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: true
    },

    categorySlug: {
      type: String,
      required: true,
      enum: [
        "grocery",
        "fashion",
        "electronics",
        "pharmacy",
        "bakery",
        "meat",
        "other"
      ]
    },

    storeName: {
      type: String,
      required: true,
      trim: true
    },

    ownerDetails: {
      fullName: {
        type: String,
        required: true
      },

      phone: {
        type: String,
        required: true,
        match: [/^\d{10}$/, "Invalid phone number"]
      },

      email: {
        type: String,
        required: true,
        match: [/^\S+@\S+\.\S+$/, "Invalid email format"]
      }
    },

    address: {
      shopNumber: String,
      street: String,
      area: {
        type: String,
        required: true
      },
      city: {
        type: String,
        required: true
      },
      state: {
        type: String,
        required: true
      },
      postalCode: {
        type: String,
        required: true,
        match: [/^\d{6}$/, "Invalid postal code"]
      },
      landmark: String,
      latitude: String,
      longitude: String,
      mapLink: String
    },

    images: {
      profile: String,
      cover: String,
      gallery: {
        type: [String],
        default: []
      }
    },

    contact: {
      phone: String,
      alternatePhone: String,
      email: String
    },

    timings: {
      Monday: {
        open: String,
        close: String,
        isOpen: {
          type: Boolean,
          default: true
        }
      },
      Tuesday: {
        open: String,
        close: String,
        isOpen: {
          type: Boolean,
          default: true
        }
      },
      Wednesday: {
        open: String,
        close: String,
        isOpen: {
          type: Boolean,
          default: true
        }
      },
      Thursday: {
        open: String,
        close: String,
        isOpen: {
          type: Boolean,
          default: true
        }
      },
      Friday: {
        open: String,
        close: String,
        isOpen: {
          type: Boolean,
          default: true
        }
      },
      Saturday: {
        open: String,
        close: String,
        isOpen: {
          type: Boolean,
          default: true
        }
      },
      Sunday: {
        open: String,
        close: String,
        isOpen: {
          type: Boolean,
          default: true
        }
      }
    },

    legalDetails: {
      gstNumber: {
        type: String,
        default: ""
      },

      panNumber: {
        type: String,
        default: ""
      },

      gstRegistered: {
        type: Boolean,
        default: false
      },

      licenseNumber: {
        type: String,
        default: ""
      },

      licenseDocument: {
        type: String,
        default: ""
      }
    },

    bankDetails: {
      accountHolderName: String,
      bankName: String,
      branchName: String,
      accountNumber: String,
      ifscCode: String,
      accountType: {
        type: String,
        enum: ["Savings", "Current"]
      }
    },

    services: {
      delivery: {
        type: Boolean,
        default: true
      },

      pickup: {
        type: Boolean,
        default: true
      },

      storePickup: {
        type: Boolean,
        default: false
      }
    },

    approvalStatus: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending"
    },

    rejectionReason: {
      type: String,
      default: ""
    },

    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model(
  "Store",
  storeSchema,
  "stores"
);